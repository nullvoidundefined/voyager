/**
 * No-regression guard for the Zod-derived tool definitions. Asserts the
 * model-facing JSON Schema generated from each tool's Zod schema preserves
 * everything the hand-written baseline (toolDefinitionsBaseline.json, captured
 * before the derive-from-Zod refactor) told the model: tool descriptions, every
 * property/object description, every enum, every type, and every required set,
 * at any depth. The derived schema may ADD constraints (regex, min/max derived
 * from the validator) and may narrow number->integer; it must never drop or
 * change what the model previously saw.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';

interface BaselineDefinition {
  description: string;
  input_schema: SchemaNode;
  name: string;
}

interface SchemaNode {
  description?: string;
  enum?: string[];
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  type?: string;
}

const baseline = JSON.parse(
  readFileSync(
    new URL(
      '../../__fixtures__/tools/toolDefinitionsBaseline.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as BaselineDefinition[];

function isTypePreserved(baseType: string, derivedType: string): boolean {
  if (baseType === derivedType) return true;
  // Validator narrows whole-number fields the hand-written schema typed loosely.
  return baseType === 'number' && derivedType === 'integer';
}

function collectMismatches(
  path: string,
  base: SchemaNode,
  derived: SchemaNode | undefined,
  out: string[],
): void {
  if (!derived) {
    out.push(`${path}: missing in derived schema`);
    return;
  }
  if (
    base.description !== undefined &&
    derived.description !== base.description
  ) {
    out.push(
      `${path}: description changed\n  was: ${base.description}\n  now: ${derived.description}`,
    );
  }
  if (base.enum) {
    const baseEnum = [...base.enum].sort();
    const derivedEnum = [...(derived.enum ?? [])].sort();
    if (JSON.stringify(baseEnum) !== JSON.stringify(derivedEnum)) {
      out.push(`${path}: enum changed (was ${baseEnum.join(',')})`);
    }
  }
  if (base.type && !isTypePreserved(base.type, derived.type ?? '')) {
    out.push(`${path}: type ${base.type} -> ${derived.type}`);
  }
  if (base.required) {
    const baseReq = [...base.required].sort();
    const derivedReq = [...(derived.required ?? [])].sort();
    if (JSON.stringify(baseReq) !== JSON.stringify(derivedReq)) {
      out.push(
        `${path}: required changed\n  was: ${baseReq.join(',')}\n  now: ${derivedReq.join(',')}`,
      );
    }
  }
  if (base.properties) {
    for (const [key, child] of Object.entries(base.properties)) {
      collectMismatches(
        `${path}.${key}`,
        child,
        derived.properties?.[key],
        out,
      );
    }
  }
  if (base.items) {
    collectMismatches(`${path}[]`, base.items, derived.items, out);
  }
}

describe('Zod-derived tool definitions preserve the baseline contract', () => {
  it('derives one definition per baseline tool, no more no less', () => {
    const baselineNames = baseline.map((t) => t.name).sort();
    const derivedNames = TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(derivedNames).toEqual(baselineNames);
  });

  for (const baseTool of baseline) {
    it(`${baseTool.name}: model-facing schema is preserved`, () => {
      const derived = TOOL_DEFINITIONS.find((t) => t.name === baseTool.name);
      expect(
        derived,
        `${baseTool.name} missing from TOOL_DEFINITIONS`,
      ).toBeDefined();
      expect(derived!.description).toBe(baseTool.description);

      const mismatches: string[] = [];
      collectMismatches(
        baseTool.name,
        baseTool.input_schema,
        derived!.input_schema as SchemaNode,
        mismatches,
      );
      expect(mismatches, mismatches.join('\n')).toEqual([]);
    });
  }
});
