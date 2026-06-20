/**
 * Regression guard for the vitest test.include glob.
 *
 * The convention-cleanup refactor narrowed test.include to
 * 'src/__tests__/**' and silently stranded the mockAnthropicClient
 * suite that lives beside its fixture, collapsing coverage below the
 * threshold. This test asserts every *.test.ts on disk is claimed by a
 * runner: either matched by the unit-test include (and not excluded) or
 * carved out by an exclude pattern for the integration pass. A test file
 * that matches neither is orphaned and will never run.
 *
 * The vitest config is read as text rather than imported because it
 * lives outside the compiler's rootDir (src); a static import would
 * break the tsc build.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SRC_ROOT = path.join(PACKAGE_ROOT, 'src');
const CONFIG_PATH = path.join(PACKAGE_ROOT, 'vitest.config.ts');
const REGEXP_SPECIALS = '.+^${}()|[]\\';

function extractStringArray(
  source: string,
  key: string,
  occurrence: 'first' | 'last',
): string[] {
  const marker = `${key}: [`;
  const opening =
    occurrence === 'last' ? source.lastIndexOf(marker) : source.indexOf(marker);
  if (opening === -1) {
    throw new Error(`Could not find "${key}" array in vitest.config.ts`);
  }
  const closing = source.indexOf(']', opening);
  const body = source.slice(opening, closing);
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
}

function globToRegExp(glob: string): RegExp {
  let pattern = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob.charAt(index);
    if (
      character === '*' &&
      glob.charAt(index + 1) === '*' &&
      glob.charAt(index + 2) === '/'
    ) {
      pattern += '(?:.*/)?';
      index += 2;
    } else if (character === '*' && glob.charAt(index + 1) === '*') {
      pattern += '.*';
      index += 1;
    } else if (character === '*') {
      pattern += '[^/]*';
    } else if (REGEXP_SPECIALS.includes(character)) {
      pattern += `\\${character}`;
    } else {
      pattern += character;
    }
  }
  return new RegExp(`^${pattern}$`);
}

function listTestFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTestFiles(absolutePath));
    } else if (entry.name.endsWith('.test.ts')) {
      files.push(
        path.relative(PACKAGE_ROOT, absolutePath).split(path.sep).join('/'),
      );
    }
  }
  return files;
}

function matchesAny(relativePath: string, globs: string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(relativePath));
}

describe('vitest test file discovery', () => {
  const configSource = readFileSync(CONFIG_PATH, 'utf-8');
  // include appears once (test.include); exclude appears twice
  // (coverage.exclude first, test.exclude last) -- target test.exclude.
  const include = extractStringArray(configSource, 'include', 'first');
  const exclude = extractStringArray(configSource, 'exclude', 'last');
  const testFiles = listTestFiles(SRC_ROOT);

  it('finds the mockAnthropicClient suite on disk', () => {
    const mockSuite = testFiles.filter((file) =>
      file.includes('mockAnthropicClient'),
    );
    expect(mockSuite.length).toBeGreaterThan(0);
  });

  it('claims every test file by a runner (none orphaned)', () => {
    const orphaned = testFiles.filter((file) => {
      const runByUnitPass =
        matchesAny(file, include) && !matchesAny(file, exclude);
      const carvedOutForIntegration = matchesAny(file, exclude);
      return !runByUnitPass && !carvedOutForIntegration;
    });
    expect(orphaned).toEqual([]);
  });
});
