import { describe, expect, it, vi } from 'vitest';
import { notifyTutorOfResult } from './result-notification.js';

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
    const deps = dependencies({
      send: vi.fn().mockRejectedValue(new Error('provider unavailable')),
    });

    await expect(notifyTutorOfResult(
      { enabled: true, resultId: 'result-1', result },
      deps,
    )).resolves.toBeUndefined();

    expect(deps.update).toHaveBeenCalledWith({
      notificationStatus: 'failed',
      notificationError: 'provider unavailable',
    });
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
