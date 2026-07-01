import { describe, expect, it } from 'vitest';
import { isEditorRequestContextCurrent } from './editor-request-context';

describe('isEditorRequestContextCurrent', () => {
  it('allows updates when the test and tutor context still match', () => {
    expect(
      isEditorRequestContextCurrent(
        { testId: 'test-a', uid: 'tutor-a', generation: 1 },
        { testId: 'test-a', uid: 'tutor-a', generation: 1 },
      ),
    ).toBe(true);
  });

  it('rejects updates after the test id changes', () => {
    expect(
      isEditorRequestContextCurrent(
        { testId: 'test-a', uid: 'tutor-a', generation: 1 },
        { testId: 'test-b', uid: 'tutor-a', generation: 2 },
      ),
    ).toBe(false);
  });

  it('rejects updates after the tutor uid changes', () => {
    expect(
      isEditorRequestContextCurrent(
        { testId: 'test-a', uid: 'tutor-a', generation: 1 },
        { testId: 'test-a', uid: 'tutor-b', generation: 2 },
      ),
    ).toBe(false);
  });

  it('rejects an older request after returning to the same test and tutor', () => {
    const olderRequest = { testId: 'test-a', uid: 'tutor-a', generation: 1 };
    const currentContext = { testId: 'test-a', uid: 'tutor-a', generation: 3 };

    expect(isEditorRequestContextCurrent(olderRequest, currentContext)).toBe(false);
  });
});
