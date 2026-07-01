import { describe, expect, it, vi } from 'vitest';
import { buildTemplatePayload } from './seed-test-templates.js';

vi.mock('../api/_firebase-admin.js', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(async () => ({ exists: false })),
        set: vi.fn(),
      })),
    })),
  })),
}));

describe('buildTemplatePayload', () => {
  it('removes ownership and source identity fields from seeded templates', () => {
    const payload = buildTemplatePayload(
      {
        id: 'source-id-field',
        ownerId: 'source-owner',
        title: '11+ Diagnostic',
        slug: 'source-slug',
        questions: [{ id: 'q1', question: 'Question text' }],
      },
      'Np8zdC1SdYtk1ZdlpF3T',
      1_765_000_000_000,
    );

    expect(payload).toEqual({
      title: '11+ Diagnostic',
      slug: 'source-slug',
      questions: [{ id: 'q1', question: 'Question text' }],
      templateVersion: 1,
      templateSourceTestId: 'Np8zdC1SdYtk1ZdlpF3T',
      updatedAt: 1_765_000_000_000,
    });
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('ownerId');
  });
});
