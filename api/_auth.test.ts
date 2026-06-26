import { describe, expect, it } from 'vitest';
import { readBearerToken } from './_auth.js';

describe('readBearerToken', () => {
  it('returns the token from a valid Bearer authorization header', () => {
    expect(readBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null when the authorization header is missing', () => {
    expect(readBearerToken()).toBeNull();
    expect(readBearerToken({ headers: {} })).toBeNull();
  });

  it('returns null for the wrong authorization scheme', () => {
    expect(readBearerToken('Basic abc.def.ghi')).toBeNull();
  });

  it('accepts extra whitespace and scheme casing', () => {
    expect(readBearerToken('  bEaReR   abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  it('looks up authorization headers case-insensitively on request-like objects', () => {
    expect(readBearerToken({ headers: { authorization: 'Bearer lower-case-token' } })).toBe('lower-case-token');
    expect(readBearerToken({ headers: { Authorization: 'Bearer title-case-token' } })).toBe('title-case-token');
  });
});
