import { describe, expect, it } from 'vitest';
import {
  buildWriteBatches,
  findOwnerConflicts,
  isOwnerless,
  parseArgs,
  runMigration,
  selectOwnerless,
  type MigrationRecord,
} from './migrate-existing-owner.js';

describe('parseArgs', () => {
  it('accepts exactly one owner email and exactly one explicit mode', () => {
    expect(parseArgs(['--owner-email', ' roxana.scurtu@yahoo.com ', '--dry-run'])).toEqual({
      ownerEmail: 'roxana.scurtu@yahoo.com',
      mode: 'dry-run',
    });
    expect(parseArgs(['--owner-email=roxana.scurtu@yahoo.com', '--apply'])).toEqual({
      ownerEmail: 'roxana.scurtu@yahoo.com',
      mode: 'apply',
    });
  });

  it.each([
    { args: [], message: 'Exactly one non-empty --owner-email is required.' },
    { args: ['--owner-email', '   '], message: 'Exactly one non-empty --owner-email is required.' },
    {
      args: ['--owner-email', 'first@example.com', '--owner-email', 'second@example.com'],
      message: 'Exactly one non-empty --owner-email is required.',
    },
    {
      args: ['--owner-email', 'owner@example.com', '--unexpected'],
      message: 'Unknown argument: --unexpected',
    },
    {
      args: ['--owner-email', 'owner@example.com', 'extra'],
      message: 'Unknown argument: extra',
    },
    {
      args: ['--owner-email', 'owner@example.com'],
      message: 'Exactly one mode is required: --dry-run or --apply.',
    },
    {
      args: ['--owner-email', 'owner@example.com', '--dry-run', '--apply'],
      message: 'Exactly one mode is required: --dry-run or --apply.',
    },
  ])('rejects invalid arguments: $args', ({ args, message }) => {
    expect(() => parseArgs(args)).toThrow(message);
  });
});

describe('ownerless record detection', () => {
  const records: MigrationRecord[] = [
    { id: 'missing', data: { title: 'Missing owner' } },
    { id: 'null', data: { ownerId: null } },
    { id: 'number', data: { ownerId: 42 } },
    { id: 'blank', data: { ownerId: '   ' } },
    { id: 'owned', data: { ownerId: 'uid-existing' } },
  ];

  it('treats missing, non-string, and blank ownerId values as ownerless', () => {
    expect(records.map(record => isOwnerless(record.data))).toEqual([true, true, true, true, false]);
  });

  it('selects only ownerless records without selecting an existing owner', () => {
    expect(selectOwnerless(records).map(record => record.id)).toEqual([
      'missing',
      'null',
      'number',
      'blank',
    ]);
  });
});

describe('findOwnerConflicts', () => {
  it('returns only records with a non-empty owner different from the selected UID', () => {
    const records: MigrationRecord[] = [
      { id: 'missing', data: {} },
      { id: 'blank', data: { ownerId: '   ' } },
      { id: 'same', data: { ownerId: 'roxana-uid' } },
      { id: 'foreign', data: { ownerId: 'another-uid' } },
    ];

    expect(findOwnerConflicts(records, 'roxana-uid').map(record => record.id)).toEqual(['foreign']);
  });
});

describe('buildWriteBatches', () => {
  const records = Array.from({ length: 901 }, (_, index): MigrationRecord => ({
    id: `record-${index}`,
    data: { ownerId: index % 2 === 0 ? undefined : 'already-owned' },
  }));

  it('produces no writes during a dry run', () => {
    expect(buildWriteBatches(records, 'dry-run')).toEqual([]);
  });

  it('chunks only ownerless records into batches no larger than 450', () => {
    const batches = buildWriteBatches(records, 'apply');

    expect(batches.map(batch => batch.length)).toEqual([450, 1]);
    expect(batches.flat().map(record => record.id)).toEqual(
      records.filter(record => Number(record.id.slice('record-'.length)) % 2 === 0).map(record => record.id),
    );
  });
});

describe('runMigration', () => {
  it('reads and validates both collections before committing bounded apply batches', async () => {
    const events: string[] = [];
    const records = new Map<string, MigrationRecord[]>([
      ['tests', Array.from({ length: 451 }, (_, index) => ({ id: `test-${index}`, data: {} }))],
      ['testResults', [{ id: 'result-1', data: { ownerId: 'roxana-uid' } }]],
    ]);

    await runMigration(
      { ownerEmail: 'roxana@example.com', mode: 'apply' },
      {
        projectId: 'project-id',
        databaseId: 'named-database',
        getOwnerUid: async () => 'roxana-uid',
        readCollection: async collection => {
          events.push(`read:${collection}`);
          return records.get(collection) ?? [];
        },
        commitOwnerBatch: async (collection, batch) => {
          events.push(`commit:${collection}:${batch.length}`);
          for (const record of batch) {
            record.data.ownerId = 'roxana-uid';
          }
        },
        log: message => events.push(`log:${message}`),
      },
    );

    expect(events.slice(0, 7)).toEqual([
      'log:Project ID: project-id',
      'log:Firestore database ID: named-database',
      'log:Owner UID: roxana-uid',
      'log:Mode: apply',
      'read:tests',
      'read:testResults',
      'log:tests: 451 ownerless before migration.',
    ]);
    expect(events.indexOf('read:testResults')).toBeLessThan(events.indexOf('commit:tests:450'));
    expect(events).toContain('log:tests batch 1/2 committed.');
    expect(events).toContain('log:tests batch 2/2 committed.');
  });

  it('aborts before all writes when either collection contains a foreign owner', async () => {
    const commits: string[] = [];

    await expect(runMigration(
      { ownerEmail: 'roxana@example.com', mode: 'apply' },
      {
        projectId: 'project-id',
        databaseId: 'named-database',
        getOwnerUid: async () => 'roxana-uid',
        readCollection: async collection => collection === 'tests'
          ? [{ id: 'ownerless-test', data: {} }]
          : [{ id: 'foreign-result', data: { ownerId: 'another-uid' } }],
        commitOwnerBatch: async collection => {
          commits.push(collection);
        },
        log: () => undefined,
      },
    )).rejects.toThrow('Migration aborted: found 1 record owned by a different UID in testResults.');
    expect(commits).toEqual([]);
  });
});
