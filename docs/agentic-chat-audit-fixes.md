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

### Done (continued)

- [x] **Validation gap closed (the safe core of the single-source item).** The 5 tools with no Zod
      schema (`re_open_category`, `plan_daily_schedule`, `add_leg`, `remove_leg`, `reorder_legs`)
      cast LLM input with no validation. Added a Zod schema each (keys/required match the definition,
      enforced by the now-17-tool drift guard), wired `parseInput` into each executor case, added
      negative-input tests.

- [x] **Tool-result caching: already implemented (audit false positive).** All four `search_*` tool
      adapters (`flightsTool`, `hotelsTool`, `carRentalsTool`, `experiencesTool`) already cache
      results via `cacheGet`/`cacheSet` keyed on normalized input, TTL 6h. Mutations correctly do not
      cache. The audit mapped the orchestrator/executor layer and missed caching one layer down in
      the adapters, which is the correct layer. No work needed.

### Held for decision (checkpoint)

- [ ] **Flip model-facing JSON to derived-from-Zod (rest of the single-source item).** All 17 tools
      are now Zod-backed; the remaining step is deriving the Anthropic `input_schema` from Zod via
      `z.toJSONSchema` and deleting the hand-written JSON. Blocked on an eval run: deriving changes
      the exact description strings sent to the model, and the adversarial eval that confirms no
      behavior regression needs a deployed agent + real API key (cannot run locally). The drift guard
      enforces no-drift in the interim. Land as its own eval-gated change.

- [ ] **Collapse the 4-file tool-add surface.** Co-locate def + schema + handler + allowlist per
      tool module. High-churn DX-only reorg with regression risk; recommend its own dedicated change.

- [ ] **Real-time budget visibility.** Emit incremental token burn during streaming (new SSE event
      type + frontend rendering). Backend is straightforward; the frontend display is a UI design
      decision.

## Non-fixes (intentional, do not change)

- Static sub-agent routing by flow phase is a deliberate product choice, not a gap.
- Immutable turn history (no branching/rollback) is acceptable for the current product.
