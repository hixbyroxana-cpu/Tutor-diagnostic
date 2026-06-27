import { describe, expect, it } from 'vitest';
import { belongsToTutor, makeTutorSlug, resolveTestSlug } from './ownership';

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

  it('returns false when both uid and owner are empty', () => {
    expect(belongsToTutor({ ownerId: '' }, '')).toBe(false);
  });
});

describe('makeTutorSlug', () => {
  it('combines a normalized title with the first eight uid characters', () => {
    expect(makeTutorSlug('GCSE Foundation Overall Revision', 'ABC123456789')).toBe(
      'gcse-foundation-overall-revision-abc12345',
    );
  });
});

describe('resolveTestSlug', () => {
  it('uses a tutor-specific slug for a new owned test', () => {
    expect(resolveTestSlug('Algebra Check', 'TutorABC123', undefined)).toBe(
      'algebra-check-tutorabc',
    );
  });

  it('uses the legacy title-only slug for compatibility creation without a uid', () => {
    expect(resolveTestSlug('Algebra Check', undefined, undefined)).toBe('algebra-check');
  });

  it('preserves an existing test slug when the title changes', () => {
    expect(resolveTestSlug('Renamed Test', 'TutorABC123', 'permanent-public-link')).toBe(
      'permanent-public-link',
    );
  });
});
