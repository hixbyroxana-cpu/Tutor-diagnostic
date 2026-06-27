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
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getFirestore,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
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
      createdAt: 1_765_000_000_000,
    }),
    db.doc('tests/other-test').set({
      ownerId: 'tutor-b',
      title: 'Other test',
      createdAt: 1_764_000_000_000,
    }),
    db.doc('tests/owned-test-older').set({
      ownerId: 'tutor-a',
      title: 'Older owned test',
      createdAt: 1_763_000_000_000,
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
    db.doc('testResults/other-result').set({
      ownerId: 'tutor-b',
      parentSummary: 'Other summary',
      score: 7,
      completedAt: 1_764_000_000_000,
      notificationStatus: 'sent',
    }),
    db.doc('testResults/owned-result-older').set({
      ownerId: 'tutor-a',
      parentSummary: 'Older owned summary',
      score: 6,
      completedAt: 1_763_000_000_000,
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

describe('production list query rules', () => {
  it('permits Tutor A tests query and returns only Tutor A records', async () => {
    const db = clientDb('tutor-a');
    const ownerQuery = query(
      collection(db, 'tests'),
      where('ownerId', '==', 'tutor-a'),
      orderBy('createdAt', 'desc'),
    );

    const snapshot = await assertSucceeds(getDocs(ownerQuery));

    expect(snapshot.docs.map(document => document.id)).toEqual([
      'owned-test',
      'owned-test-older',
    ]);
    expect(snapshot.docs.every(document => document.data().ownerId === 'tutor-a')).toBe(true);
  });

  it('permits Tutor A results query and returns only Tutor A records', async () => {
    const db = clientDb('tutor-a');
    const ownerQuery = query(
      collection(db, 'testResults'),
      where('ownerId', '==', 'tutor-a'),
      orderBy('completedAt', 'desc'),
    );

    const snapshot = await assertSucceeds(getDocs(ownerQuery));

    expect(snapshot.docs.map(document => document.id)).toEqual([
      'owned-result',
      'owned-result-older',
    ]);
    expect(snapshot.docs.every(document => document.data().ownerId === 'tutor-a')).toBe(true);
  });

  it('denies unfiltered tests and results queries', async () => {
    const db = clientDb('tutor-a');

    await assertFails(getDocs(query(collection(db, 'tests'), orderBy('createdAt', 'desc'))));
    await assertFails(
      getDocs(query(collection(db, 'testResults'), orderBy('completedAt', 'desc'))),
    );
  });

  it('denies Tutor A querying Tutor B tests and results', async () => {
    const db = clientDb('tutor-a');

    await assertFails(getDocs(query(
      collection(db, 'tests'),
      where('ownerId', '==', 'tutor-b'),
      orderBy('createdAt', 'desc'),
    )));
    await assertFails(getDocs(query(
      collection(db, 'testResults'),
      where('ownerId', '==', 'tutor-b'),
      orderBy('completedAt', 'desc'),
    )));
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
