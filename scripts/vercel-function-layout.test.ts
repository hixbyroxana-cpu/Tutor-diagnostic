import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const VERCEL_FUNCTION_SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

function resolveApiDirectory(moduleUrl: string | URL): string {
  return fileURLToPath(new URL('../api', moduleUrl));
}

function isVercelFunctionSource(fileName: string): boolean {
  return !fileName.startsWith('_')
    && !/\.d\.(?:cts|mts|ts)$/.test(fileName)
    && VERCEL_FUNCTION_SOURCE_EXTENSIONS.has(path.extname(fileName));
}

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

    if (entry.isFile() && isVercelFunctionSource(entry.name)) {
      return [path.relative(root, absolutePath).split(path.sep).join('/')];
    }

    return [];
  }));

  return discovered.flat().sort();
}

describe('Vercel function layout', () => {
  it('resolves the API directory relative to the test module URL', () => {
    const repositoryDirectory = path.join(tmpdir(), 'repository');
    const moduleUrl = new URL(
      'scripts/vercel-function-layout.test.ts',
      pathToFileURL(`${repositoryDirectory}${path.sep}`),
    );

    expect(resolveApiDirectory(moduleUrl)).toBe(path.join(repositoryDirectory, 'api'));
  });

  it('detects JavaScript and TypeScript sources but excludes declarations, maps, and private files', async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'vercel-function-layout-'));
    const nestedDirectory = path.join(fixtureRoot, 'nested');

    try {
      await mkdir(nestedDirectory);
      await Promise.all([
        'handler.js',
        'handler.mjs',
        'handler.cjs',
        'handler.ts',
        'handler.mts',
        'handler.cts',
        'handler.jsx',
        'handler.tsx',
        'handler.d.ts',
        'handler.d.mts',
        'handler.d.cts',
        'handler.js.map',
        'handler.ts.map',
        '_private.ts',
      ].map(fileName => writeFile(path.join(nestedDirectory, fileName), '')));

      await expect(discoverVercelEntrypoints(fixtureRoot)).resolves.toEqual([
        'nested/handler.cjs',
        'nested/handler.cts',
        'nested/handler.js',
        'nested/handler.jsx',
        'nested/handler.mjs',
        'nested/handler.mts',
        'nested/handler.ts',
        'nested/handler.tsx',
      ]);
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true });
    }
  });

  it('exposes only the six runtime API handlers', async () => {
    await expect(discoverVercelEntrypoints(resolveApiDirectory(import.meta.url))).resolves.toEqual([
      'account/bootstrap.ts',
      'gemini/generate-specific.ts',
      'gemini/generate-test.ts',
      'gemini/parent-summary.ts',
      'public/submit-result.ts',
      'public/test.ts',
    ]);
  });
});
