import { describe, expect, it } from 'vitest';
import { canEditOwnedRecord, getPublicAppBaseUrl, shouldFilterByOwner } from './tutor-query';

describe('shouldFilterByOwner', () => {
  it('returns true only when auth is enforced and a uid is present', () => {
    expect(shouldFilterByOwner('true', 'tutor-123')).toBe(true);
  });

  it('keeps compatibility mode unfiltered even when a uid exists', () => {
    expect(shouldFilterByOwner('false', 'tutor-123')).toBe(false);
    expect(shouldFilterByOwner(undefined, 'tutor-123')).toBe(false);
  });

  it('does not filter when auth is enforced but no uid is available', () => {
    expect(shouldFilterByOwner('true', '')).toBe(false);
    expect(shouldFilterByOwner('true', undefined)).toBe(false);
  });
});

describe('getPublicAppBaseUrl', () => {
  it('prefers an explicit public app URL over the current origin', () => {
    expect(getPublicAppBaseUrl('https://diagnostic.click', 'https://preview.vercel.app')).toBe(
      'https://diagnostic.click',
    );
  });

  it('falls back to the current origin when no public app URL is set', () => {
    expect(getPublicAppBaseUrl('', 'https://preview.vercel.app')).toBe('https://preview.vercel.app');
    expect(getPublicAppBaseUrl(undefined, 'https://preview.vercel.app')).toBe('https://preview.vercel.app');
  });

  it('removes trailing slashes from the configured public app URL', () => {
    expect(getPublicAppBaseUrl('https://diagnostic.click/', 'https://preview.vercel.app')).toBe(
      'https://diagnostic.click',
    );
  });
});

describe('canEditOwnedRecord', () => {
  it('requires a matching owner when auth is enforced', () => {
    expect(canEditOwnedRecord('true', 'tutor-123', 'tutor-123')).toBe(true);
    expect(canEditOwnedRecord('true', 'tutor-456', 'tutor-123')).toBe(false);
  });

  it('rejects enforced edits when uid or owner is missing', () => {
    expect(canEditOwnedRecord('true', 'tutor-123', undefined)).toBe(false);
    expect(canEditOwnedRecord('true', undefined, 'tutor-123')).toBe(false);
  });

  it('keeps compatibility mode permissive for legacy records', () => {
    expect(canEditOwnedRecord('false', undefined, undefined)).toBe(true);
    expect(canEditOwnedRecord(undefined, 'other-tutor', 'tutor-123')).toBe(true);
  });
});
