# Diagnostic Click Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure `Forgot password?` flow to the tutor sign-in page using Firebase password-reset emails.

**Architecture:** A focused auth helper validates and normalizes the email, invokes an injected Firebase sender, and converts account-enumeration and service outcomes into safe user-facing messages. `AuthPage` owns the loading and feedback UI while `src/firebase.ts` exposes Firebase's existing client API.

**Tech Stack:** React 19, TypeScript, Firebase Authentication, Vitest, Vite, Vercel

---

### Task 1: Password Reset Request Helper

**Files:**
- Create: `src/auth/password-reset.ts`
- Create: `src/auth/password-reset.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `src/auth/password-reset.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_RESET_CONFIRMATION,
  requestPasswordReset,
} from './password-reset';

describe('requestPasswordReset', () => {
  it('trims the email and returns the neutral confirmation', async () => {
    const sendReset = vi.fn().mockResolvedValue(undefined);

    await expect(requestPasswordReset(' tutor@example.com ', sendReset))
      .resolves.toBe(PASSWORD_RESET_CONFIRMATION);
    expect(sendReset).toHaveBeenCalledWith('tutor@example.com');
  });

  it.each(['', 'not-an-email', 'tutor@'])(
    'rejects invalid email %j without contacting Firebase',
    async (email) => {
      const sendReset = vi.fn();

      await expect(requestPasswordReset(email, sendReset))
        .rejects.toThrow('Enter a valid email address first.');
      expect(sendReset).not.toHaveBeenCalled();
    },
  );

  it('does not reveal an unregistered Firebase account', async () => {
    const sendReset = vi.fn().mockRejectedValue({ code: 'auth/user-not-found' });

    await expect(requestPasswordReset('missing@example.com', sendReset))
      .resolves.toBe(PASSWORD_RESET_CONFIRMATION);
  });

  it('returns a safe retry message for service failures', async () => {
    const sendReset = vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(requestPasswordReset('tutor@example.com', sendReset))
      .rejects.toThrow('We could not send the reset email. Please try again.');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/auth/password-reset.test.ts
```

Expected: FAIL because `src/auth/password-reset.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

Create `src/auth/password-reset.ts`:

```ts
export const PASSWORD_RESET_CONFIRMATION =
  'If an account exists for that email, check your inbox for a password reset link.';

type ResetSender = (email: string) => Promise<void>;

function firebaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export async function requestPasswordReset(email: string, sendReset: ResetSender) {
  const normalizedEmail = email.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  if (!validEmail) {
    throw new Error('Enter a valid email address first.');
  }

  try {
    await sendReset(normalizedEmail);
  } catch (error) {
    if (firebaseErrorCode(error) !== 'auth/user-not-found') {
      throw new Error('We could not send the reset email. Please try again.');
    }
  }

  return PASSWORD_RESET_CONFIRMATION;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/auth/password-reset.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit the helper**

```bash
git add src/auth/password-reset.ts src/auth/password-reset.test.ts
git commit -m "feat: add password reset request helper"
```

### Task 2: Tutor Account Reset UI

**Files:**
- Modify: `src/firebase.ts`
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Export Firebase's reset API**

Add `sendPasswordResetEmail` to the import and export lists in `src/firebase.ts`:

```ts
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
```

```ts
export {
  // existing exports
  sendPasswordResetEmail,
};
```

- [ ] **Step 2: Add reset state and behavior to `AuthPage`**

Import the reset API and helper:

```ts
import { requestPasswordReset } from '../auth/password-reset';
import {
  auth,
  createUserWithEmailAndPassword,
  googleProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from '../firebase';
```

Add component state:

```ts
const [resetMessage, setResetMessage] = useState('');
const [resetting, setResetting] = useState(false);
const busy = submitting || resetting;
```

Add the reset handler:

```ts
async function requestReset() {
  setError('');
  setResetMessage('');
  setResetting(true);

  try {
    const message = await requestPasswordReset(
      email,
      (normalizedEmail) => sendPasswordResetEmail(auth, normalizedEmail),
    );
    setResetMessage(message);
  } catch (nextError) {
    setError(nextError instanceof Error
      ? nextError.message
      : 'We could not send the reset email. Please try again.');
  } finally {
    setResetting(false);
  }
}
```

Use `busy` for all existing disabled states. When changing account mode, clear both `error` and `resetMessage`.

- [ ] **Step 3: Render the sign-in-only control and feedback**

Immediately below the password label, render:

```tsx
{mode === 'sign-in' && (
  <div className="-mt-2 flex justify-end">
    <button
      type="button"
      onClick={requestReset}
      disabled={busy}
      className="inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-[#126b73] hover:text-[#0d545b] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {resetting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
      Forgot password?
    </button>
  </div>
)}
```

After the error alert, render:

```tsx
{resetMessage && (
  <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm text-teal-800" role="status">
    {resetMessage}
  </div>
)}
```

- [ ] **Step 4: Run full local verification**

Run:

```bash
npm test
npm run lint
npm run build
npx vercel build --prod --yes
```

Expected: all unit tests pass, TypeScript exits 0, Vite exits 0, and Vercel produces exactly the existing six functions.

- [ ] **Step 5: Commit the UI**

```bash
git add src/firebase.ts src/pages/AuthPage.tsx
git commit -m "feat: add tutor password reset"
```

### Task 3: Review, Publish, and Production Verification

**Files:**
- Verify only; no planned source edits

- [ ] **Step 1: Run spec-compliance review**

Confirm the implementation matches every requirement in `docs/superpowers/specs/2026-06-30-password-reset-design.md` and introduces no unrelated behavior.

- [ ] **Step 2: Run code-quality review**

Check accessibility, account-enumeration safety, loading states, Firebase error handling, test quality, and regression risk.

- [ ] **Step 3: Push the branch and check CI**

```bash
git push github codex/tutor-accounts-notifications-email
gh run list --branch codex/tutor-accounts-notifications-email --limit 5
```

Expected: the Firestore Rules workflow for the new head commit succeeds.

- [ ] **Step 4: Deploy production**

```bash
npx vercel deploy --prod --yes
```

Expected: deployment reaches `READY`. If Vercel keeps the custom domain on a rollback, explicitly promote the ready deployment before testing.

- [ ] **Step 5: Verify the live UI without sending a real email**

At `https://diagnostic.click/account`:

1. Confirm `Forgot password?` appears in Sign in mode.
2. Confirm it disappears in Register mode.
3. Enter a non-existent `@example.com` address and request a reset.
4. Confirm the neutral inbox message appears.
5. Confirm the page produces no browser console errors.

- [ ] **Step 6: Confirm existing production flows**

Verify:

```text
https://diagnostic.click/test/gcse-foundation-overall-revision
https://tutor-diagnostic.vercel.app/test/gcse-foundation-overall-revision
```

Expected: both load the GCSE test with 20 questions. Confirm the compatibility dashboard still shows historical tests and results.
