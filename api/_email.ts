import { Resend } from 'resend';
import type { TestResult, TutorProfile } from '../src/types.js';

type TutorRecipient = Pick<TutorProfile, 'email' | 'displayName'>;
type CompletedResult = Pick<TestResult, 'studentFullName' | 'testTitle' | 'completedAt'>;
const EMAIL_DELIVERY_TIMEOUT_MS = 10_000;
const DEFAULT_APP_ORIGIN = 'https://diagnostic.click';

interface ResultEmailInput {
  from: string;
  tutor: TutorRecipient;
  result: CompletedResult;
  resultId: string;
  appBaseUrl: string;
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function safeAppOrigin(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return DEFAULT_APP_ORIGIN;
    }

    return url.origin;
  } catch {
    return DEFAULT_APP_ORIGIN;
  }
}

export function buildResultEmail(input: ResultEmailInput) {
  const baseUrl = safeAppOrigin(input.appBaseUrl);
  const resultUrl = `${baseUrl}/results/${encodeURIComponent(input.resultId)}`;
  const studentName = escapeHtml(input.result.studentFullName);
  const testTitle = escapeHtml(input.result.testTitle);
  const completionDate = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London',
  }).format(new Date(input.result.completedAt));

  return {
    from: input.from,
    to: [input.tutor.email],
    subject: `Diagnostic completed: ${singleLine(input.result.studentFullName)}`,
    html: `<p>${studentName} completed ${testTitle} on ${completionDate}.</p>
      <p><a href="${resultUrl}">View completed result</a></p>`,
    text: `${input.result.studentFullName} completed ${input.result.testTitle} on ${completionDate}.\n\nView completed result: ${resultUrl}`,
  };
}

export function notificationsConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function withDeliveryTimeout<T>(delivery: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Result email delivery timed out.')),
      EMAIL_DELIVERY_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([delivery, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sendResultEmail(
  tutor: TutorRecipient,
  result: CompletedResult,
  resultId: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Result email is not configured.');
  }

  const resend = new Resend(apiKey);
  const response = await withDeliveryTimeout(
    resend.emails.send(
      buildResultEmail({
        from,
        tutor,
        result,
        resultId,
        appBaseUrl: process.env.APP_BASE_URL || DEFAULT_APP_ORIGIN,
      }),
      { idempotencyKey: `result-completed/${resultId}` },
    ),
  );

  if (response.error) {
    throw new Error(`Resend failed: ${response.error.message}`);
  }

  return response.data;
}

export function sentNotificationUpdate(notificationSentAt: number) {
  return {
    notificationStatus: 'sent' as const,
    notificationSentAt,
    notificationError: '',
  };
}

export function failedNotificationUpdate(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : 'Unknown email delivery error.';

  return {
    notificationStatus: 'failed' as const,
    notificationError: message.slice(0, 300),
  };
}
