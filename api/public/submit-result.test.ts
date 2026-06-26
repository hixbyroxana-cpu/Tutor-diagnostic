import { describe, expect, it } from 'vitest';
import { requireSubmissionSlug } from './submit-result.js';

describe('requireSubmissionSlug', () => {
  it('accepts the slug request field', () => {
    expect(requireSubmissionSlug({ slug: ' primary-link ' })).toBe('primary-link');
  });

  it('rejects alternate test identifiers without slug', () => {
    expect(() => requireSubmissionSlug({ testSlug: 'legacy-body-link' })).toThrow('slug is required.');
    expect(() => requireSubmissionSlug({ testId: 'stored-test-id' })).toThrow('slug is required.');
  });
});
