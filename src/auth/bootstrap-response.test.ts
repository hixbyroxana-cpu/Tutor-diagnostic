import { describe, expect, it } from 'vitest';
import { acceptsBootstrapStatus } from './bootstrap-response';

describe('acceptsBootstrapStatus', () => {
  it('accepts successful bootstrap responses', () => {
    expect(acceptsBootstrapStatus(200)).toBe(true);
    expect(acceptsBootstrapStatus(204)).toBe(true);
  });

  it('rejects a missing bootstrap endpoint', () => {
    expect(acceptsBootstrapStatus(404)).toBe(false);
  });

  it('rejects a server error', () => {
    expect(acceptsBootstrapStatus(500)).toBe(false);
  });
});
