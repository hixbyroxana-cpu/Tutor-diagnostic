import { describe, expect, it } from 'vitest';
import { acceptsBootstrapStatus } from './bootstrap-response';

describe('acceptsBootstrapStatus', () => {
  it('accepts the temporary compatibility 404', () => {
    expect(acceptsBootstrapStatus(404)).toBe(true);
  });

  it('rejects a server error', () => {
    expect(acceptsBootstrapStatus(500)).toBe(false);
  });
});
