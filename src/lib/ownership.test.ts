import { describe, expect, it } from 'vitest';
import { belongsToTutor, makeTutorSlug } from './ownership';

describe('belongsToTutor', () => {
  it('returns true for a matching owner', () => {
    expect(belongsToTutor({ ownerId: 'tutor-a' }, 'tutor-a')).toBe(true);
  });

  it('returns false for a mismatched owner', () => {
    expect(belongsToTutor({ ownerId: 'tutor-b' }, 'tutor-a')).toBe(false);
  });

  it('returns false when the owner is absent', () => {
    expect(belongsToTutor({}, 'tutor-a')).toBe(false);
  });
});

describe('makeTutorSlug', () => {
  it('combines a normalized title with the first eight uid characters', () => {
    expect(makeTutorSlug('GCSE Foundation Overall Revision', 'ABC123456789')).toBe(
      'gcse-foundation-overall-revision-abc12345',
    );
  });
});
