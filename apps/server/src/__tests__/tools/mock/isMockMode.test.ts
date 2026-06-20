import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isMockMode } from 'app/tools/mock/isMockMode.js';

describe('isMockMode', () => {
  let originalEval: string | undefined;
  let originalE2E: string | undefined;

  beforeEach(() => {
    originalEval = process.env.EVAL_MOCK_SEARCH;
    originalE2E = process.env.E2E_MOCK_TOOLS;
    delete process.env.EVAL_MOCK_SEARCH;
    delete process.env.E2E_MOCK_TOOLS;
  });

  afterEach(() => {
    if (originalEval === undefined) {
      delete process.env.EVAL_MOCK_SEARCH;
    } else {
      process.env.EVAL_MOCK_SEARCH = originalEval;
    }
    if (originalE2E === undefined) {
      delete process.env.E2E_MOCK_TOOLS;
    } else {
      process.env.E2E_MOCK_TOOLS = originalE2E;
    }
  });

  it('returns true when EVAL_MOCK_SEARCH is "true"', () => {
    process.env.EVAL_MOCK_SEARCH = 'true';
    expect(isMockMode()).toBe(true);
  });

  it('returns true when E2E_MOCK_TOOLS is "1"', () => {
    process.env.E2E_MOCK_TOOLS = '1';
    expect(isMockMode()).toBe(true);
  });

  it('returns false when E2E_MOCK_TOOLS is "0"', () => {
    process.env.E2E_MOCK_TOOLS = '0';
    expect(isMockMode()).toBe(false);
  });

  it('returns false when E2E_MOCK_TOOLS is "true" (only "1" enables it)', () => {
    process.env.E2E_MOCK_TOOLS = 'true';
    expect(isMockMode()).toBe(false);
  });

  it('returns false when neither flag is set', () => {
    expect(isMockMode()).toBe(false);
  });

  it('returns false when EVAL_MOCK_SEARCH is "false"', () => {
    process.env.EVAL_MOCK_SEARCH = 'false';
    expect(isMockMode()).toBe(false);
  });

  it('returns false when EVAL_MOCK_SEARCH is empty string', () => {
    process.env.EVAL_MOCK_SEARCH = '';
    expect(isMockMode()).toBe(false);
  });
});
