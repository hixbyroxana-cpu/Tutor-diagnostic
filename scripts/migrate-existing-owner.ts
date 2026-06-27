import { pathToFileURL } from 'node:url';
import type {
  DocumentReference,
  Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../api/_firebase-admin.js';

const COLLECTIONS = ['tests', 'testResults'] as const;
const MAX_BATCH_SIZE = 450;

export interface MigrationArgs {
  ownerEmail: string;
  dryRun: boolean;
}

export interface MigrationRecord {
  id: string;
  data: Record<string, unknown>;
}

interface LoadedMigrationRecord extends MigrationRecord {
  ref: DocumentReference;
  updateTime: Timestamp;
}

export function parseArgs(args: string[]): MigrationArgs {
  const ownerEmails: string[] = [];
  let dryRun = false;

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

    if (argument === '--dry-run' && !dryRun) {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (ownerEmails.length !== 1 || !ownerEmails[0]) {
    throw new Error('Exactly one non-empty --owner-email is required.');
  }

  return { ownerEmail: ownerEmails[0], dryRun };
}

export function isOwnerless(data: Record<string, unknown>) {
  return typeof data.ownerId !== 'string' || data.ownerId.trim().length === 0;
}

export function selectOwnerless<T extends MigrationRecord>(records: T[]) {
  return records.filter(record => isOwnerless(record.data));
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

export function buildWriteBatches<T extends MigrationRecord>(records: T[], dryRun: boolean) {
  return dryRun ? [] : chunkRecords(selectOwnerless(records));
}

async function readCollection(db: Firestore, collectionName: string) {
  const snapshot = await db.collection(collectionName).get();

  return snapshot.docs.map((document): LoadedMigrationRecord => ({
    id: document.id,
    data: document.data(),
    ref: document.ref,
    updateTime: document.updateTime,
  }));
}

async function assignOwner(
  db: Firestore,
  records: LoadedMigrationRecord[],
  ownerId: string,
) {
  for (const recordsBatch of buildWriteBatches(records, false)) {
    const batch = db.batch();

    for (const record of recordsBatch) {
      batch.update(record.ref, { ownerId }, { lastUpdateTime: record.updateTime });
    }

    await batch.commit();
  }
}

export async function main(args = process.argv.slice(2)) {
  const { ownerEmail, dryRun } = parseArgs(args);
  const owner = await getAdminAuth().getUserByEmail(ownerEmail);
  const db = getAdminDb();

  console.log(`Owner UID: ${owner.uid}`);

  const before = new Map<string, number>();
  for (const collectionName of COLLECTIONS) {
    const records = await readCollection(db, collectionName);
    const ownerless = selectOwnerless(records);
    before.set(collectionName, ownerless.length);
    console.log(`${collectionName}: ${ownerless.length} ownerless before migration.`);

    if (!dryRun) {
      await assignOwner(db, ownerless, owner.uid);
    }
  }

  if (dryRun) {
    console.log('Dry run complete. No writes performed.');
    return;
  }

  let remainingOwnerless = 0;
  for (const collectionName of COLLECTIONS) {
    const records = await readCollection(db, collectionName);
    const afterCount = selectOwnerless(records).length;
    remainingOwnerless += afterCount;
    console.log(
      `${collectionName}: ${before.get(collectionName) ?? 0} ownerless before, ${afterCount} after migration.`,
    );
  }

  if (remainingOwnerless > 0) {
    throw new Error(`Migration incomplete: ${remainingOwnerless} ownerless records remain.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
