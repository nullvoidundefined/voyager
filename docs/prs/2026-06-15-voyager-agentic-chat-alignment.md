# Voyager Agentic-Chat Alignment

PR #42 - branch `refactor/agentic-chat-audit-fixes` - opened 2026-06-15.

Time since implementation: written same day as the commits (2026-06-15).

> Scope note: this PR predates the "one PR, one scope" convention and bundles a
> refactor, two fixes, and a feature under the single cohesive scope of aligning
> voyager (the reference implementation) to the canonical agentic-chat pattern.
> Kept as one PR by decision; one-scope is honored strictly for subsequent PRs.

## Summary

Aligns voyager's chat/tool system to the cross-repo canonical agentic-chat pattern
(`../../../doppelscript/docs/future-work/agentic-chat-pattern.md`). voyager is the
reference implementation; these changes close the gaps between it and the documented
standard and fix latent bugs surfaced along the way.

## What changed

- **Provider client extraction (R-220/R-222).** `new Anthropic()` removed from
  `AgentOrchestrator`; SDK construction moved to `clients/llm.ts` (a factory, not a
  cached singleton, to preserve the per-construction behavior the agent tests rely
  on). Model id moved to `constants/models.ts` (R-219).
- **Tool-schema drift guard + two latent-bug fixes.** `tools/schemaDrift.test.ts`
  asserts every Zod-backed tool's definition keys + required match its schema. It
  caught: `search_flights.flexible_dates` (implemented + Zod-accepted but missing
  from the model-facing definition, so unreachable) and `select_*.booking_url`
  (advertised to the model, stripped by Zod, read by nobody).
- **Validation gap closed.** The 5 tools with no Zod schema (`re_open_category`,
  `plan_daily_schedule`, `add_leg`, `remove_leg`, `reorder_legs`) now validate input;
  the drift guard covers all 17 tools.
- **Real-time token budget (feat).** A `budget` SSE event streams cumulative token
  usage after each agent iteration; the chat UI shows live spend instead of only a
  post-turn total.

## Architectural decisions

- **Client as factory, not singleton.** Chosen: a plain factory. Alternative: a
  lazily-cached singleton (as the canonical doc suggests). Why: a module-level
  singleton broke the agent tests' per-test mock rebinding, and voyager already built
  a client per orchestrator, so caching would be a behavior change for no real gain.
- **Drift guard instead of immediate Zod-derivation.** Chosen: keep hand-written
  model-facing JSON, enforce no-drift with a test. Alternative: derive the JSON from
  Zod now. Why: deriving changes the exact description strings sent to the model and
  needs an adversarial-eval run (deployed agent + live key) to confirm no regression,
  which cannot run locally. The derivation is a documented eval-gated follow-up.
- **booking_url removed, not completed.** Chosen: delete the dead field. Alternative:
  wire it through to persistence. Why: no handler consumed it and completing it is a
  product feature, out of scope for a drift fix.

## Testing

- Full server unit suite: 1098 passing.
- New: drift guard (17 cases), negative-input tests for the 5 newly-validated tools,
  orchestrator budget-emission test, frontend budget-handling guard.
- `tsc --noEmit` clean (server + web app code); `pnpm build` green.

## Reflection

What I understand now: voyager's caching was an audit false positive (it lives in the
tool adapters, the correct layer, not the orchestrator), and the "4-file tool-add"
pain is mostly mitigated once the drift guard exists. What I got wrong first: I
introduced the client as a cached singleton matching the canonical doc, which broke
the agent tests via shared mock state; the factory is the correct shape for this
codebase. The doc has been amended to note factory-vs-singleton is a per-codebase call.
