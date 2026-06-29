import type { TestResult, TutorProfile } from '../../src/types.js';
import {
  failedNotificationUpdate,
  sentNotificationUpdate,
} from '../_email.js';

type TutorRecipient = Pick<TutorProfile, 'email' | 'displayName'>;
type CompletedResult = Pick<
  TestResult,
  'ownerId' | 'studentFullName' | 'testTitle' | 'completedAt'
>;

interface NotificationInput {
  enabled: boolean;
  resultId: string;
  result: CompletedResult;
}

interface NotificationDependencies {
  loadTutor(ownerId: string): Promise<TutorRecipient | null>;
  send(
    tutor: TutorRecipient,
    result: CompletedResult,
    resultId: string,
  ): Promise<unknown>;
  update(fields: Record<string, unknown>): Promise<unknown>;
  now(): number;
  log(message: string, error: unknown): void;
}

function logWithoutThrowing(
  dependencies: NotificationDependencies,
  message: string,
  error: unknown,
) {
  try {
    dependencies.log(message, error);
  } catch {
    // Notification reporting must never break the saved submission response.
  }
}

export async function notifyTutorOfResult(
  input: NotificationInput,
  dependencies: NotificationDependencies,
) {
  if (!input.enabled) return;

  try {
    if (!input.result.ownerId.trim()) {
      throw new Error('The completed test has no tutor owner.');
    }

    const tutor = await dependencies.loadTutor(input.result.ownerId);
    if (!tutor?.email.trim()) {
      throw new Error('The owning tutor profile has no notification email.');
    }

    await dependencies.send(tutor, input.result, input.resultId);
  } catch (error) {
    logWithoutThrowing(
      dependencies,
      'Result email delivery failed.',
      error,
    );

    try {
      await dependencies.update(failedNotificationUpdate(error));
    } catch (statusError) {
      logWithoutThrowing(
        dependencies,
        'Result email failure status could not be saved.',
        statusError,
      );
    }
    return;
  }

  try {
    await dependencies.update(sentNotificationUpdate(dependencies.now()));
  } catch (statusError) {
    logWithoutThrowing(
      dependencies,
      'Result email sent but its status could not be saved.',
      statusError,
    );
  }
}
