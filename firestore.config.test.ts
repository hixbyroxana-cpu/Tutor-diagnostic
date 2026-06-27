import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIRESTORE_DATABASE_ID } from './api/_firebase-admin.js';

describe('Firebase Firestore deployment configuration', () => {
  it('targets the same named database as Firebase Admin', () => {
    const config = JSON.parse(fs.readFileSync('firebase.json', 'utf8')) as {
      firestore?: unknown;
    };

    expect(config.firestore).toEqual([
      {
        database: FIRESTORE_DATABASE_ID,
        rules: 'firestore.rules',
        indexes: 'firestore.indexes.json',
      },
    ]);
  });
});
