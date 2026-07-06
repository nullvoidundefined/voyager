import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Content assertions for api.ts.
 *
 * Guards against the "return undefined as T" type lie for 204 responses.
 */

const apiPath = resolve(__dirname.replace('/__tests__/', '/'), 'request.ts');
const apiSource = readFileSync(apiPath, 'utf-8');

describe('request.ts content', () => {
  it('does not use "undefined as T" type assertion for 204 responses', () => {
    expect(apiSource).not.toContain('undefined as T');
  });

  it('request function return type includes undefined', () => {
    expect(apiSource).toMatch(
      /function request[\s\S]*?Promise<T \| undefined>/,
    );
  });

  it('put and del return types include undefined', () => {
    expect(apiSource).toMatch(/function put[\s\S]*?Promise<T \| undefined>/);
    expect(apiSource).toMatch(/function del[\s\S]*?Promise<T \| undefined>/);
  });
});
