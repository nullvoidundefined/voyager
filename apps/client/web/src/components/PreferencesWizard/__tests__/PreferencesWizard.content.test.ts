import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content assertions for PreferencesWizard.
 *
 * Guards against unhandled promise rejections when the save
 * endpoint fails.
 */

const wizardPath = resolve(__dirname, '..', 'PreferencesWizard.tsx');
const wizardSource = readFileSync(wizardPath, 'utf-8');

describe('PreferencesWizard content', () => {
  it('handleNext wraps saveCurrentStep in a try/catch', () => {
    // The handleNext function must catch save errors rather than
    // letting them propagate as unhandled promise rejections.
    const fnMatch = wizardSource.match(
      /function handleNext[\s\S]*?try\s*\{[\s\S]*?saveCurrentStep[\s\S]*?\}\s*catch/,
    );
    expect(fnMatch).not.toBeNull();
  });

  it('displays save errors to the user', () => {
    expect(wizardSource).toContain('saveError');
  });
});
