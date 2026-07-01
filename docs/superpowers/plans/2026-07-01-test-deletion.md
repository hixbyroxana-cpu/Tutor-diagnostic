# Tutor Test Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated tutor permanently delete an owned test after confirmation while preserving all completed results.

**Architecture:** The Tests page will delete a Firestore `tests` document directly and update local list state after success. A focused helper will validate the document ID and keep list removal testable, while existing Firestore rules remain the authoritative owner check. Production rollout will assign historical ownerless records to Roxana before enabling owner-filtered authentication.

**Tech Stack:** React 19, TypeScript, Firebase Authentication and Firestore, Vitest, Vite, Vercel

---

## File Map

- Create `src/lib/test-deletion.ts`: validate delete requests and remove a deleted test from local state.
- Create `src/lib/test-deletion.test.ts`: test successful deletion, failed deletion, and local list removal.
- Modify `src/firebase.ts`: export Firestore's `deleteDoc`.
- Modify `src/pages/TestsList.tsx`: add owner-only delete action, confirmation dialog, pending state, and error feedback.
- Use existing `scripts/migrate-existing-owner.ts`: assign historical ownerless tests and results to Roxana.
- Use existing `firestore.rules`: enforce owner-only deletion after the security rollout.

### Task 1: Test Deletion Helper

**Files:**
- Create: `src/lib/test-deletion.ts`
- Test: `src/lib/test-deletion.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { deleteTestDocument, removeTestById } from './test-deletion';

describe('deleteTestDocument', () => {
  it('deletes the selected test document', async () => {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);

    await deleteTestDocument('test-2', deleteDocument);

    expect(deleteDocument).toHaveBeenCalledWith('test-2');
  });

  it('rejects an empty test document ID without calling Firestore', async () => {
    const deleteDocument = vi.fn().mockResolvedValue(undefined);

    await expect(deleteTestDocument('', deleteDocument)).rejects.toThrow(
      'A test document ID is required.',
    );
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('propagates deletion failures', async () => {
    const deleteDocument = vi.fn().mockRejectedValue(new Error('permission-denied'));

    await expect(deleteTestDocument('test-2', deleteDocument)).rejects.toThrow(
      'permission-denied',
    );
  });
});

describe('removeTestById', () => {
  it('removes only the deleted test', () => {
    const tests = [
      { id: 'test-1', title: 'First' },
      { id: 'test-2', title: 'Second' },
    ];

    expect(removeTestById(tests, 'test-2')).toEqual([
      { id: 'test-1', title: 'First' },
    ]);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```bash
npx vitest run src/lib/test-deletion.test.ts
```

Expected: FAIL because `src/lib/test-deletion.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export async function deleteTestDocument(
  testId: string,
  deleteDocument: (testId: string) => Promise<void>,
) {
  if (!testId.trim()) {
    throw new Error('A test document ID is required.');
  }

  await deleteDocument(testId);
}

export function removeTestById<T extends { id?: string }>(
  tests: T[],
  deletedTestId: string,
) {
  return tests.filter(test => test.id !== deletedTestId);
}
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
npx vitest run src/lib/test-deletion.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the helper**

```bash
git add src/lib/test-deletion.ts src/lib/test-deletion.test.ts
git commit -m "test: define tutor test deletion behavior"
```

### Task 2: Confirmation And Deletion UI

**Files:**
- Modify: `src/firebase.ts`
- Modify: `src/pages/TestsList.tsx`

- [ ] **Step 1: Export Firestore deletion**

Add `deleteDoc` to the `firebase/firestore` import and export list in `src/firebase.ts`.

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
```

```ts
export {
  collection,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  setDoc,
  limit,
  // Existing authentication exports remain unchanged.
};
```

- [ ] **Step 2: Add deletion state and handler to `TestsList`**

Import `AlertTriangle`, `Trash2`, `deleteDoc`, `doc`, `belongsToTutor`, and the new helper. Add:

```ts
const [testPendingDeletion, setTestPendingDeletion] = useState<LegacyTest | null>(null);
const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
const [deleteError, setDeleteError] = useState('');

async function confirmDelete() {
  const testId = testPendingDeletion?.id;
  if (!testPendingDeletion || !testId || !user?.uid || !belongsToTutor(testPendingDeletion, user.uid)) {
    setDeleteError('You can only delete tests owned by your account.');
    return;
  }

  setDeletingTestId(testId);
  setDeleteError('');

  try {
    await deleteTestDocument(testId, async selectedId => {
      await deleteDoc(doc(db, 'tests', selectedId));
    });
    setTests(current => removeTestById(current, testId));
    setTestPendingDeletion(null);
  } catch (error) {
    console.error('Failed to delete test', error);
    setDeleteError('The test could not be deleted. Please try again.');
  } finally {
    setDeletingTestId(null);
  }
}
```

- [ ] **Step 3: Add the owner-only trash action**

Render the action only when the document has an ID and belongs to the signed-in tutor:

```tsx
{test.id && user?.uid && belongsToTutor(test, user.uid) && (
  <button
    type="button"
    onClick={() => {
      setDeleteError('');
      setTestPendingDeletion(test);
    }}
    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
    aria-label={`Delete ${test.title}`}
    title="Delete Test"
  >
    <Trash2 className="w-4 h-4" aria-hidden="true" />
  </button>
)}
```

- [ ] **Step 4: Add the confirmation dialog**

Render this after the tests table:

```tsx
{testPendingDeletion && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    role="presentation"
    onMouseDown={event => {
      if (event.currentTarget === event.target && !deletingTestId) {
        setTestPendingDeletion(null);
        setDeleteError('');
      }
    }}
  >
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-test-heading"
      className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <h2 id="delete-test-heading" className="text-lg font-bold text-slate-900">
            Delete {testPendingDeletion.title}?
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Its student link will stop working. Completed results and reports will remain available.
            This cannot be undone.
          </p>
        </div>
      </div>

      {deleteError && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {deleteError}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          disabled={Boolean(deletingTestId)}
          onClick={() => {
            setTestPendingDeletion(null);
            setDeleteError('');
          }}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={Boolean(deletingTestId)}
          onClick={() => void confirmDelete()}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {deletingTestId ? 'Deleting...' : 'Delete test'}
        </button>
      </div>
    </section>
  </div>
)}
```

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
npx vitest run src/lib/test-deletion.test.ts src/lib/ownership.test.ts
npm test
npm run lint
npm run build
```

Expected: all tests pass, TypeScript reports no errors, and Vite builds successfully.

- [ ] **Step 6: Commit the UI**

```bash
git add src/firebase.ts src/pages/TestsList.tsx
git commit -m "feat: allow tutors to delete owned tests"
```

### Task 3: Local Browser Verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Start the local app**

Run:

```bash
npm run dev
```

Expected: Vite serves the app on `http://localhost:3000`.

- [ ] **Step 2: Verify cancel and confirmation behavior**

Sign in, open `/tests`, select an owned test's trash icon, and confirm:

- the dialog names the selected test;
- the warning says results remain available;
- Cancel closes the dialog without changing the list.

- [ ] **Step 3: Verify deletion with a temporary test**

Create a temporary test, copy its public URL, delete it through the confirmation dialog, and confirm:

- only the temporary row disappears;
- `/results` still loads existing reports;
- the temporary public URL reports that the test is unavailable.

### Task 4: Historical Ownership And Security Rollout

**Files:**
- Use: `scripts/migrate-existing-owner.ts`
- Use: `firestore.rules`
- Use: `.env.production.local` (ignored by Git)

- [ ] **Step 1: Pull production Admin credentials locally**

Run:

```bash
npx vercel env pull .env.production.local --environment=production
```

Expected: the ignored file contains `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

- [ ] **Step 2: Dry-run the existing ownership migration**

Run:

```bash
node --env-file=.env.production.local --import tsx scripts/migrate-existing-owner.ts \
  --owner-email roxana.scurtu@yahoo.com \
  --dry-run
```

Expected: the script resolves Roxana's Firebase UID, reports ownerless counts, finds no foreign-owner conflicts, and performs no writes.

- [ ] **Step 3: Apply and verify the ownership migration**

Run:

```bash
node --env-file=.env.production.local --import tsx scripts/migrate-existing-owner.ts \
  --owner-email roxana.scurtu@yahoo.com \
  --apply
```

Expected: every ownerless `tests` and `testResults` document receives Roxana's UID and the script reports zero ownerless records afterward.

- [ ] **Step 4: Deploy private Firestore rules**

Run:

```bash
npx firebase-tools deploy --only firestore:rules --project gen-lang-client-0257693538
```

Expected: rules deploy to `ai-studio-1ba9c379-e91f-45ca-b2e0-7aaee16eb4fa`.

- [ ] **Step 5: Enable authenticated production mode and deploy**

Replace the Production value of `VITE_AUTH_REQUIRED` with `true`, then create a fresh production deployment:

```bash
npx vercel env rm VITE_AUTH_REQUIRED production --yes
printf 'true' | npx vercel env add VITE_AUTH_REQUIRED production
npx vercel --prod
```

Expected: the deployment is Ready and aliased to `https://diagnostic.click`.

- [ ] **Step 6: Verify production**

Confirm on `https://diagnostic.click`:

- signed-out admin routes redirect to `/account`;
- Roxana can sign in and see all migrated tests and results;
- a temporary owned test can be deleted;
- its public link becomes unavailable;
- completed results remain visible;
- another user's records are not returned by owner-filtered queries.

### Task 5: Publish And Monitor

**Files:**
- No additional source changes expected.

- [ ] **Step 1: Push the branch**

```bash
git push github codex/tutor-accounts-notifications-email
```

Expected: the existing draft pull request updates with the design, plan, helper, and deletion UI commits.

- [ ] **Step 2: Check CI and production logs**

Run:

```bash
gh run list --branch codex/tutor-accounts-notifications-email --limit 5
npx vercel logs https://diagnostic.click
```

Expected: relevant GitHub checks pass and production requests show no deletion-related server errors.
