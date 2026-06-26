import type { Test, TutorProfile } from '../../src/types.js';
import { makeTutorSlug } from '../../src/lib/ownership.js';

export const REQUIRED_STARTER_TEMPLATE_IDS = [
  '11-plus-diagnostic',
  'gcse-foundation-overall-revision',
] as const;

export type StarterTestTemplate = Test & { id: string };
export type StarterTestPayload<T extends StarterTestTemplate = StarterTestTemplate> = Omit<T, 'id'> & {
  ownerId: string;
  templateSourceId: string;
  slug: string;
  createdAt: number;
  updatedAt: number;
  isActive: true;
};
export type TutorIdentity = {
  uid: string;
  email?: string;
  name?: string;
};
export type ExistingTutorProfile = Partial<Pick<TutorProfile, 'createdAt'>>;

export function assertRequiredStarterTemplates(templates: StarterTestTemplate[]) {
  const templateIds = new Set(templates.map(template => template.id));
  const missingTemplateIds = REQUIRED_STARTER_TEMPLATE_IDS.filter(templateId => !templateIds.has(templateId));

  if (missingTemplateIds.length > 0) {
    throw new Error(`Missing required starter test templates: ${missingTemplateIds.join(', ')}`);
  }
}

export function selectRequiredStarterTemplates(templates: StarterTestTemplate[]) {
  assertRequiredStarterTemplates(templates);
  const templatesById = new Map(templates.map(template => [template.id, template]));

  return REQUIRED_STARTER_TEMPLATE_IDS.map(templateId => templatesById.get(templateId)!);
}

export function buildTutorProfile(tutor: TutorIdentity, existingProfile: ExistingTutorProfile | undefined, now: number): TutorProfile {
  const email = tutor.email ?? '';
  const displayName = tutor.name || email.split('@')[0] || 'Tutor';

  return {
    uid: tutor.uid,
    email,
    displayName,
    createdAt: typeof existingProfile?.createdAt === 'number' ? existingProfile.createdAt : now,
    templatesProvisionedAt: now,
  };
}

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
