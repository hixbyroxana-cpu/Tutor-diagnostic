import { describe, expect, it } from 'vitest';
import {
  assertAnswerQuestionIds,
  assertSubmissionId,
  assertStudentInfo,
  buildStoredResult,
  duplicateSubmissionResponse,
} from './submission-core.js';
import type { Test } from '../../src/types.js';

const completedAt = 1_766_000_000_000;
const submissionId = '550e8400-e29b-41d4-a716-446655440000';

function storedTest(overrides: Partial<Test> = {}): Test {
  return {
    id: 'test_123',
    ownerId: 'tutor_owner_123',
    title: 'Year 5 Fractions Check',
    level: 'Year 5',
    slug: 'year-5-fractions',
    description: 'Diagnostic assessment',
    createdAt: 1,
    updatedAt: 2,
    isActive: true,
    questions: [
      {
        id: 'q1',
        question: 'What is 1/2 of 10?',
        choices: ['2', '5', '10', '20'],
        correctAnswer: '5',
        topic: 'Fractions',
        skill: 'Find fractions of quantities',
        difficulty: 'easy',
        explanation: 'Half of 10 is 5.',
        target: 'Find unit fractions of quantities',
      },
      {
        id: 'q2',
        question: 'Which is equivalent to 2/4?',
        choices: ['1/2', '1/3', '2/3', '3/4'],
        correctAnswer: '1/2',
        topic: 'Fractions',
        skill: 'Equivalent fractions',
        difficulty: 'medium',
        explanation: '2/4 simplifies to 1/2.',
        target: 'Simplify equivalent fractions',
      },
    ],
    ...overrides,
  };
}

describe('buildStoredResult', () => {
  it('marks answers from the stored test and inherits the stored owner', () => {
    const result = buildStoredResult(
      storedTest(),
      { q1: '5', q2: '1/3' },
      {
        studentFirstName: ' Ada ',
        studentLastName: ' Lovelace ',
        parentName: 'Parent Name',
        parentEmail: 'parent@example.com',
        notes: 'Enjoys puzzles',
      },
      submissionId,
      completedAt,
    );

    expect(result).toMatchObject({
      ownerId: 'tutor_owner_123',
      testId: 'test_123',
      testSlug: 'year-5-fractions',
      studentFirstName: 'Ada',
      studentLastName: 'Lovelace',
      studentFullName: 'Ada Lovelace',
      score: 1,
      totalQuestions: 2,
      percentage: 50,
      isNew: true,
      completedAt,
      submissionId,
      notificationStatus: 'pending',
      parentSummary: '',
    });
    expect(result.answers).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        selectedAnswer: '5',
        correctAnswer: '5',
        isCorrect: true,
        target: 'Find unit fractions of quantities',
      }),
      expect.objectContaining({
        questionId: 'q2',
        selectedAnswer: '1/3',
        correctAnswer: '1/2',
        isCorrect: false,
        target: 'Simplify equivalent fractions',
      }),
    ]);
    expect(result.suggestedTargets).toEqual(['Simplify equivalent fractions']);
  });

  it('treats omitted answers as incorrect while preserving report shape', () => {
    const result = buildStoredResult(
      storedTest(),
      { q1: '5' },
      { studentFirstName: 'Grace', studentLastName: 'Hopper' },
      submissionId,
      completedAt,
    );

    expect(result.score).toBe(1);
    expect(result.answers[1]).toMatchObject({
      questionId: 'q2',
      selectedAnswer: '',
      isCorrect: false,
    });
    expect(result.parentName).toBe('');
    expect(result.parentEmail).toBe('');
    expect(result.notes).toBe('');
  });

  it('uses a Firestore-safe owner fallback for legacy ownerless tests', () => {
    const legacyOwnerlessTest = storedTest({ ownerId: undefined } as Partial<Test>);

    const result = buildStoredResult(
      legacyOwnerlessTest,
      { q1: '5' },
      { studentFirstName: 'Legacy', studentLastName: 'Student' },
      submissionId,
      completedAt,
    );

    expect(result.ownerId).toBe('');
  });
});

describe('submission validation helpers', () => {
  it('accepts UUID-like submission ids and rejects unsafe tokens', () => {
    expect(() => assertSubmissionId(submissionId)).not.toThrow();
    expect(() => assertSubmissionId('not a uuid')).toThrow('submissionId must be a UUID-like token.');
  });

  it('normalizes bounded student names and rejects empty or oversized names', () => {
    expect(assertStudentInfo({
      studentFirstName: ' Katherine ',
      studentLastName: ' Johnson ',
      parentEmail: ' family@example.com ',
    })).toMatchObject({
      studentFirstName: 'Katherine',
      studentLastName: 'Johnson',
      parentEmail: 'family@example.com',
    });

    expect(() => assertStudentInfo({ studentFirstName: '', studentLastName: 'Johnson' }))
      .toThrow('Student first name is required.');
    expect(() => assertStudentInfo({ studentFirstName: 'A'.repeat(81), studentLastName: 'Johnson' }))
      .toThrow('Student first name must be 80 characters or fewer.');
  });

  it('rejects answers that do not reference stored question ids', () => {
    expect(() => assertAnswerQuestionIds(storedTest(), { q1: '5' })).not.toThrow();
    expect(() => assertAnswerQuestionIds(storedTest(), { q3: '5' }))
      .toThrow('Answers include unknown question ids: q3');
  });

  it('builds the idempotent duplicate response without exposing result data', () => {
    expect(duplicateSubmissionResponse('existing-result-id')).toEqual({
      resultId: 'existing-result-id',
      duplicate: true,
    });
  });
});
