import { afterEach, describe, expect, it, vi } from 'vitest';

const resendSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

import {
  buildResultEmail,
  failedNotificationUpdate,
  notificationsConfigured,
  sendResultEmail,
  sentNotificationUpdate,
} from './_email.js';

const completedAt = Date.UTC(2026, 5, 27, 12, 30);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resendSend.mockReset();
});

describe('buildResultEmail', () => {
  it('addresses only the owning tutor with the exact result link and no private result data', () => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'owner@example.com', displayName: 'Owning Tutor' },
      result: {
        studentFullName: 'Sam Lee',
        testTitle: '11+ Diagnostic',
        completedAt,
        score: 7,
        percentage: 70,
        answers: ['private answer'],
        parentSummary: 'private report content',
      } as any,
      resultId: 'result-1',
      appBaseUrl: 'https://diagnostic.click///',
    });

    expect(email.to).toEqual(['owner@example.com']);
    expect(email.html).toContain('Sam Lee');
    expect(email.html).toContain('11+ Diagnostic');
    expect(email.html).toContain('27 Jun 2026, 13:30');
    expect(email.html).toContain(
      '<a href="https://diagnostic.click/results/result-1">View completed result</a>',
    );
    expect(email.text).toContain('Sam Lee');
    expect(email.text).toContain('11+ Diagnostic');
    expect(email.text).toContain('27 Jun 2026, 13:30');
    expect(email.text).toContain(
      'View completed result: https://diagnostic.click/results/result-1',
    );

    const serialized = JSON.stringify(email);
    expect(serialized).not.toContain('private answer');
    expect(serialized).not.toContain('private report content');
    expect(serialized).not.toMatch(/\bscore\b|\bpercentage\b/i);
    expect(email).not.toHaveProperty('attachments');
  });

  it('escapes HTML, encodes the result id, and removes subject newlines', () => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'owner@example.com', displayName: 'Owning Tutor' },
      result: {
        studentFullName: '<Sam & Lee>\r\nBcc: attacker@example.com',
        testTitle: '"11+" <script>alert(1)</script>',
        completedAt,
      },
      resultId: 'result/one ?#',
      appBaseUrl: 'https://diagnostic.click/',
    });

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toContain(
      '&lt;Sam &amp; Lee&gt;\r\nBcc: attacker@example.com',
    );
    expect(email.html).toContain(
      '&quot;11+&quot; &lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain(
      'https://diagnostic.click/results/result%2Fone%20%3F%23',
    );
  });

  it.each([
    'not a URL',
    'http://unsafe.example.com/path',
    'https://user:password@unsafe.example.com/path',
  ])('falls back for unsafe app base URL %s', appBaseUrl => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'owner@example.com', displayName: 'Owning Tutor' },
      result: {
        studentFullName: 'Sam Lee',
        testTitle: '11+ Diagnostic',
        completedAt,
      },
      resultId: 'result-1',
      appBaseUrl,
    });

    expect(email.html).toContain(
      'href="https://diagnostic.click/results/result-1"',
    );
    expect(email.text).toContain(
      'View completed result: https://diagnostic.click/results/result-1',
    );
  });

  it('normalizes a valid HTTPS app URL to its origin', () => {
    const email = buildResultEmail({
      from: 'Diagnostic Click <reports@mail.diagnostic.click>',
      tutor: { email: 'owner@example.com', displayName: 'Owning Tutor' },
      result: {
        studentFullName: 'Sam Lee',
        testTitle: '11+ Diagnostic',
        completedAt,
      },
      resultId: 'result-1',
      appBaseUrl: 'https://app.example.com:8443/base/path?query=yes#section',
    });

    expect(email.html).toContain(
      'href="https://app.example.com:8443/results/result-1"',
    );
    expect(email.html).not.toContain('/base/path');
  });
});

describe('notification configuration and status updates', () => {
  it('enables notifications only when both Resend configuration values exist', () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    expect(notificationsConfigured()).toBe(true);

    vi.stubEnv('EMAIL_FROM', '');
    expect(notificationsConfigured()).toBe(false);

    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(notificationsConfigured()).toBe(false);
  });

  it('builds sent and bounded failed status updates', () => {
    expect(sentNotificationUpdate(1234)).toEqual({
      notificationStatus: 'sent',
      notificationSentAt: 1234,
      notificationError: '',
    });

    expect(failedNotificationUpdate('non-error rejection')).toEqual({
      notificationStatus: 'failed',
      notificationError: 'Unknown email delivery error.',
    });
    const failed = failedNotificationUpdate(new Error('x'.repeat(1_000)));
    expect(failed.notificationError).toHaveLength(300);
  });
});

describe('sendResultEmail', () => {
  it('uses the configured sender, fallback base URL, and result idempotency key', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    vi.stubEnv('APP_BASE_URL', '');
    resendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    await expect(sendResultEmail(
      { email: 'owner@example.com', displayName: 'Owning Tutor' },
      { studentFullName: 'Sam Lee', testTitle: '11+ Diagnostic', completedAt },
      'result/1',
    )).resolves.toEqual({ id: 'email-1' });

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Diagnostic Click <reports@mail.diagnostic.click>',
        to: ['owner@example.com'],
        html: expect.stringContaining(
          'https://diagnostic.click/results/result%2F1',
        ),
      }),
      { idempotencyKey: 'result-completed/result/1' },
    );
  });

  it('treats a returned Resend error as a delivery failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    resendSend.mockResolvedValue({
      data: null,
      error: { message: 'provider rejected the message' },
    });

    await expect(sendResultEmail(
      { email: 'owner@example.com', displayName: 'Owning Tutor' },
      { studentFullName: 'Sam Lee', testTitle: '11+ Diagnostic', completedAt },
      'result-1',
    )).rejects.toThrow('Resend failed: provider rejected the message');
  });

  it('times out a Resend call that does not settle', async () => {
    vi.useFakeTimers();
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    resendSend.mockReturnValue(new Promise(() => {}));

    const send = sendResultEmail(
      { email: 'owner@example.com', displayName: 'Owning Tutor' },
      { studentFullName: 'Sam Lee', testTitle: '11+ Diagnostic', completedAt },
      'result-1',
    );
    const rejection = expect(send).rejects.toThrow(
      'Result email delivery timed out.',
    );

    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the delivery timeout when Resend settles', async () => {
    vi.useFakeTimers();
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Diagnostic Click <reports@mail.diagnostic.click>');
    let settle: ((value: unknown) => void) | undefined;
    resendSend.mockReturnValue(new Promise(resolve => {
      settle = resolve;
    }));

    const send = sendResultEmail(
      { email: 'owner@example.com', displayName: 'Owning Tutor' },
      { studentFullName: 'Sam Lee', testTitle: '11+ Diagnostic', completedAt },
      'result-1',
    );

    expect(vi.getTimerCount()).toBe(1);
    settle?.({ data: { id: 'email-1' }, error: null });
    await expect(send).resolves.toEqual({ id: 'email-1' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
