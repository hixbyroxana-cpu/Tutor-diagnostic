export function acceptsBootstrapStatus(status: number) {
  return status >= 200 && status < 300;
}
