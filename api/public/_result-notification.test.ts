import { describe, expect, it, vi } from 'vitest';
import { notifyTutorOfResult } from './_result-notification.js';
import {
  createResultOrReconcileDuplicate,
  reconcileDuplicateSubmission,
} from './submit-result.js';

const result = {
  ownerId: 'tutor-1',
  studentFullName: 'Sam Lee',
  testTitle: '11+ Diagnostic',
  completedAt: 123,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    loadTutor: vi.fn().mockResolvedValue({
      email: 'owner@example.com',
      displayName: 'Owning Tutor',
    }),
    send: vi.fn().mockResolvedValue({ id: 'email-1' }),
    update: vi.fn().mockResolvedValue(undefined),
    now: () => 456,
    log: vi.fn(),
    ...overrides,
  };
}

describe('notifyTutorOfResult', () => {
  it('emails the owning tutor and records sent status', async () => {
    const deps = dependencies();

    await notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    );

    expect(deps.loadTutor).toHaveBeenCalledWith('tutor-1');
    expect(deps.send).toHaveBeenCalledWith(
      { email: 'owner@example.com', displayName: 'Owning Tutor' },
      result,
      'result-1',
    );
    expect(deps.update).toHaveBeenCalledWith({
      notificationStatus: 'sent',
      notificationSentAt: 456,
      notificationError: '',
    });
  });

  it('records provider failure without rejecting the saved submission', async () => {
    const deliveryError = new Error('provider unavailable');
    const log = vi.fn(() => {
      throw new Error('logger unavailable');
    });
    const deps = dependencies({
      send: vi.fn().mockRejectedValue(deliveryError),
      log,
    });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    )).resolves.toBeUndefined();

    expect(deps.update).toHaveBeenCalledWith({
      notificationStatus: 'failed',
      notificationError: 'provider unavailable',
    });
    expect(log).toHaveBeenCalledWith(
      'Result email delivery failed.',
      deliveryError,
    );
    expect(log.mock.invocationCallOrder[0])
      .toBeLessThan(deps.update.mock.invocationCallOrder[0]);
  });

  it('does nothing when notifications are disabled', async () => {
    const deps = dependencies();

    await notifyTutorOfResult(
      { enabled: false, resultId: 'result-1', result },
      deps,
    );

    expect(deps.loadTutor).not.toHaveBeenCalled();
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'owner id',
      unsafeResult: { ...result, ownerId: '' },
      loadTutor: vi.fn(),
      expectedError: 'The completed test has no tutor owner.',
    },
    {
      name: 'tutor email',
      unsafeResult: result,
      loadTutor: vi.fn().mockResolvedValue({
        email: '   ',
        displayName: 'Owning Tutor',
      }),
      expectedError: 'The owning tutor profile has no notification email.',
    },
  ])('fails safely when the $name is missing', async ({
    unsafeResult,
    loadTutor,
    expectedError,
  }) => {
    const deps = dependencies({ loadTutor });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result: unsafeResult },
      deps,
    )).resolves.toBeUndefined();

    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.update).toHaveBeenCalledWith({
      notificationStatus: 'failed',
      notificationError: expectedError,
    });
    expect(deps.log).toHaveBeenCalledWith(
      'Result email delivery failed.',
      expect.objectContaining({ message: expectedError }),
    );
    expect(deps.log.mock.invocationCallOrder[0])
      .toBeLessThan(deps.update.mock.invocationCallOrder[0]);
  });

  it('logs a tutor-load failure before recording failed status', async () => {
    const loadError = new Error('Tutor store unavailable');
    const deps = dependencies({
      loadTutor: vi.fn().mockRejectedValue(loadError),
    });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    )).resolves.toBeUndefined();

    expect(deps.log).toHaveBeenCalledWith(
      'Result email delivery failed.',
      loadError,
    );
    expect(deps.update).toHaveBeenCalledWith({
      notificationStatus: 'failed',
      notificationError: 'Tutor store unavailable',
    });
    expect(deps.log.mock.invocationCallOrder[0])
      .toBeLessThan(deps.update.mock.invocationCallOrder[0]);
  });

  it('logs a sent-status update failure without rejecting', async () => {
    const statusError = new Error('Firestore unavailable');
    const log = vi.fn(() => {
      throw new Error('logger unavailable');
    });
    const deps = dependencies({
      update: vi.fn().mockRejectedValue(statusError),
      log,
    });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    )).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith(
      'Result email sent but its status could not be saved.',
      statusError,
    );
  });

  it('logs a failed-status update failure without rejecting', async () => {
    const deliveryError = new Error('provider unavailable');
    const statusError = new Error('Firestore unavailable');
    const deps = dependencies({
      send: vi.fn().mockRejectedValue(deliveryError),
      update: vi.fn().mockRejectedValue(statusError),
    });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    )).resolves.toBeUndefined();

    expect(deps.log).toHaveBeenCalledWith(
      'Result email failure status could not be saved.',
      statusError,
    );
  });
});

describe('reconcileDuplicateSubmission', () => {
  it.each(['pending', 'failed'])(
    'reconciles a duplicate result with %s notification status',
    async notificationStatus => {
      const reconcileNotification = vi.fn().mockResolvedValue(undefined);
      const existingResult = {
        ...result,
        testSlug: 'year-5-test',
        notificationStatus,
      };

      await expect(reconcileDuplicateSubmission(
        'result-1',
        existingResult,
        'year-5-test',
        reconcileNotification,
      )).resolves.toEqual({
        resultId: 'result-1',
        duplicate: true,
      });

      expect(reconcileNotification).toHaveBeenCalledWith(
        'result-1',
        existingResult,
      );
    },
  );

  it('does not resend a duplicate result already marked sent', async () => {
    const reconcileNotification = vi.fn();

    await expect(reconcileDuplicateSubmission(
      'result-1',
      {
        ...result,
        testSlug: 'year-5-test',
        notificationStatus: 'sent',
      },
      'year-5-test',
      reconcileNotification,
    )).resolves.toEqual({
      resultId: 'result-1',
      duplicate: true,
    });

    expect(reconcileNotification).not.toHaveBeenCalled();
  });

  it('preserves slug-conflict rejection without attempting notification', async () => {
    const reconcileNotification = vi.fn();

    await expect(reconcileDuplicateSubmission(
      'result-1',
      {
        ...result,
        testSlug: 'year-6-test',
        notificationStatus: 'pending',
      },
      'year-5-test',
      reconcileNotification,
    )).rejects.toThrow('submissionId already belongs to a different test.');

    expect(reconcileNotification).not.toHaveBeenCalled();
  });
});

describe('createResultOrReconcileDuplicate', () => {
  it('rereads and reconciles the winning pending result after a create race', async () => {
    const winningResult = {
      ...result,
      testSlug: 'year-5-test',
      notificationStatus: 'pending',
    };
    const create = vi.fn().mockRejectedValue({ code: 6 });
    const reread = vi.fn().mockResolvedValue(winningResult);
    const reconcileNotification = vi.fn().mockResolvedValue(undefined);

    await expect(createResultOrReconcileDuplicate(
      {
        resultId: 'result-1',
        result: { candidate: true },
        requestedSlug: 'year-5-test',
      },
      {
        create,
        reread,
        reconcileNotification,
      },
    )).resolves.toEqual({
      resultId: 'result-1',
      duplicate: true,
    });

    expect(create).toHaveBeenCalledWith({ candidate: true });
    expect(reread).toHaveBeenCalledOnce();
    expect(reconcileNotification).toHaveBeenCalledWith(
      'result-1',
      winningResult,
    );
  });
});
