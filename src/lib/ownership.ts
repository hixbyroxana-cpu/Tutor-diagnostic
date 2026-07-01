export function belongsToTutor(record: { ownerId?: string }, uid: string): boolean {
  return Boolean(uid && record.ownerId === uid);
}

function normalizeSlugTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function makeTutorSlug(title: string, uid: string): string {
  return `${normalizeSlugTitle(title)}-${uid.slice(0, 8).toLowerCase()}`;
}

export function resolveTestSlug(title: string, uid?: string, existingSlug?: string): string {
  if (existingSlug !== undefined) return existingSlug;
  return uid ? makeTutorSlug(title, uid) : normalizeSlugTitle(title);
}
