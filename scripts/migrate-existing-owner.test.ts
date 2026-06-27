import { describe, expect, it } from 'vitest';
import {
  buildWriteBatches,
  isOwnerless,
  parseArgs,
  selectOwnerless,
  type MigrationRecord,
} from './migrate-existing-owner.js';

describe('parseArgs', () => {
  it('accepts exactly one non-empty owner email and optional dry-run', () => {
    expect(parseArgs(['--owner-email', ' roxana.scurtu@yahoo.com ', '--dry-run'])).toEqual({
      ownerEmail: 'roxana.scurtu@yahoo.com',
      dryRun: true,
    });
    expect(parseArgs(['--owner-email=roxana.scurtu@yahoo.com'])).toEqual({
      ownerEmail: 'roxana.scurtu@yahoo.com',
      dryRun: false,
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

describe('buildWriteBatches', () => {
  const records = Array.from({ length: 901 }, (_, index): MigrationRecord => ({
    id: `record-${index}`,
    data: { ownerId: index % 2 === 0 ? undefined : 'already-owned' },
  }));

  it('produces no writes during a dry run', () => {
    expect(buildWriteBatches(records, true)).toEqual([]);
  });

  it('chunks only ownerless records into batches no larger than 450', () => {
    const batches = buildWriteBatches(records, false);

    expect(batches.map(batch => batch.length)).toEqual([450, 1]);
    expect(batches.flat().map(record => record.id)).toEqual(
      records.filter(record => Number(record.id.slice('record-'.length)) % 2 === 0).map(record => record.id),
    );
  });
});
