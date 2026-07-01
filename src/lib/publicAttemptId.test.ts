import { describe, expect, it } from 'vitest';
import {
  clearPublicAttemptId,
  startPublicAttemptId,
} from './publicAttemptId.js';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('public attempt ids', () => {
  it('rotates stale stored ids when starting a fresh attempt', () => {
    const storage = new MemoryStorage();
    const first = startPublicAttemptId('year-5-test', {
      storage,
      createId: () => '550e8400-e29b-41d4-a716-446655440000',
    });
    const second = startPublicAttemptId('year-5-test', {
      storage,
      createId: () => '550e8400-e29b-41d4-a716-446655440001',
    });

    expect(first).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(second).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(storage.getItem('public-test-submission-id:year-5-test')).toBe(second);
  });

  it('clears a stored active attempt id for a fresh intro state', () => {
    const storage = new MemoryStorage();
    startPublicAttemptId('year-5-test', {
      storage,
      createId: () => '550e8400-e29b-41d4-a716-446655440000',
    });

    clearPublicAttemptId('year-5-test', storage);

    expect(storage.getItem('public-test-submission-id:year-5-test')).toBeNull();
  });
});
