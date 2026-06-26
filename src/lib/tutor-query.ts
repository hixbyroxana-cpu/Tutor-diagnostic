export function shouldFilterByOwner(authRequired: string | undefined, uid: string | undefined): boolean {
  return authRequired === 'true' && Boolean(uid);
}

export function getPublicAppBaseUrl(publicAppUrl: string | undefined, currentOrigin: string): string {
  return (publicAppUrl || currentOrigin).replace(/\/+$/, '');
}
