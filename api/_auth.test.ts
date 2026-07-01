import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readBearerToken, requireTutor } from './_auth.js';

const { getAdminAuth } = vi.hoisted(() => ({
  getAdminAuth: vi.fn(),
}));

vi.mock('./_firebase-admin.js', () => ({
  getAdminAuth,
}));

function firebaseAuthError(code: string) {
  return Object.assign(new Error(code), { code });
}

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

describe('requireTutor', () => {
  beforeEach(() => {
    getAdminAuth.mockReset();
  });

  it('throws a safe 401 when the bearer token is missing', async () => {
    await expect(requireTutor({ headers: {} })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Authentication required.',
    });
    expect(getAdminAuth).not.toHaveBeenCalled();
  });

  it.each([
    'auth/argument-error',
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/invalid-id-token',
  ])('throws a safe 401 for Firebase token error %s', async (code) => {
    const verifyIdToken = vi.fn().mockRejectedValue(firebaseAuthError(code));
    getAdminAuth.mockReturnValue({ verifyIdToken });

    await expect(requireTutor({ headers: { authorization: 'Bearer invalid-token' } })).rejects.toMatchObject({
      statusCode: 401,
      message: 'Authentication required.',
    });
    expect(verifyIdToken).toHaveBeenCalledWith('invalid-token');
  });

  it('returns the decoded token when Firebase accepts the bearer token', async () => {
    const decodedToken = { uid: 'tutor-123' };
    const verifyIdToken = vi.fn().mockResolvedValue(decodedToken);
    getAdminAuth.mockReturnValue({ verifyIdToken });

    await expect(requireTutor({ headers: { authorization: 'Bearer valid-token' } })).resolves.toBe(decodedToken);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
  });

  it('does not misclassify Admin initialization errors as 401 responses', async () => {
    const initError = new Error('FIREBASE_PRIVATE_KEY is required for Firebase Admin.');
    getAdminAuth.mockImplementation(() => {
      throw initError;
    });

    await expect(requireTutor({ headers: { authorization: 'Bearer valid-token' } })).rejects.toBe(initError);
  });

  it('does not misclassify unknown verification failures as 401 responses', async () => {
    const verifyError = firebaseAuthError('auth/internal-error');
    const verifyIdToken = vi.fn().mockRejectedValue(verifyError);
    getAdminAuth.mockReturnValue({ verifyIdToken });

    await expect(requireTutor({ headers: { authorization: 'Bearer valid-token' } })).rejects.toBe(verifyError);
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
  });
});
