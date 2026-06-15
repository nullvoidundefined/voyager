# voyager: Agentic Chat Audit Fixes

voyager is the reference implementation for the canonical agentic chat pattern
(`../../doppelscript/docs/future-work/agentic-chat-pattern.md`). These cleanups make the
reference match the documented standard. Strong test net already in place (server 85%
coverage, adversarial judge harness, chat/tool E2E).

## Status (2026-06-15)

Branch `refactor/agentic-chat-audit-fixes`. The two correctness fixes are landed and verified
(tests + tsc green). The remaining three are larger or carry product decisions and are held for
review (see "Held for decision").

### Done

- [x] **Extract LLM client (R-220/R-222).** `new Anthropic()` was instantiated inside
      `AgentOrchestrator`. Moved SDK construction to `clients/llm.ts` (lazy singleton); model id
      moved to `constants/models.ts` (R-219). Tests inject their own client, so the fallback path
      is runtime-only. (`AgentOrchestrator.test.ts` green.)

- [x] **Tool-schema drift guard + two latent-bug fixes.** Added `tools/schemaDrift.test.ts`
      asserting every Zod-backed tool's definition keys + required match the schema. It surfaced: - `search_flights.flexible_dates`: implemented in the handler and accepted by Zod but missing
      from the model-facing definition (model could never trigger it). Added to the definition. - `select_*.booking_url`: advertised to the model but absent from Zod (silently stripped) and
      read by no handler. Removed.

### Held for decision (checkpoint)

- [ ] **Single source of truth via Zod derivation.** The documented end state is deriving the
      Anthropic `input_schema` from the Zod schema via `z.toJSONSchema` (Zod 4 native, no new dep).
      Deferred because: (1) 5 of 17 tools (`re_open_category`, `plan_daily_schedule`, `add_leg`,
      `remove_leg`, `reorder_legs`) have **no** Zod schema, so they would need new ones (also closes
      a validation gap); (2) deriving changes the exact description strings sent to the model, which
      needs an adversarial-eval run to confirm no behavior regression. The drift guard already
      enforces the no-drift invariant in the interim. **Recommend** doing this as its own
      eval-gated change.

- [ ] **Collapse the 4-file tool-add surface.** Co-locate def + schema + handler + allowlist per
      tool module. High-churn DX-only reorg; recommend its own dedicated change, not bundled.

- [ ] **Tool-result caching.** Memoize identical searches. Carries a correctness tradeoff (travel
      prices/availability go stale) and a TTL + cache-key-normalization design decision. Needs a
      product call on acceptable staleness per tool.

- [ ] **Real-time budget visibility.** Emit incremental token burn during streaming (new SSE event
      type + frontend rendering). Feature work spanning orchestrator, shared-types, and UI.

## Non-fixes (intentional, do not change)

- Static sub-agent routing by flow phase is a deliberate product choice, not a gap.
- Immutable turn history (no branching/rollback) is acceptable for the current product.
