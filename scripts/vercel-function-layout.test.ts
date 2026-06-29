import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function discoverVercelEntrypoints(
  directory: string,
  root = directory,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const discovered = await Promise.all(entries.map(async entry => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return discoverVercelEntrypoints(absolutePath, root);
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.startsWith('_')) {
      return [path.relative(root, absolutePath).split(path.sep).join('/')];
    }

    return [];
  }));

  return discovered.flat().sort();
}

describe('Vercel function layout', () => {
  it('exposes only the six runtime API handlers', async () => {
    await expect(discoverVercelEntrypoints(path.resolve('api'))).resolves.toEqual([
      'account/bootstrap.ts',
      'gemini/generate-specific.ts',
      'gemini/generate-test.ts',
      'gemini/parent-summary.ts',
      'public/submit-result.ts',
      'public/test.ts',
    ]);
  });
});
