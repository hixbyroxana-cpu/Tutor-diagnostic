const messages: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
};

export function friendlyAuthError(code?: string) {
  return messages[code || ''] || 'We could not sign you in. Please try again.';
}
