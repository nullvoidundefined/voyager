# PR: Module-per-tool registry + derive model-facing JSON from Zod

Branch: `refactor/tool-registry-zod-derivation`, off `main`. Originally stacked on
`refactor/agentic-chat-audit-fixes` (PR #42); rebased onto `main` after #42 merged, so
this PR now targets `main` and contains a single commit. The rebase picked up #42's late
tightening of the nested schedule schemas (`item_order`/`day_number` -> `int().positive()`,
`place_id` -> `max(100)`), carried into `registry/planDailySchedule.ts`.
Date: 2026-06-15. Time since implementation: same session (authored and verified today).

## Summary

Closes the last item from the agentic-chat audit (`docs/agentic-chat-audit-fixes.md`):
the "(b) module-per-tool registry" and "(a2) derive model-facing JSON from Zod"
follow-up, shipped as one PR. The hand-maintained 526-line `TOOL_DEFINITIONS` JSON in
`definitions.ts` is deleted; each tool's Anthropic `input_schema` is now derived from its
Zod schema, so the schema the model sees and the schema the executor validates against are
the same object and cannot drift.

## What changed

- **New `tools/registry/` (17 per-tool modules).** Each module co-locates one tool's
  name, model-facing description, and Zod input schema (e.g. `searchFlights.ts`). Adding a
  tool is now: create a module, add it to `TOOL_REGISTRY`.
- **`registry/toolModule.ts`.** `ToolModule`/`ToolDefinition` types + `deriveDefinition`,
  which runs Zod 4's native `z.toJSONSchema` and keeps `{ properties, required, type }`
  (dropping the draft-2020-12 `$schema`/`additionalProperties` the Anthropic shape rejects).
- **`registry/primitives.ts`.** Shared `locationAllowlist` (SEC-03) and `dateString`,
  moved out of `schemas.ts`.
- **`registry/toolRegistry.ts`.** The single ordered `TOOL_REGISTRY` array. Kept separate
  from both consumers so neither `definitions.ts` nor `schemas.ts` imports the other.
- **`definitions.ts`** now derives `TOOL_DEFINITIONS = TOOL_REGISTRY.map(deriveDefinition)`
  (526 lines -> ~11). **`schemas.ts`** re-exports each named schema (executor imports
  unchanged) and derives the `toolSchemas` lookup from the registry.
- **Descriptions ported into Zod** via `.describe()` on every property/object that carried
  one in the old JSON, so derivation does not drop them.
- **Test:** `schemaDrift.test.ts` (now tautological, since definitions derive from schemas)
  replaced by `derivation.test.ts`, which asserts the derived schema preserves the frozen
  human baseline (`__fixtures__/toolDefinitionsBaseline.json`): every tool/property/object
  description, enum, type, and required set, at any depth.

## Architectural decisions

1. **Derive natively with `z.toJSONSchema` (Zod 4), not the `zod-to-json-schema` package
   the pattern doc named.** Chosen: native, because the codebase is on Zod 4 and the drift
   guard already used it. Alternative: add the third-party dep. Why: zero new dependency,
   one conversion path.

2. **Port descriptions into Zod, accept richer derived schemas.** Byte-equivalence with the
   old JSON is impossible: the Zod schemas had no descriptions (naive derivation would drop
   them) and the location/date primitives add `pattern`/`min`/`max` the old JSON lacked.
   Chosen: move descriptions into `.describe()` and let the model receive the richer,
   stricter schema (e.g. whole-number fields now type `integer`; location fields now carry
   the security regex). Alternative: ship (b) only and keep the drift guard; or flip only
   the few description-free tools. Why: the richer schema is strictly more correct and
   delivers a2's actual goal (one source of truth). The preservation test proves nothing the
   model previously saw was lost.

3. **Keep `SUB_AGENT_TOOLS` a separate curated map; do not relocate `SubAgentType`.** Chosen:
   the registry derives only `TOOL_DEFINITIONS` + `toolSchemas`. `SUB_AGENT_TOOLS` stays its
   own ordered map in `subAgentService.ts`, preserving the `format_response`-last ordering
   and the ORC-01/SEC-01 rationale comments. Alternative: invert per-tool membership flags to
   rebuild the map. Why: inversion loses the explicit ordering and rationale for no real
   gain; ordering is cosmetic but the comments are load-bearing documentation. Because the
   registry never imports `subAgentService`, the registry<->subAgentService cycle the handoff
   anticipated does not arise, so the planned `SubAgentType` relocation was unnecessary churn
   and was skipped.

4. **`format_response` validator tightenings.** Two fields were drifting (validator looser
   than the advertised schema): `citations.source_type` was `z.string()` while the model was
   shown an enum (now `z.enum([...])`), and `plan_card` was `z.unknown()` which emits no
   `type` (now `z.looseObject({})`, keeping `type: 'object'`). Both align the validator with
   what the model already sees. The one em dash in the `format_response` description (a
   pre-existing R-001 violation) was fixed to a period.

## Testing

- `npx tsc --noEmit`: clean.
- Full server suite: **1104 passed (76 files)**, stable across repeat runs (2 transient
  failures in one run were unrelated Redis-fail-open / 15s-timeout flakes; not reproducible).
- `derivation.test.ts`: 18 tests (17 tools + a name-set check) guard the baseline contract.
- `eslint src/tools`: 0 errors (the `non-literal-fs-filename` warning matches the existing
  `agentService.fixture.test.ts` fixture-loading convention).
- `pnpm build`: green; the new `app/` path aliases resolve under `tsc-alias`.

## Reflection

What I understand now: a2 was never a mechanical "swap JSON for derived JSON." The value is
single-sourcing, and that forced the descriptions to live in the validator, which in turn
surfaced two real validator/model drifts (`source_type`, `plan_card`) the drift guard had not
caught because it only compared property keys and required, not types/enums.

What I got wrong first: I initially had `schemas.ts` import `TOOL_REGISTRY` from
`definitions.ts`. Three suites that `vi.mock('app/tools/definitions.js')` then broke schema
derivation at module-eval. Extracting `toolRegistry.ts` as a neutral third module both fixed
it and is the more honest dependency shape (definitions and schemas are siblings deriving from
a shared source, not a chain).
