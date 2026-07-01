import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const FIRESTORE_DATABASE_ID = 'ai-studio-1ba9c379-e91f-45ca-b2e0-7aaee16eb4fa';

let app: App | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Firebase Admin.`);
  }

  return value;
}

export function getAdminApp() {
  if (app) return app;

  const projectId = requiredEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requiredEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = requiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });

  return app;
}

export function getAdminAuth() {
  auth ??= getAuth(getAdminApp());
  return auth;
}

export function getAdminDb() {
  db ??= getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
  return db;
}
