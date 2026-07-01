import { describe, expect, it } from 'vitest';
import {
  assertRequiredStarterTemplates,
  buildStarterTest,
  buildTutorProfile,
  selectRequiredStarterTemplates,
  type StarterTestTemplate,
} from './_bootstrap-core.js';
import type { Test } from '../../src/types.js';

const now = 1_765_000_000_000;
const uid = 'TutorUID987654321';

function template(overrides: Partial<StarterTestTemplate> = {}): StarterTestTemplate {
  return {
    id: '11-plus-diagnostic',
    ownerId: 'master-template-owner',
    title: '11+ Diagnostic',
    level: '11+',
    slug: 'source-slug',
    description: 'Starter assessment',
    aiPrompt: 'Keep the prompt',
    questions: [
      {
        id: 'q1',
        question: 'What is 6 x 7?',
        choices: ['36', '42', '48', '54'],
        correctAnswer: '42',
        topic: 'Arithmetic',
        skill: 'Multiplication facts',
        difficulty: 'easy',
        explanation: '6 groups of 7 is 42.',
        target: 'Recall times tables',
      },
    ],
    createdAt: 1,
    updatedAt: 2,
    isActive: false,
    ...overrides,
  };
}

describe('buildStarterTest', () => {
  it('builds a deterministic tutor-owned editable starter test from a template', () => {
    const starterTest = buildStarterTest(template(), uid, now);

    expect(starterTest).toMatchObject({
      ownerId: uid,
      templateSourceId: '11-plus-diagnostic',
      title: '11+ Diagnostic',
      slug: '11-diagnostic-tutoruid',
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });
    expect(starterTest).not.toHaveProperty('id');
  });

  it('preserves template content and additional template fields', () => {
    const source = template({
      description: 'Deep copy source description',
      questions: [
        {
          id: 'q-complex',
          question: 'Read the chart.',
          choices: ['A', 'B', 'C', 'D'],
          correctAnswer: 'C',
          topic: 'Data',
          skill: 'Charts',
          difficulty: 'medium',
          explanation: 'The tallest bar is C.',
          target: 'Interpret bar charts',
          visualType: 'bar_chart',
          visualData: {
            data: [
              { name: 'A', value: 2 },
              { name: 'C', value: 7 },
            ],
            yAxisLabel: 'Votes',
          },
        },
      ],
      templateVersion: 1,
      templateSourceTestId: 'Np8zdC1SdYtk1ZdlpF3T',
    } as Partial<Test>);

    const starterTest = buildStarterTest(source, uid, now);

    expect(starterTest.questions).toEqual(source.questions);
    expect(starterTest).toMatchObject({
      description: 'Deep copy source description',
      aiPrompt: 'Keep the prompt',
      templateVersion: 1,
      templateSourceTestId: 'Np8zdC1SdYtk1ZdlpF3T',
    });
  });
});

describe('assertRequiredStarterTemplates', () => {
  it('fails clearly when a required starter template is missing', () => {
    expect(() => assertRequiredStarterTemplates([
      template({ id: '11-plus-diagnostic' }),
    ])).toThrow('Missing required starter test templates: gcse-foundation-overall-revision');
  });

  it('accepts the required starter templates regardless of extra templates', () => {
    expect(() => assertRequiredStarterTemplates([
      template({ id: '11-plus-diagnostic' }),
      template({ id: 'gcse-foundation-overall-revision', title: 'GCSE Foundation Overall Revision' }),
      template({ id: 'extra-template' }),
    ])).not.toThrow();
  });
});

describe('selectRequiredStarterTemplates', () => {
  it('returns exactly the required starter templates in deterministic order', () => {
    const selectedTemplates = selectRequiredStarterTemplates([
      template({ id: 'extra-template', title: 'Extra Template' }),
      template({ id: 'gcse-foundation-overall-revision', title: 'GCSE Foundation Overall Revision' }),
      template({ id: '11-plus-diagnostic', title: '11+ Diagnostic' }),
    ]);

    expect(selectedTemplates.map(selectedTemplate => selectedTemplate.id)).toEqual([
      '11-plus-diagnostic',
      'gcse-foundation-overall-revision',
    ]);
  });
});

describe('buildTutorProfile', () => {
  it('falls back from token name to email local-part and then Tutor', () => {
    expect(buildTutorProfile(
      { uid, email: 'alex.parent@example.com' },
      undefined,
      now,
    ).displayName).toBe('alex.parent');

    expect(buildTutorProfile(
      { uid },
      undefined,
      now,
    ).displayName).toBe('Tutor');
  });

  it('preserves an existing profile createdAt timestamp', () => {
    expect(buildTutorProfile(
      { uid, email: 'tutor@example.com', name: 'Tutor Name' },
      { createdAt: 123 },
      now,
    )).toMatchObject({
      uid,
      email: 'tutor@example.com',
      displayName: 'Tutor Name',
      createdAt: 123,
      templatesProvisionedAt: now,
    });
  });
});
