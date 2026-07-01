import { describe, expect, it } from 'vitest';
import {
  duplicateResponseForExistingSubmission,
  requireSubmissionSlug,
} from './submit-result.js';

describe('requireSubmissionSlug', () => {
  it('accepts the slug request field', () => {
    expect(requireSubmissionSlug({ slug: ' primary-link ' })).toBe('primary-link');
  });

  it('rejects alternate test identifiers without slug', () => {
    expect(() => requireSubmissionSlug({ testSlug: 'legacy-body-link' })).toThrow('slug is required.');
    expect(() => requireSubmissionSlug({ testId: 'stored-test-id' })).toThrow('slug is required.');
  });
});

describe('duplicateResponseForExistingSubmission', () => {
  it('returns duplicate for an existing result with the requested slug', () => {
    expect(duplicateResponseForExistingSubmission(
      'submission-id',
      { testSlug: 'year-5-test' },
      'year-5-test',
    )).toEqual({
      resultId: 'submission-id',
      duplicate: true,
    });
  });

  it('rejects an existing result with a different slug', () => {
    expect(() => duplicateResponseForExistingSubmission(
      'submission-id',
      { testSlug: 'year-6-test' },
      'year-5-test',
    )).toThrow('submissionId already belongs to a different test.');
  });
});
