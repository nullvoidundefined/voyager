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
      `AgentOrchestrator`. Moved SDK construction to `clients/llm.ts` (factory); model id
      moved to `constants/models.ts` (R-219). Tests inject their own client, so the fallback path
      is runtime-only. (`AgentOrchestrator.test.ts` green.)

- [x] **Tool-schema drift guard + two latent-bug fixes.** Added `tools/schemaDrift.test.ts`
      asserting every Zod-backed tool's definition keys + required match the schema. It surfaced:
      - `search_flights.flexible_dates`: implemented in the handler and accepted by Zod but missing
        from the model-facing definition (model could never trigger it). Added to the definition.
      - `select_*.booking_url`: advertised to the model but absent from Zod (silently stripped) and
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

- [x] **Real-time budget visibility shipped.** A `budget` SSE event streams cumulative token usage
      after each agent iteration; `useSSEChat` exposes `liveTokens` and `ChatBox` renders a live
      spend indicator. Backed by an orchestrator emission test and a hook guard.

### Held for decision (one focused follow-up PR)

- [ ] **(b)+(a2): module-per-tool registry + Zod-derivation, as ONE PR.** Co-locate definition +
      schema + subAgents per tool in one module; derive `TOOL_DEFINITIONS`, `toolSchemas`, and
      `SUB_AGENT_TOOLS` from the registry; then derive each tool's model-facing `input_schema` from
      its Zod schema (a per-tool module is the natural home for it). The derivation is locally
      verifiable when the derived JSON equals the current hand-written JSON (equivalence test);
      otherwise flip only equivalence-proven tools and leave the rest under the drift guard.
      `SubAgentType` is imported only by `subAgentService`, so relocate it to a neutral module to
      avoid a registry<->subAgentService cycle. ~0.5-1 day.

## Non-fixes (intentional, do not change)

- Static sub-agent routing by flow phase is a deliberate product choice, not a gap.
- Immutable turn history (no branching/rollback) is acceptable for the current product.
