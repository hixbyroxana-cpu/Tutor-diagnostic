import {
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  deleteApp as deleteAdminApp,
  initializeApp as initializeAdminApp,
  type App as AdminApp,
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import {
  deleteApp,
  initializeApp,
  type FirebaseApp,
} from 'firebase/app';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest';
import { FIRESTORE_DATABASE_ID } from './api/_firebase-admin.js';

const PROJECT_ID = 'demo-tutor-rules';

const clientApps: FirebaseApp[] = [];
let adminApp: AdminApp;
let emulatorHost: string;
let emulatorPort: number;

beforeAll(() => {
  const hostAndPort = process.env.FIRESTORE_EMULATOR_HOST;
  if (!hostAndPort) {
    throw new Error('FIRESTORE_EMULATOR_HOST is required. Run npm run test:rules.');
  }

  const separator = hostAndPort.lastIndexOf(':');
  emulatorHost = hostAndPort.slice(0, separator);
  emulatorPort = Number(hostAndPort.slice(separator + 1));
  if (!emulatorHost || !Number.isInteger(emulatorPort)) {
    throw new Error(`Invalid FIRESTORE_EMULATOR_HOST: ${hostAndPort}`);
  }

  adminApp = initializeAdminApp({ projectId: PROJECT_ID }, 'firestore-rules-admin');
});

beforeEach(async () => {
  const db = getAdminFirestore(adminApp, FIRESTORE_DATABASE_ID);
  await Promise.all([
    db.doc('tests/owned-test').set({
      ownerId: 'tutor-a',
      title: 'Owned test',
    }),
    db.doc('tests/other-test').set({
      ownerId: 'tutor-b',
      title: 'Other test',
    }),
    db.doc('testResults/owned-result').set({
      ownerId: 'tutor-a',
      parentSummary: 'Original summary',
      score: 8,
      answers: [{ questionId: 'q1', answer: 'A' }],
      studentName: 'Student',
      completedAt: 1_765_000_000_000,
      notificationStatus: 'sent',
    }),
    db.doc('tutors/tutor-a').set({
      email: 'tutor-a@example.com',
    }),
    db.doc('testTemplates/template-a').set({
      title: 'Template',
    }),
    db.doc('tests/new-test').delete(),
    db.doc('testResults/new-result').delete(),
    db.doc('testTemplates/new-template').delete(),
  ]);
});

afterAll(async () => {
  await Promise.all(clientApps.map(app => deleteApp(app)));
  await deleteAdminApp(adminApp);
});

function clientDb(userId?: string) {
  const app = initializeApp(
    { projectId: PROJECT_ID },
    `firestore-rules-client-${clientApps.length}`,
  );
  clientApps.push(app);
  const db = getFirestore(app, FIRESTORE_DATABASE_ID);
  connectFirestoreEmulator(
    db,
    emulatorHost,
    emulatorPort,
    userId ? { mockUserToken: { sub: userId, user_id: userId } } : undefined,
  );
  return db;
}

describe('tests rules', () => {
  it('permits same-owner create, read, update, and delete', async () => {
    const db = clientDb('tutor-a');

    await assertSucceeds(setDoc(doc(db, 'tests/new-test'), {
      ownerId: 'tutor-a',
      title: 'New test',
    }));
    await assertSucceeds(getDoc(doc(db, 'tests/owned-test')));
    await assertSucceeds(updateDoc(doc(db, 'tests/owned-test'), { title: 'Updated' }));
    await assertSucceeds(deleteDoc(doc(db, 'tests/owned-test')));
  });

  it('denies cross-owner and unauthenticated access', async () => {
    const otherTutor = clientDb('tutor-b');
    const unauthenticated = clientDb();

    await assertFails(getDoc(doc(otherTutor, 'tests/owned-test')));
    await assertFails(updateDoc(doc(otherTutor, 'tests/owned-test'), { title: 'No' }));
    await assertFails(getDoc(doc(unauthenticated, 'tests/owned-test')));
    await assertFails(setDoc(doc(unauthenticated, 'tests/new-test'), {
      ownerId: 'tutor-a',
    }));
  });

  it('denies ownership transfer', async () => {
    const db = clientDb('tutor-a');

    await assertFails(updateDoc(doc(db, 'tests/owned-test'), { ownerId: 'tutor-b' }));
  });
});

describe('testResults rules', () => {
  it('permits owner read and parentSummary-only update', async () => {
    const db = clientDb('tutor-a');

    await assertSucceeds(getDoc(doc(db, 'testResults/owned-result')));
    await assertSucceeds(updateDoc(doc(db, 'testResults/owned-result'), {
      parentSummary: 'Updated summary',
    }));
  });

  it('denies score, notification state, and owner changes', async () => {
    const db = clientDb('tutor-a');
    const result = doc(db, 'testResults/owned-result');

    await assertFails(updateDoc(result, { score: 9 }));
    await assertFails(updateDoc(result, { notificationStatus: 'failed' }));
    await assertFails(updateDoc(result, { ownerId: 'tutor-b' }));
  });

  it('denies cross-owner and unauthenticated reads', async () => {
    const otherTutor = clientDb('tutor-b');
    const unauthenticated = clientDb();

    await assertFails(getDoc(doc(otherTutor, 'testResults/owned-result')));
    await assertFails(getDoc(doc(unauthenticated, 'testResults/owned-result')));
  });

  it('denies direct browser create and delete', async () => {
    const db = clientDb('tutor-a');

    await assertFails(setDoc(doc(db, 'testResults/new-result'), {
      ownerId: 'tutor-a',
      score: 10,
    }));
    await assertFails(deleteDoc(doc(db, 'testResults/owned-result')));
  });
});

describe('tutor and template rules', () => {
  it('permits only a tutor reading their own profile', async () => {
    const owner = clientDb('tutor-a');
    const otherTutor = clientDb('tutor-b');

    await assertSucceeds(getDoc(doc(owner, 'tutors/tutor-a')));
    await assertFails(getDoc(doc(otherTutor, 'tutors/tutor-a')));
    await assertFails(updateDoc(doc(owner, 'tutors/tutor-a'), {
      email: 'changed@example.com',
    }));
  });

  it('denies all direct template access', async () => {
    const db = clientDb('tutor-a');

    await assertFails(getDoc(doc(db, 'testTemplates/template-a')));
    await assertFails(setDoc(doc(db, 'testTemplates/new-template'), {
      title: 'New template',
    }));
  });
});
