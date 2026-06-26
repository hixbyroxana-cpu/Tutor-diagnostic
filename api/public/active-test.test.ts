import { describe, expect, it } from 'vitest';
import { selectSingleActiveTestDoc } from './active-test.js';

function doc(id: string, data: Record<string, unknown> = {}) {
  return {
    id,
    data: () => data,
  };
}

describe('selectSingleActiveTestDoc', () => {
  it('returns the only active test match', () => {
    const selected = selectSingleActiveTestDoc([doc('test-1', { slug: 'shared-slug' })]);

    expect(selected.id).toBe('test-1');
  });

  it('fails closed when no active test matches', () => {
    expect(() => selectSingleActiveTestDoc([])).toThrow('Test not found or no longer active.');
  });

  it('fails closed when multiple active tests share a slug', () => {
    expect(() => selectSingleActiveTestDoc([
      doc('test-1', { slug: 'shared-slug' }),
      doc('test-2', { slug: 'shared-slug' }),
    ])).toThrow('This test link is temporarily unavailable.');
  });
});
