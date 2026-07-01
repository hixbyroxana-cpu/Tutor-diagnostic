import { describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_RESET_CONFIRMATION,
  passwordResetActionCodeSettings,
  requestPasswordReset,
} from './password-reset';

describe('passwordResetActionCodeSettings', () => {
  it('returns the hosted account continuation settings', () => {
    expect(passwordResetActionCodeSettings('https://tutor.example'))
      .toEqual({
        url: 'https://tutor.example/account',
        handleCodeInApp: false,
      });
  });
});

describe('requestPasswordReset', () => {
  it('trims the email and returns the neutral confirmation', async () => {
    const sendReset = vi.fn().mockResolvedValue(undefined);

    await expect(requestPasswordReset(' tutor@example.com ', sendReset))
      .resolves.toBe(PASSWORD_RESET_CONFIRMATION);
    expect(sendReset).toHaveBeenCalledWith('tutor@example.com');
  });

  it.each(['', 'not-an-email', 'tutor@'])(
    'rejects invalid email %j without contacting Firebase',
    async (email) => {
      const sendReset = vi.fn();

      await expect(requestPasswordReset(email, sendReset))
        .rejects.toThrow('Enter a valid email address first.');
      expect(sendReset).not.toHaveBeenCalled();
    },
  );

  it('does not reveal an unregistered Firebase account', async () => {
    const sendReset = vi.fn().mockRejectedValue({ code: 'auth/user-not-found' });

    await expect(requestPasswordReset('missing@example.com', sendReset))
      .resolves.toBe(PASSWORD_RESET_CONFIRMATION);
  });

  it('returns a safe retry message for service failures', async () => {
    const sendReset = vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(requestPasswordReset('tutor@example.com', sendReset))
      .rejects.toThrow('We could not send the reset email. Please try again.');
  });
});
