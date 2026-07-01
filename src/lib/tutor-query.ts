export function shouldFilterByOwner(authRequired: string | undefined, uid: string | undefined): boolean {
  return authRequired === 'true' && Boolean(uid);
}

export function getPublicAppBaseUrl(publicAppUrl: string | undefined, currentOrigin: string): string {
  return (publicAppUrl || currentOrigin).replace(/\/+$/, '');
}

export function canEditOwnedRecord(
  authRequired: string | undefined,
  ownerId: string | undefined,
  uid: string | undefined,
): boolean {
  if (authRequired !== 'true') return true;

  return Boolean(uid && ownerId === uid);
}
