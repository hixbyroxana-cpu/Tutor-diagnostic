export const PASSWORD_RESET_CONFIRMATION =
  'If an account exists for that email, check your inbox for a password reset link.';

type ResetSender = (email: string) => Promise<void>;

export function passwordResetActionCodeSettings(origin: string) {
  return {
    url: new URL('/account', origin).toString(),
    handleCodeInApp: false,
  };
}

function firebaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export async function requestPasswordReset(email: string, sendReset: ResetSender) {
  const normalizedEmail = email.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  if (!validEmail) {
    throw new Error('Enter a valid email address first.');
  }

  try {
    await sendReset(normalizedEmail);
  } catch (error) {
    if (firebaseErrorCode(error) !== 'auth/user-not-found') {
      throw new Error('We could not send the reset email. Please try again.');
    }
  }

  return PASSWORD_RESET_CONFIRMATION;
}
