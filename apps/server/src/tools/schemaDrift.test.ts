/**
 * Drift guard: for each tool with a Zod input schema, ensure the tool definition's
 * top-level property keys and `required` list match the Zod schema's top-level object.
 * Prevents the validator and the model-facing schema from diverging,
 * e.g. a field the validator accepts but the model is never told about
 * (flexible_dates regression, 2026-06 audit). Until the canonical pattern's
 * derive-from-Zod refactor lands, this test enforces the no-drift invariant.
 */
import { TOOL_DEFINITIONS } from 'app/tools/definitions.js';
import { toolSchemas } from 'app/tools/schemas.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

interface DerivedSchema {
  properties?: Record<string, unknown>;
  required?: string[];
}

describe('tool schema drift guard', () => {
  for (const [name, schema] of Object.entries(toolSchemas)) {
    it(`${name}: top-level definition keys and required match the Zod schema`, () => {
      const derived = z.toJSONSchema(schema) as DerivedSchema;
      const definition = TOOL_DEFINITIONS.find((t) => t.name === name);
      expect(definition).toBeDefined();

      const derivedKeys = Object.keys(derived.properties ?? {}).sort();
      const definitionKeys = Object.keys(
        definition!.input_schema.properties,
      ).sort();
      expect(definitionKeys).toEqual(derivedKeys);

      const derivedRequired = [...(derived.required ?? [])].sort();
      const definitionRequired = [
        ...(definition!.input_schema.required ?? []),
      ].sort();
      expect(definitionRequired).toEqual(derivedRequired);
    });
  }
});
