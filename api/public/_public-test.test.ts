import { describe, expect, it } from 'vitest';
import { buildPublicTestPayload } from './test.js';
import type { Test } from '../../src/types.js';

function storedTest(): Test {
  return {
    id: 'stored-test-id',
    ownerId: 'private-owner-id',
    title: 'Public Diagnostic',
    level: 'Year 5',
    slug: 'public-diagnostic',
    description: 'Student-facing test',
    createdAt: 1,
    updatedAt: 2,
    isActive: true,
    questions: [
      {
        id: 'q1',
        question: 'What is 3 + 4?',
        choices: ['5', '6', '7', '8'],
        correctAnswer: '7',
        topic: 'Arithmetic',
        skill: 'Addition',
        difficulty: 'easy',
        explanation: '3 plus 4 is 7.',
        target: 'Add one-digit numbers',
      },
    ],
  };
}

describe('buildPublicTestPayload', () => {
  it('does not expose private owner or marking fields', () => {
    const payload = buildPublicTestPayload(storedTest());

    expect(payload).not.toHaveProperty('ownerId');
    expect(payload).not.toHaveProperty('id');
    expect(payload.questions[0]).not.toHaveProperty('correctAnswer');
    expect(payload.questions[0]).not.toHaveProperty('explanation');
    expect(payload.questions[0]).not.toHaveProperty('target');
    expect(payload.questions[0]).toMatchObject({
      id: 'q1',
      question: 'What is 3 + 4?',
      choices: ['5', '6', '7', '8'],
    });
  });
});
