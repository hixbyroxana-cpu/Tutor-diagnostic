import { describe, expect, it } from 'vitest';
import { requireSubmissionSlug } from './submit-result.js';

describe('requireSubmissionSlug', () => {
  it('accepts slug or testSlug for existing public links', () => {
    expect(requireSubmissionSlug({ slug: ' primary-link ' })).toBe('primary-link');
    expect(requireSubmissionSlug({ testSlug: ' legacy-body-link ' })).toBe('legacy-body-link');
  });

  it('rejects testId-only submissions', () => {
    expect(() => requireSubmissionSlug({ testId: 'stored-test-id' })).toThrow('slug is required.');
  });
});
