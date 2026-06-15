/**
 * Anthropic tool definitions, derived from the per-tool registry. Each tool's
 * model-facing input_schema is generated from its Zod schema (deriveDefinition),
 * so the schema the model sees and the schema the executor validates against are
 * one and the same and cannot drift. To add a tool, edit TOOL_REGISTRY.
 */
import { deriveDefinition } from 'app/tools/registry/toolModule.js';
import { TOOL_REGISTRY } from 'app/tools/registry/toolRegistry.js';

export type { ToolDefinition } from 'app/tools/registry/toolModule.js';

export const TOOL_DEFINITIONS = TOOL_REGISTRY.map(deriveDefinition);
