import type { Test } from '../../src/types.js';
import { makeTutorSlug } from '../../src/lib/ownership.js';

export type StarterTestTemplate = Test & { id: string };
export type StarterTestPayload<T extends StarterTestTemplate = StarterTestTemplate> = Omit<T, 'id'> & {
  ownerId: string;
  templateSourceId: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  isActive: true;
};

export function buildStarterTest<T extends StarterTestTemplate>(template: T, uid: string, now: number): StarterTestPayload<T> {
  const { id, ...payload } = template;

  return {
    ...payload,
    ownerId: uid,
    templateSourceId: id,
    slug: makeTutorSlug(template.title, uid),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };
}
