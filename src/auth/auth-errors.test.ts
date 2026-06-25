import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './auth-errors';

describe('friendlyAuthError', () => {
  it('maps common Firebase errors', () => {
    expect(friendlyAuthError('auth/invalid-credential')).toBe('Email or password is incorrect.');
    expect(friendlyAuthError('auth/email-already-in-use')).toBe('An account already exists for this email.');
  });
});
