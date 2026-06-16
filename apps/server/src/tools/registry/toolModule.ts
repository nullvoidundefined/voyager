/**
 * Tool-registry contract. A ToolModule co-locates a tool's name, model-facing
 * description, and Zod input schema in one place; deriveDefinition turns that
 * single source into the Anthropic tool definition, so the model-facing
 * JSON Schema can never drift from the validator (it IS the validator).
 */
import type { ZodType } from 'zod';
import { z } from 'zod';

export interface ToolDefinition {
  description: string;
  input_schema: {
    properties: Record<string, unknown>;
    required: string[];
    type: 'object';
  };
  name: string;
}

export interface ToolModule {
  description: string;
  name: string;
  schema: ZodType;
}

/**
 * Derive the Anthropic tool definition from a ToolModule's Zod schema.
 * z.toJSONSchema emits draft-2020-12 extras ($schema, additionalProperties)
 * that the Anthropic input_schema shape neither needs nor allows, so we keep
 * only properties + required. Descriptions, enums, and constraints ride along
 * from the schema's .describe()/.meta() metadata.
 */
export function deriveDefinition(toolModule: ToolModule): ToolDefinition {
  const { description, name, schema } = toolModule;
  const jsonSchema = z.toJSONSchema(schema) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const { properties = {}, required = [] } = jsonSchema;

  return {
    description,
    input_schema: { properties, required, type: 'object' },
    name,
  };
}
