# PR: Drop the unused `toolSchemas` export

Branch: `refactor/drop-unused-toolschemas`, off `main`.
Date: 2026-06-15. Time since implementation: same session.

## Summary

Follow-up to the tool-registry refactor (#43). Removes the dead `toolSchemas`
name->schema map from `tools/schemas.ts`. Its only consumer was the old
`schemaDrift.test.ts`, which #43 deleted (the derivation test replaced it), so the export
has had no code references since. `tools/schemas.ts` becomes a pure re-export barrel of the 17
named per-tool schemas, which is all `executor.ts` actually imports.

Resolves the Copilot review finding on #43 (the module comment described `toolSchemas` as
the validation-dispatch surface, but nothing referenced it). The merged auto-fix corrected
the comment; this removes the export the comment was describing.

## What changed

- `tools/schemas.ts`: deleted the `toolSchemas` const and its now-unused `TOOL_REGISTRY`
  and `ZodType` imports. The file is now only the 17 `export { xSchema } from registry`
  re-exports.

## Decision: delete vs. wire into the executor

The alternative was to make `toolSchemas` live by routing the executor's validation through
it (`toolSchemas[name].safeParse(input)`). Rejected: `toolSchemas` is typed
`Record<string, ZodType>`, so a generic lookup returns `unknown` and would force an `as`
cast in all 17 executor cases. The current per-case `parseInput(name, namedSchema, input)`
yields a precisely-typed `parsed.data` that flows into each typed adapter call. Per-case
validation already fulfills the canonical pattern's contract ("safeParse the input against
the tool's Zod schema") with better type safety, so the generic lookup is unnecessary.

Note: the cross-repo `agentic-chat-pattern.md` lists a `toolSchemas` lookup as part of the
standard. Voyager validates per-case instead; the lookup is optional for an executor that
already dispatches type-safely. (Not updating the doc here to keep this PR single-scope.)

## Testing

- `tsc --noEmit`: clean (confirms nothing referenced the removed export).
- `vitest run src/tools` (from `apps/server`): 452 passed.
- `eslint src/tools/schemas.ts` (from `apps/server`): clean.

## Reflection

Small, but the right close-out: a derived registry made the parallel `toolSchemas` map
redundant, and carrying a dead export "because the pattern doc mentions it" is the kind of
speculative surface the export-hygiene rule exists to prevent.
