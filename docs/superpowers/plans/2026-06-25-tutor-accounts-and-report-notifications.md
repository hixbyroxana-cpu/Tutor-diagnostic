# Tutor Accounts and Report Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add private tutor accounts, per-tutor test ownership, editable starter tests, and automatic completion emails linking tutors to the exact result without breaking any existing Vercel test link or current data.

**Architecture:** Firebase Authentication handles email/password and Google sign-in. Vercel Functions use Firebase Admin for trusted profile provisioning, public test loading, server-side marking, result storage, and Resend email delivery. A staged rollout flag keeps the current dashboard available until Roxana's account exists, all records are migrated, and ownership has been verified.

**Tech Stack:** React 19, React Router, Firebase Authentication and Firestore, Firebase Admin SDK, Vercel Functions, Resend, TypeScript, Vitest.

---

## Release Gates

Do not combine these gates into one production deployment:

1. **Compatibility release:** deploy authentication UI and server APIs with `VITE_AUTH_REQUIRED=false`. Keep current Firestore rules and both domains working.
2. **Owner setup:** create `roxana.scurtu@yahoo.com`, capture its Firebase UID, run the migration, and verify every existing test/result is visible.
3. **Security release:** deploy private Firestore rules and set `VITE_AUTH_REQUIRED=true`.
4. **Email release:** verify `mail.diagnostic.click`, add Resend environment variables, and enable completion notifications.

At every gate, smoke-test `https://tutor-diagnostic.vercel.app/test/gcse-foundation-overall-revision` before proceeding.

### Task 1: Add Test Infrastructure and Shared Ownership Types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types.ts`
- Create: `src/lib/ownership.ts`
- Create: `src/lib/ownership.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install server and test dependencies**

Run:

```bash
npm install firebase-admin resend
npm install -D vitest
```

Expected: `firebase-admin`, `resend`, and `vitest` appear in `package.json`.

- [ ] **Step 2: Add the test script**

Add to `package.json`:

```json
"test": "vitest run"
```

- [ ] **Step 3: Write the failing ownership tests**

Create `src/lib/ownership.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { belongsToTutor, makeTutorSlug } from './ownership';

describe('ownership helpers', () => {
  it('matches only the owning tutor', () => {
    expect(belongsToTutor({ ownerId: 'tutor-a' }, 'tutor-a')).toBe(true);
    expect(belongsToTutor({ ownerId: 'tutor-a' }, 'tutor-b')).toBe(false);
    expect(belongsToTutor({}, 'tutor-a')).toBe(false);
  });

  it('creates a stable URL-safe tutor slug', () => {
    expect(makeTutorSlug('GCSE Foundation Overall Revision', 'ABC123456789'))
      .toBe('gcse-foundation-overall-revision-abc12345');
  });
});
```

- [ ] **Step 4: Run the test and verify failure**

Run:

```bash
npm test -- src/lib/ownership.test.ts
```

Expected: FAIL because `src/lib/ownership.ts` does not exist.

- [ ] **Step 5: Add ownership fields and helpers**

Extend `Test` and `TestResult` in `src/types.ts`:

```ts
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface OwnedRecord {
  ownerId: string;
}

export interface Test extends OwnedRecord {
  templateSourceId?: string;
  // existing fields remain unchanged
}

export interface TestResult extends OwnedRecord {
  submissionId: string;
  notificationStatus: NotificationStatus;
  notificationSentAt?: number;
  notificationError?: string;
  // existing fields remain unchanged
}

export interface TutorProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  templatesProvisionedAt?: number;
}
```

Create `src/lib/ownership.ts`:

```ts
export function belongsToTutor(record: { ownerId?: string }, uid: string) {
  return Boolean(uid && record.ownerId === uid);
}

export function makeTutorSlug(title: string, uid: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${uid.slice(0, 8).toLowerCase()}`;
}
```

- [ ] **Step 6: Document environment variables**

Add to `.env.example`:

```dotenv
VITE_AUTH_REQUIRED="false"
APP_BASE_URL="https://diagnostic.click"
EMAIL_FROM="Diagnostic Click <reports@mail.diagnostic.click>"
RESEND_API_KEY=""
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
```

- [ ] **Step 7: Run checks**

Run:

```bash
npm test -- src/lib/ownership.test.ts
npm run lint
```

Expected: tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/types.ts src/lib/ownership.ts src/lib/ownership.test.ts .env.example
git commit -m "Add tutor ownership model"
```

### Task 2: Add Firebase Authentication and Tutor Session State

**Files:**
- Modify: `src/firebase.ts`
- Create: `src/auth/AuthProvider.tsx`
- Create: `src/auth/RequireAuth.tsx`
- Create: `src/pages/AuthPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AdminLayout.tsx`
- Create: `src/auth/auth-errors.ts`
- Create: `src/auth/auth-errors.test.ts`

- [ ] **Step 1: Write failing auth error tests**

Create `src/auth/auth-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './auth-errors';

describe('friendlyAuthError', () => {
  it('maps common Firebase errors', () => {
    expect(friendlyAuthError('auth/invalid-credential')).toBe('Email or password is incorrect.');
    expect(friendlyAuthError('auth/email-already-in-use')).toBe('An account already exists for this email.');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/auth/auth-errors.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Export Firebase Auth**

Update `src/firebase.ts`:

```ts
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
};
```

- [ ] **Step 4: Add auth error mapping**

Create `src/auth/auth-errors.ts`:

```ts
const messages: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
};

export function friendlyAuthError(code?: string) {
  return messages[code || ''] || 'We could not sign you in. Please try again.';
}
```

- [ ] **Step 5: Add the auth provider**

Create `src/auth/AuthProvider.tsx` with:

```tsx
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, next => {
    setUser(next);
    setLoading(false);
  }), []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      getIdToken: async () => {
        if (!user) throw new Error('Authentication required.');
        return user.getIdToken();
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

Also export a `useAuth()` hook that throws when used outside the provider.

- [ ] **Step 6: Add compatibility-aware route protection**

Create `src/auth/RequireAuth.tsx`:

```tsx
const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8">Loading account...</div>;
  if (authRequired && !user) {
    return <Navigate to="/account" state={{ returnTo: location.pathname }} replace />;
  }
  return <Outlet />;
}
```

This is the compatibility gate: production remains unchanged while `VITE_AUTH_REQUIRED=false`.

- [ ] **Step 7: Build the account page**

Create `src/pages/AuthPage.tsx` with a sign-in/register segmented mode, email/password fields, a Google button, and these operations:

```ts
await signInWithEmailAndPassword(auth, email, password);
await createUserWithEmailAndPassword(auth, email, password);
await signInWithPopup(auth, googleProvider);
```

After success, call `POST /api/account/bootstrap` with `Authorization: Bearer <idToken>` and navigate to `returnTo || '/dashboard'`.

- [ ] **Step 8: Wire routes and sign-out**

Wrap the application with `AuthProvider` in `src/App.tsx`, add `/account`, and place admin routes under `<RequireAuth />`. Update `AdminLayout.tsx` to display `user.displayName || user.email` and a `LogOut` icon button calling `signOut(auth)`.

- [ ] **Step 9: Run checks**

Run:

```bash
npm test -- src/auth/auth-errors.test.ts
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/firebase.ts src/auth src/pages/AuthPage.tsx src/App.tsx src/components/AdminLayout.tsx
git commit -m "Add tutor authentication UI"
```

### Task 3: Add Trusted Firebase Admin and API Authentication

**Files:**
- Create: `api/_firebase-admin.ts`
- Create: `api/_http.ts`
- Create: `api/_auth.ts`
- Create: `api/_auth.test.ts`

- [ ] **Step 1: Write the failing bearer-token test**

Create `api/_auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readBearerToken } from './_auth';

describe('readBearerToken', () => {
  it('returns a bearer token', () => {
    expect(readBearerToken('Bearer abc123')).toBe('abc123');
  });

  it('rejects malformed headers', () => {
    expect(readBearerToken('Basic abc123')).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- api/_auth.test.ts
```

Expected: FAIL because `api/_auth.ts` does not exist.

- [ ] **Step 3: Initialize Firebase Admin once**

Create `api/_firebase-admin.ts`:

```ts
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

const adminApp = getApps()[0] || initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey(),
  }),
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, 'ai-studio-1ba9c379-e91f-45ca-b2e0-7aaee16eb4fa');
```

- [ ] **Step 4: Add HTTP and authentication helpers**

Create `api/_auth.ts`:

```ts
import { adminAuth } from './_firebase-admin.js';

export function readBearerToken(header?: string) {
  const match = header?.match(/^Bearer (.+)$/);
  return match?.[1] || null;
}

export async function requireTutor(req: any) {
  const token = readBearerToken(req.headers.authorization);
  if (!token) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  return adminAuth.verifyIdToken(token);
}
```

Create `api/_http.ts` with `sendJson`, method guards, and a shared error handler that exposes only safe messages.

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- api/_auth.test.ts
npm run lint
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/_firebase-admin.ts api/_http.ts api/_auth.ts api/_auth.test.ts
git commit -m "Add authenticated server foundation"
```

### Task 4: Provision Tutor Profiles and Editable Starter Tests

**Files:**
- Create: `api/account/bootstrap.ts`
- Create: `api/account/bootstrap-core.ts`
- Create: `api/account/bootstrap-core.test.ts`
- Create: `scripts/seed-test-templates.ts`

- [ ] **Step 1: Write deterministic provisioning tests**

Create `api/account/bootstrap-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStarterTest } from './bootstrap-core';

describe('buildStarterTest', () => {
  it('creates a tutor-owned editable copy with stable identity', () => {
    const result = buildStarterTest(
      { id: 'gcse', title: 'GCSE Foundation Overall Revision', slug: 'gcse-foundation-overall-revision' } as any,
      'ABC123456789',
      1000,
    );
    expect(result.ownerId).toBe('ABC123456789');
    expect(result.templateSourceId).toBe('gcse');
    expect(result.slug).toBe('gcse-foundation-overall-revision-abc12345');
    expect(result.updatedAt).toBe(1000);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- api/account/bootstrap-core.test.ts
```

Expected: FAIL because the core module does not exist.

- [ ] **Step 3: Implement the pure starter-copy builder**

Create `api/account/bootstrap-core.ts`:

```ts
import type { Test } from '../../src/types';
import { makeTutorSlug } from '../../src/lib/ownership';

export function buildStarterTest(template: Test & { id: string }, uid: string, now: number): Test {
  const { id, ...copy } = template;
  return {
    ...copy,
    ownerId: uid,
    templateSourceId: id,
    slug: makeTutorSlug(template.title, uid),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}
```

- [ ] **Step 4: Add idempotent account bootstrap**

Create `api/account/bootstrap.ts`. Verify the tutor token, load the two template documents, then in a Firestore transaction read the profile and every deterministic test reference before performing any writes:

```ts
const profileRef = adminDb.collection('tutors').doc(uid);
const templateSnap = await adminDb.collection('testTemplates').get();
const testEntries = templateSnap.docs.map(templateDoc => ({
  templateDoc,
  testRef: adminDb.collection('tests').doc(`${uid}_${templateDoc.id}`),
}));

const profileSnap = await transaction.get(profileRef);
const testSnaps = await Promise.all(testEntries.map(entry => transaction.get(entry.testRef)));

transaction.set(profileRef, {
  uid,
  email: decoded.email,
  displayName: decoded.name || decoded.email?.split('@')[0] || 'Tutor',
  createdAt: profileSnap.data()?.createdAt || now,
  templatesProvisionedAt: now,
}, { merge: true });

testEntries.forEach(({ templateDoc, testRef }, index) => {
  if (!testSnaps[index].exists) {
    transaction.create(testRef, buildStarterTest(
      { id: templateDoc.id, ...templateDoc.data() } as any,
      uid,
      now,
    ));
  }
});
```

Use deterministic document IDs so repeated bootstrap requests create exactly two tests.

- [ ] **Step 5: Add the template seed script**

Create `scripts/seed-test-templates.ts` that finds the current tests by their known Firestore IDs:

```ts
const sources = [
  { sourceId: 'Np8zdC1SdYtk1ZdlpF3T', templateId: '11-plus-diagnostic' },
  { sourceId: 'W4P9LRmsoy0psFmaJR9U', templateId: 'gcse-foundation-overall-revision' },
];
```

Copy their content into `testTemplates`, remove `ownerId`, and add `templateVersion: 1`. The script must not modify the source test documents.

- [ ] **Step 6: Run checks**

Run:

```bash
npm test -- api/account/bootstrap-core.test.ts
npm run lint
```

Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add api/account scripts/seed-test-templates.ts
git commit -m "Provision tutor starter tests"
```

### Task 5: Move Public Test Loading and Marking to Trusted APIs

**Files:**
- Create: `api/public/test.ts`
- Create: `api/public/submit-result.ts`
- Create: `api/public/submission-core.ts`
- Create: `api/public/submission-core.test.ts`
- Modify: `src/pages/PublicTestRunner.tsx`
- Modify: `src/lib/marking.ts`

- [ ] **Step 1: Write server-side marking and idempotency tests**

Create `api/public/submission-core.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildStoredResult } from './submission-core';

it('inherits ownership from the test and ignores client scoring', () => {
  const result = buildStoredResult(
    {
      id: 'test-1',
      ownerId: 'tutor-1',
      slug: 'maths',
      title: 'Maths',
      level: '11+',
      questions: [{
        id: 'q1',
        question: '2 + 2?',
        choices: ['3', '4', '5', '6'],
        correctAnswer: '4',
        topic: 'Number',
        target: 'Practise addition',
      }],
    } as any,
    { q1: '4' },
    { studentFirstName: 'Sam', studentLastName: 'Lee', parentEmail: '' },
    'submission-1',
    1000,
  );

  expect(result.ownerId).toBe('tutor-1');
  expect(result.score).toBe(1);
  expect(result.submissionId).toBe('submission-1');
  expect(result.notificationStatus).toBe('pending');
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- api/public/submission-core.test.ts
```

Expected: FAIL because `submission-core.ts` does not exist.

- [ ] **Step 3: Make marking reusable on server and client**

Change `src/lib/marking.ts` to accept typed `Test`, student details, and no browser globals. Create `buildStoredResult()` in `api/public/submission-core.ts`:

```ts
export function buildStoredResult(test, answers, studentInfo, submissionId, completedAt) {
  return {
    ...calculateTestResults(test, answers, studentInfo),
    ownerId: test.ownerId,
    submissionId,
    completedAt,
    isNew: true,
    notificationStatus: 'pending' as const,
  };
}
```

- [ ] **Step 4: Add the public test loader**

Create `api/public/test.ts`:

```ts
const slug = String(req.query.slug || '');
const snap = await adminDb.collection('tests')
  .where('slug', '==', slug)
  .where('isActive', '==', true)
  .limit(1)
  .get();
```

Return only student-safe fields. Remove `correctAnswer`, `explanation`, and `target` from each question before responding.

- [ ] **Step 5: Add idempotent result submission**

Create `api/public/submit-result.ts`. Validate:

- `submissionId` is a UUID-like client token.
- Student first and last names are non-empty and bounded.
- Every answer references a question in the stored test.

Use deterministic result ID `submissionId`:

```ts
const resultRef = adminDb.collection('testResults').doc(submissionId);
const existing = await resultRef.get();
if (existing.exists) {
  sendJson(res, 200, { resultId: existing.id, duplicate: true });
  return;
}

await resultRef.create(result);
```

Email is added in Task 7. For now return `{ resultId }`.

- [ ] **Step 6: Update the public runner**

In `PublicTestRunner.tsx`:

- Replace Firestore test loading with `GET /api/public/test?slug=<encoded slug>`.
- Create and persist `submissionId` in `sessionStorage`.
- Submit answers and student details to `POST /api/public/submit-result`.
- Keep the current route `/test/:slug` unchanged.

- [ ] **Step 7: Run checks**

Run:

```bash
npm test -- api/public/submission-core.test.ts
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add api/public src/pages/PublicTestRunner.tsx src/lib/marking.ts
git commit -m "Secure public test submissions"
```

### Task 6: Filter Dashboard Data by Tutor Without Breaking Compatibility Mode

**Files:**
- Create: `src/lib/tutor-query.ts`
- Create: `src/lib/tutor-query.test.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/TestsList.tsx`
- Modify: `src/pages/TestEditor.tsx`
- Modify: `src/pages/ResultsList.tsx`
- Modify: `src/pages/ResultDetail.tsx`

- [ ] **Step 1: Write compatibility query tests**

Create `src/lib/tutor-query.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { shouldFilterByOwner } from './tutor-query';

describe('shouldFilterByOwner', () => {
  it('filters when auth enforcement is enabled', () => {
    expect(shouldFilterByOwner(true, 'uid-1')).toBe(true);
  });

  it('keeps legacy visibility before migration', () => {
    expect(shouldFilterByOwner(false, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement the compatibility helper**

Create `src/lib/tutor-query.ts`:

```ts
export function shouldFilterByOwner(authRequired: boolean, uid: string | null | undefined) {
  return authRequired && Boolean(uid);
}
```

- [ ] **Step 3: Add owner filters to all admin queries**

For authenticated mode, add:

```ts
where('ownerId', '==', user.uid)
```

before `orderBy(...)` in dashboard, tests, and results queries. In compatibility mode, retain the existing unfiltered query until migration is complete.

On test creation set:

```ts
ownerId: user?.uid || ''
```

When authentication is required, reject saves without `user.uid`. On edit/result detail, verify `record.ownerId === user.uid` before rendering.

- [ ] **Step 4: Generate new links from the custom domain**

Create:

```ts
const publicBaseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
```

Use it for newly copied links. Add `VITE_PUBLIC_APP_URL="https://diagnostic.click"` to `.env.example`. Existing Vercel links remain valid because the route and slug do not change.

- [ ] **Step 5: Run checks**

Run:

```bash
npm test -- src/lib/tutor-query.test.ts
npm run lint
npm run build
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tutor-query.ts src/lib/tutor-query.test.ts src/pages .env.example
git commit -m "Scope dashboard data to tutors"
```

### Task 7: Email the Owning Tutor with a Secure Result Link

**Files:**
- Create: `api/_email.ts`
- Create: `api/_email.test.ts`
- Create: `api/public/result-notification.ts`
- Create: `api/public/result-notification.test.ts`
- Modify: `api/public/submit-result.ts`

- [ ] **Step 1: Write the failing email payload test**

Create `api/_email.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildResultEmail } from './_email';

describe('buildResultEmail', () => {
  it('notifies the owning tutor with the exact result link and no report data', () => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'tutor@example.com', displayName: 'Tutor' },
      result: {
        studentFullName: 'Sam Lee',
        testTitle: '11+ Diagnostic',
        completedAt: Date.UTC(2026, 5, 27, 12, 30),
      },
      resultId: 'result-1',
      appBaseUrl: 'https://diagnostic.click/',
    });

    expect(email.to).toEqual(['tutor@example.com']);
    expect(email.subject).toContain('Sam Lee');
    expect(email.html).toContain('11+ Diagnostic');
    expect(email.html).toContain('https://diagnostic.click/results/result-1');
    expect(email.html).not.toMatch(/score|percentage/i);
    expect(email).not.toHaveProperty('attachments');
  });

  it('escapes student and test names before inserting them into HTML', () => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'tutor@example.com', displayName: 'Tutor' },
      result: {
        studentFullName: '<Sam & Lee>',
        testTitle: '"11+" <script>',
        completedAt: 0,
      },
      resultId: 'result/1',
      appBaseUrl: 'https://diagnostic.click',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;Sam &amp; Lee&gt;');
    expect(email.html).toContain('/results/result%2F1');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- api/_email.test.ts
```

Expected: FAIL because `api/_email.ts` does not exist.

- [ ] **Step 3: Build the safe email payload**

Create `api/_email.ts`:

```ts
import { Resend } from 'resend';
import type { TestResult, TutorProfile } from '../src/types.js';

type TutorRecipient = Pick<TutorProfile, 'email' | 'displayName'>;
type CompletedResult = Pick<TestResult, 'studentFullName' | 'testTitle' | 'completedAt'>;

interface ResultEmailInput {
  from: string;
  tutor: TutorRecipient;
  result: CompletedResult;
  resultId: string;
  appBaseUrl: string;
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function buildResultEmail(input: ResultEmailInput) {
  const baseUrl = input.appBaseUrl.replace(/\/+$/, '');
  const resultUrl = `${baseUrl}/results/${encodeURIComponent(input.resultId)}`;
  const studentName = escapeHtml(input.result.studentFullName);
  const testTitle = escapeHtml(input.result.testTitle);
  const completionDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(input.result.completedAt));

  return {
    from: input.from,
    to: [input.tutor.email],
    subject: `Diagnostic completed: ${singleLine(input.result.studentFullName)}`,
    html: `<p>${studentName} completed ${testTitle} on ${completionDate}.</p>
      <p><a href="${resultUrl}">View completed result</a></p>`,
    text: `${input.result.studentFullName} completed ${input.result.testTitle} on ${completionDate}.\n\nView completed result: ${resultUrl}`,
  };
}

export function notificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendResultEmail(
  tutor: TutorRecipient,
  result: CompletedResult,
  resultId: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Result email is not configured.');
  }

  const resend = new Resend(apiKey);
  const response = await resend.emails.send(
    buildResultEmail({
      from,
      tutor,
      result,
      resultId,
      appBaseUrl: process.env.APP_BASE_URL || 'https://diagnostic.click',
    }),
    { idempotencyKey: `result-completed/${resultId}` },
  );

  if (response.error) {
    throw new Error(`Resend failed: ${response.error.message}`);
  }

  return response.data;
}
```

The payload deliberately contains no score, percentage, answer data, or attachment. The result ID is encoded before it enters the URL, and student-controlled text is HTML-escaped.

- [ ] **Step 4: Write failing notification-state tests**

Extend `api/_email.test.ts`:

```ts
import {
  failedNotificationUpdate,
  sentNotificationUpdate,
} from './_email';

it('builds bounded notification status updates', () => {
  expect(sentNotificationUpdate(1234)).toEqual({
    notificationStatus: 'sent',
    notificationSentAt: 1234,
    notificationError: '',
  });

  const failed = failedNotificationUpdate(new Error('x'.repeat(1_000)));
  expect(failed.notificationStatus).toBe('failed');
  expect(failed.notificationError.length).toBeLessThanOrEqual(300);
});
```

- [ ] **Step 5: Run the notification-state test to verify it fails**

Run:

```bash
npm test -- api/_email.test.ts
```

Expected: FAIL because the status-update helpers are not exported.

- [ ] **Step 6: Implement bounded notification updates**

Add to `api/_email.ts`:

```ts
export function sentNotificationUpdate(notificationSentAt: number) {
  return {
    notificationStatus: 'sent' as const,
    notificationSentAt,
    notificationError: '',
  };
}

export function failedNotificationUpdate(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown email delivery error.';
  return {
    notificationStatus: 'failed' as const,
    notificationError: message.slice(0, 300),
  };
}
```

- [ ] **Step 7: Write failing delivery-orchestration tests**

Create `api/public/result-notification.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { notifyTutorOfResult } from './result-notification';

const result = {
  ownerId: 'tutor-1',
  studentFullName: 'Sam Lee',
  testTitle: '11+ Diagnostic',
  completedAt: 123,
};

describe('notifyTutorOfResult', () => {
  it('emails the owning tutor and records sent status', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'email-1' });
    const update = vi.fn().mockResolvedValue(undefined);

    await notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      {
        loadTutor: vi.fn().mockResolvedValue({
          email: 'tutor@example.com',
          displayName: 'Tutor',
        }),
        send,
        update,
        now: () => 456,
        log: vi.fn(),
      },
    );

    expect(send).toHaveBeenCalledWith(
      { email: 'tutor@example.com', displayName: 'Tutor' },
      result,
      'result-1',
    );
    expect(update).toHaveBeenCalledWith({
      notificationStatus: 'sent',
      notificationSentAt: 456,
      notificationError: '',
    });
  });

  it('records failure without rejecting the saved submission', async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      {
        loadTutor: vi.fn().mockResolvedValue({
          email: 'tutor@example.com',
          displayName: 'Tutor',
        }),
        send: vi.fn().mockRejectedValue(new Error('provider unavailable')),
        update,
        now: () => 456,
        log: vi.fn(),
      },
    )).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith({
      notificationStatus: 'failed',
      notificationError: 'provider unavailable',
    });
  });

  it('does nothing when notifications are not configured', async () => {
    const loadTutor = vi.fn();

    await notifyTutorOfResult(
      { enabled: false, resultId: 'result-1', result },
      {
        loadTutor,
        send: vi.fn(),
        update: vi.fn(),
        now: () => 456,
        log: vi.fn(),
      },
    );

    expect(loadTutor).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run the delivery test to verify it fails**

Run:

```bash
npm test -- api/public/result-notification.test.ts
```

Expected: FAIL because `api/public/result-notification.ts` does not exist.

- [ ] **Step 9: Implement isolated delivery orchestration**

Create `api/public/result-notification.ts`:

```ts
import type { TestResult, TutorProfile } from '../../src/types.js';
import {
  failedNotificationUpdate,
  sentNotificationUpdate,
} from '../_email.js';

type TutorRecipient = Pick<TutorProfile, 'email' | 'displayName'>;
type CompletedResult = Pick<
  TestResult,
  'ownerId' | 'studentFullName' | 'testTitle' | 'completedAt'
>;

interface NotificationInput {
  enabled: boolean;
  resultId: string;
  result: CompletedResult;
}

interface NotificationDependencies {
  loadTutor(ownerId: string): Promise<TutorRecipient | null>;
  send(
    tutor: TutorRecipient,
    result: CompletedResult,
    resultId: string,
  ): Promise<unknown>;
  update(fields: Record<string, unknown>): Promise<unknown>;
  now(): number;
  log(message: string, error: unknown): void;
}

export async function notifyTutorOfResult(
  input: NotificationInput,
  dependencies: NotificationDependencies,
) {
  if (!input.enabled) return;

  try {
    if (!input.result.ownerId) {
      throw new Error('The completed test has no tutor owner.');
    }

    const tutor = await dependencies.loadTutor(input.result.ownerId);
    if (!tutor?.email) {
      throw new Error('The owning tutor profile has no notification email.');
    }

    await dependencies.send(tutor, input.result, input.resultId);
  } catch (error) {
    try {
      await dependencies.update(failedNotificationUpdate(error));
    } catch (statusError) {
      dependencies.log('Result email failure status could not be saved.', statusError);
    }
    return;
  }

  try {
    await dependencies.update(sentNotificationUpdate(dependencies.now()));
  } catch (statusError) {
    dependencies.log('Result email sent but its status could not be saved.', statusError);
  }
}
```

- [ ] **Step 10: Wire delivery after durable result storage**

In `api/public/submit-result.ts`, after `resultRef.create(result)` succeeds:

```ts
await notifyTutorOfResult(
  {
    enabled: notificationsConfigured(),
    resultId: resultRef.id,
    result,
  },
  {
    async loadTutor(ownerId) {
      const tutorSnapshot = await db.collection('tutors').doc(ownerId).get();
      const tutor = tutorSnapshot.data();
      if (!tutorSnapshot.exists || typeof tutor?.email !== 'string') return null;
      return {
        email: tutor.email,
        displayName: typeof tutor.displayName === 'string' ? tutor.displayName : tutor.email,
      };
    },
    send: sendResultEmail,
    update: fields => resultRef.update(fields),
    now: Date.now,
    log: (message, error) => console.error(message, error),
  },
);
```

Import `notificationsConfigured` and `sendResultEmail` from `../_email.js`, and `notifyTutorOfResult` from `./result-notification.js`.

Do not attempt email before the result exists. When email is not configured during the compatibility release, leave `notificationStatus` as `pending`. Delivery and status-update failures are contained inside `notifyTutorOfResult`, so the handler still returns `{ resultId }` to the student.

- [ ] **Step 11: Run focused and full checks**

Run:

```bash
npm test -- api/_email.test.ts api/public/result-notification.test.ts api/public/submit-result.test.ts
npm test
npm run lint
npm run build
```

Expected: all exit 0. The existing browser PDF implementation and tests remain unchanged.

- [ ] **Step 12: Commit**

```bash
git add api/_email.ts api/_email.test.ts api/public/result-notification.ts api/public/result-notification.test.ts api/public/submit-result.ts
git commit -m "Email tutors when diagnostics complete"
```

### Task 8: Add Migration Script and Private Firestore Rules

**Files:**
- Create: `scripts/migrate-existing-owner.ts`
- Modify: `firestore.rules`
- Create: `firestore.rules.test.md`

- [ ] **Step 1: Add a dry-run migration script**

Create `scripts/migrate-existing-owner.ts` accepting:

```bash
npx tsx scripts/migrate-existing-owner.ts --owner-email roxana.scurtu@yahoo.com --dry-run
```

The script:

- Looks up the Firebase user by email through Admin Auth.
- Prints the UID and counts of `tests` and `testResults` without `ownerId`.
- With the explicit `--apply` mode, batch-updates those documents with Roxana's UID.
- Never changes IDs, slugs, questions, results, or timestamps.
- Prints before/after counts and exits non-zero if any record remains ownerless.

- [ ] **Step 2: Write ownership rules**

Replace the open rule with:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function ownsExisting() {
      return signedIn() && resource.data.ownerId == request.auth.uid;
    }

    function ownsIncoming() {
      return signedIn() && request.resource.data.ownerId == request.auth.uid;
    }

    match /tests/{testId} {
      allow read, update, delete: if ownsExisting();
      allow create: if ownsIncoming();
    }

    match /testResults/{resultId} {
      allow read, update: if ownsExisting();
      allow create, delete: if false;
    }

    match /tutors/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow write: if false;
    }

    match /testTemplates/{templateId} {
      allow read, write: if false;
    }
  }
}
```

Public tests and submissions use Firebase Admin through Vercel APIs, so direct unauthenticated Firestore access is no longer required.

- [ ] **Step 3: Document rule verification cases**

Create `firestore.rules.test.md` listing explicit emulator cases:

- Tutor A can read/update Tutor A test.
- Tutor A cannot read/update Tutor B test.
- Unauthenticated user cannot read results.
- Browser cannot create results.
- Browser cannot modify tutor profiles or templates.

- [ ] **Step 4: Run migration dry-run only**

Run:

```bash
npx tsx scripts/migrate-existing-owner.ts --owner-email roxana.scurtu@yahoo.com --dry-run
```

Expected: prints counts and makes no writes.

- [ ] **Step 5: Commit without deploying rules**

```bash
git add scripts/migrate-existing-owner.ts firestore.rules firestore.rules.test.md
git commit -m "Prepare tutor data migration and rules"
```

Do not deploy the new rules in this task.

### Task 9: Compatibility Release and Owner Migration

**Files:**
- Modify: Vercel environment only
- Modify: Firebase Authentication provider settings
- Modify: Firebase authorized domains
- Modify: Firestore data through reviewed scripts

- [ ] **Step 1: Configure Firebase Authentication**

Enable:

- Email/password
- Google

Add authorized domains:

- `diagnostic.click`
- `tutor-diagnostic.vercel.app`
- `localhost`

- [ ] **Step 2: Configure compatibility environment**

Add these values interactively in Vercel Production and Preview:

```bash
printf 'false' | npx vercel env add VITE_AUTH_REQUIRED production
printf 'https://diagnostic.click' | npx vercel env add VITE_PUBLIC_APP_URL production
printf 'https://diagnostic.click' | npx vercel env add APP_BASE_URL production
npx vercel env add FIREBASE_PROJECT_ID production
npx vercel env add FIREBASE_CLIENT_EMAIL production
npx vercel env add FIREBASE_PRIVATE_KEY production
```

Repeat for Preview. Paste the Firebase service-account values only into the hidden Vercel prompts. Do not add or log secret values in Git.

- [ ] **Step 3: Seed templates**

Run:

```bash
npx tsx scripts/seed-test-templates.ts
```

Expected: exactly two `testTemplates` documents, with source tests unchanged.

- [ ] **Step 4: Deploy the compatibility release**

Run:

```bash
npm test
npm run lint
npm run build
npx vercel deploy --prod
```

Expected: deployment succeeds while dashboard remains accessible as before.

- [ ] **Step 5: Verify old student links before account creation**

Open an existing URL on:

```text
https://tutor-diagnostic.vercel.app/test/<existing-slug>
```

Expected: test intro loads. Do not submit the student's real pending test.

- [ ] **Step 6: Create Roxana's account**

Register `roxana.scurtu@yahoo.com` through the production account page. Verify exactly two personal starter tests are created.

- [ ] **Step 7: Run and review migration**

Run dry-run first:

```bash
npx tsx scripts/migrate-existing-owner.ts --owner-email roxana.scurtu@yahoo.com --dry-run
```

After reviewing counts, run:

```bash
npx tsx scripts/migrate-existing-owner.ts --owner-email roxana.scurtu@yahoo.com --apply
```

Expected: every pre-existing test and result has Roxana's UID; no IDs or slugs change.

- [ ] **Step 8: Verify owner data**

Sign in as Roxana and compare:

- Test count and titles against pre-migration data.
- Result count and student names against pre-migration data.
- Existing result detail and PDF download.
- Existing Vercel-domain test link.

Stop rollout if any record is missing.

### Task 10: Security and Email Release

**Files:**
- Modify: Vercel environment only
- Deploy: `firestore.rules`
- Configure: Resend domain

- [ ] **Step 1: Verify the sending domain in Resend**

Add Resend's required SPF and DKIM records for `mail.diagnostic.click` in Vercel DNS. Wait until Resend reports the domain verified.

- [ ] **Step 2: Add email environment variables**

Add the sender directly and enter the API key through Vercel's hidden prompt:

```bash
printf 'Diagnostic Click <reports@mail.diagnostic.click>' | npx vercel env add EMAIL_FROM production
npx vercel env add RESEND_API_KEY production
printf 'https://diagnostic.click' | npx vercel env add APP_BASE_URL production
```

- [ ] **Step 3: Enable authenticated dashboard**

Set:

```text
VITE_AUTH_REQUIRED=true
```

Deploy a new production build. Do not redeploy a prebuilt deployment.

- [ ] **Step 4: Deploy private Firestore rules**

Deploy `firestore.rules` only after Task 9 confirms Roxana owns every existing record and can see them.

- [ ] **Step 5: Run end-to-end verification with a disposable test**

Create a new tutor-owned test titled `Notification Smoke Test`, copy its exact generated slug from the Tests page, and complete it once through the Diagnostic Click URL. Then open the same slug on the Vercel origin to verify backward compatibility without creating another submission:

1. Copy the Diagnostic Click URL from the Tests page.
2. Open the same slug by replacing only the origin with `https://tutor-diagnostic.vercel.app`.

Expected:

- The Diagnostic Click submission creates one result.
- Result belongs to the tutor.
- Tutor receives one Diagnostic Click email.
- Email contains the student name, test title, completion date, and no score or attachment.
- The email button links to the exact completed result.
- The result link requires login and returns to the correct result.
- The Vercel-origin test intro still loads the same test.
- The existing dashboard PDF download still works after login.

- [ ] **Step 6: Verify account isolation**

Create a disposable second tutor account. Confirm it receives exactly two editable starter tests and cannot query, open, edit, or delete Roxana's tests or results.

- [ ] **Step 7: Run final checks**

Run:

```bash
npm test
npm run lint
npm run build
git status -sb
```

Expected: all checks pass and only intentional deployment metadata, if any, is uncommitted.

- [ ] **Step 8: Commit final configuration documentation**

Update `README.md` with account setup, environment variables, domains, migration order, and Resend verification. Then:

```bash
git add README.md
git commit -m "Document Diagnostic Click account rollout"
git push origin main
```

## Rollback Rules

- If an old public link fails, restore the previous production deployment immediately; do not migrate slugs.
- If Roxana cannot see all existing records, keep `VITE_AUTH_REQUIRED=false` and do not deploy private Firestore rules.
- If email fails, leave result storage enabled and set notification status to `failed`; do not make student submission depend on email delivery.
- Never delete old tests or results as part of rollback.
