export function belongsToTutor(record: { ownerId?: string }, uid: string): boolean {
  return Boolean(uid && record.ownerId === uid);
}

export function makeTutorSlug(title: string, uid: string): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${normalizedTitle}-${uid.slice(0, 8).toLowerCase()}`;
}
