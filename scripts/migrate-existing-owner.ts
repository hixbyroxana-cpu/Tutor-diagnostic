import { pathToFileURL } from 'node:url';
import type {
  DocumentReference,
  Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  FIRESTORE_DATABASE_ID,
  getAdminApp,
  getAdminAuth,
  getAdminDb,
} from '../api/_firebase-admin.js';

const COLLECTIONS = ['tests', 'testResults'] as const;
const MAX_BATCH_SIZE = 450;
type CollectionName = typeof COLLECTIONS[number];
export type MigrationMode = 'dry-run' | 'apply';

export interface MigrationArgs {
  ownerEmail: string;
  mode: MigrationMode;
}

export interface MigrationRecord {
  id: string;
  data: Record<string, unknown>;
}

interface LoadedMigrationRecord extends MigrationRecord {
  ref: DocumentReference;
  updateTime: Timestamp;
}

export interface MigrationDependencies<T extends MigrationRecord> {
  projectId: string;
  databaseId: string;
  getOwnerUid: (email: string) => Promise<string>;
  readCollection: (collection: CollectionName) => Promise<T[]>;
  commitOwnerBatch: (
    collection: CollectionName,
    records: T[],
    ownerId: string,
  ) => Promise<void>;
  log: (message: string) => void;
}

export function parseArgs(args: string[]): MigrationArgs {
  const ownerEmails: string[] = [];
  const modes: MigrationMode[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--owner-email') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        ownerEmails.push('');
      } else {
        ownerEmails.push(value.trim());
        index += 1;
      }
      continue;
    }

    if (argument.startsWith('--owner-email=')) {
      ownerEmails.push(argument.slice('--owner-email='.length).trim());
      continue;
    }

    if (argument === '--dry-run') {
      modes.push('dry-run');
      continue;
    }

    if (argument === '--apply') {
      modes.push('apply');
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (ownerEmails.length !== 1 || !ownerEmails[0]) {
    throw new Error('Exactly one non-empty --owner-email is required.');
  }

  if (modes.length !== 1) {
    throw new Error('Exactly one mode is required: --dry-run or --apply.');
  }

  return { ownerEmail: ownerEmails[0], mode: modes[0] };
}

export function isOwnerless(data: Record<string, unknown>) {
  return typeof data.ownerId !== 'string' || data.ownerId.trim().length === 0;
}

export function selectOwnerless<T extends MigrationRecord>(records: T[]) {
  return records.filter(record => isOwnerless(record.data));
}

export function findOwnerConflicts<T extends MigrationRecord>(records: T[], ownerId: string) {
  return records.filter(record => {
    const existingOwnerId = record.data.ownerId;
    return typeof existingOwnerId === 'string'
      && existingOwnerId.trim().length > 0
      && existingOwnerId !== ownerId;
  });
}

export function chunkRecords<T>(records: T[], size = MAX_BATCH_SIZE) {
  if (!Number.isInteger(size) || size < 1 || size > MAX_BATCH_SIZE) {
    throw new Error(`Batch size must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < records.length; index += size) {
    chunks.push(records.slice(index, index + size));
  }
  return chunks;
}

export function buildWriteBatches<T extends MigrationRecord>(
  records: T[],
  mode: MigrationMode,
) {
  return mode === 'dry-run' ? [] : chunkRecords(selectOwnerless(records));
}

async function readCollection(db: Firestore, collectionName: string) {
  const snapshot = await db.collection(collectionName).select('ownerId').get();

  return snapshot.docs.map((document): LoadedMigrationRecord => ({
    id: document.id,
    data: document.data(),
    ref: document.ref,
    updateTime: document.updateTime,
  }));
}

function conflictError(collection: CollectionName, count: number) {
  const noun = count === 1 ? 'record' : 'records';
  return new Error(
    `Migration aborted: found ${count} ${noun} owned by a different UID in ${collection}.`,
  );
}

export async function runMigration<T extends MigrationRecord>(
  args: MigrationArgs,
  dependencies: MigrationDependencies<T>,
) {
  const ownerId = await dependencies.getOwnerUid(args.ownerEmail);
  dependencies.log(`Project ID: ${dependencies.projectId}`);
  dependencies.log(`Firestore database ID: ${dependencies.databaseId}`);
  dependencies.log(`Owner UID: ${ownerId}`);
  dependencies.log(`Mode: ${args.mode}`);

  const initialEntries = await Promise.all(COLLECTIONS.map(async collection => [
    collection,
    await dependencies.readCollection(collection),
  ] as const));
  const initialRecords = new Map<CollectionName, T[]>(initialEntries);

  for (const collection of COLLECTIONS) {
    const conflicts = findOwnerConflicts(initialRecords.get(collection) ?? [], ownerId);
    if (conflicts.length > 0) {
      throw conflictError(collection, conflicts.length);
    }
  }

  for (const collection of COLLECTIONS) {
    const records = initialRecords.get(collection) ?? [];
    dependencies.log(
      `${collection}: ${selectOwnerless(records).length} ownerless before migration.`,
    );
  }

  if (args.mode === 'dry-run') {
    dependencies.log('Dry run complete. No writes performed.');
    return;
  }

  for (const collection of COLLECTIONS) {
    const batches = buildWriteBatches(initialRecords.get(collection) ?? [], args.mode);
    for (const [index, batch] of batches.entries()) {
      await dependencies.commitOwnerBatch(collection, batch, ownerId);
      dependencies.log(`${collection} batch ${index + 1}/${batches.length} committed.`);
    }
  }

  const finalEntries = await Promise.all(COLLECTIONS.map(async collection => [
    collection,
    await dependencies.readCollection(collection),
  ] as const));
  let remainingOwnerless = 0;
  for (const [collection, records] of finalEntries) {
    const afterCount = selectOwnerless(records).length;
    remainingOwnerless += afterCount;
    dependencies.log(
      `${collection}: ${selectOwnerless(initialRecords.get(collection) ?? []).length} ownerless before, ${afterCount} after migration.`,
    );

    const conflicts = findOwnerConflicts(records, ownerId);
    if (conflicts.length > 0) {
      throw conflictError(collection, conflicts.length);
    }
  }

  if (remainingOwnerless > 0) {
    throw new Error(`Migration incomplete: ${remainingOwnerless} ownerless records remain.`);
  }
}

export async function main(args = process.argv.slice(2)) {
  const parsedArgs = parseArgs(args);
  const app = getAdminApp();
  const projectId = app.options.projectId;
  if (!projectId) {
    throw new Error('Firebase Admin project ID is unavailable.');
  }

  const auth = getAdminAuth();
  const db = getAdminDb();

  await runMigration(parsedArgs, {
    projectId,
    databaseId: FIRESTORE_DATABASE_ID,
    getOwnerUid: async email => (await auth.getUserByEmail(email)).uid,
    readCollection: collection => readCollection(db, collection),
    commitOwnerBatch: async (_collection, records, ownerId) => {
      const batch = db.batch();
      for (const record of records) {
        batch.update(record.ref, { ownerId }, { lastUpdateTime: record.updateTime });
      }
      await batch.commit();
    },
    log: message => console.log(message),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
