export function acceptsBootstrapStatus(status: number) {
  const succeeded = status >= 200 && status < 300;

  // Temporary Task 2 compatibility: remove the 404 allowance when Task 4 adds the endpoint.
  return succeeded || status === 404;
}
