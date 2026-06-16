# PR: Convention-compliance cleanup (2026-06-16 engineering audit)

Branch: `refactor/convention-cleanup`, off `main`.
Date: 2026-06-16. Time since implementation: same session.

## Summary

Resolves the actionable findings from the 2026-06-16 engineering convention-compliance
audit (`docs/audits/2026-06-16-engineering.md`, local-only). Five verified phases, one commit
each, restructuring directory/layer layout, relocating all tests, fixing two frontend
conventions, aligning a stale doc, and backfilling file headers. No behavior change; every
phase verified with tsc + full test suites + build before commit.

## What changed (by phase)

1. **Structural layout (E-001..E-005, E-015)** `73536ea`
   - SDK singletons moved out of `services/` into `clients/`: `redis`, `posthog`, `logger`.
   - `utils/` (a banned tree, R-220) deleted; its contents relocated: `ApiError`->`errors/`,
     `CircuitBreaker`->`resilience/`, parsers->`services/parsers/` (flattened),
     test `uuids`->`test-fixtures/`.
   - `db/`->`database/` (R-229). Single-file repository folders flattened (R-223).
   - `pool` and `posthog` converted from default to named exports (CLAUDE-BACKEND).

2. **Test relocation (E-008)** `4b90fbf`
   - All 133 co-located test files (86 server, 47 client) moved into per-directory
     `__tests__/` siblings, with relative-import depth and `resolve(__dirname,...)` source
     paths fixed. Both vitest `include` patterns set to `src/**/__tests__/**`. Server
     coverage excludes left stale by phase 1 were corrected.

3. **Frontend conventions (E-009, E-007)** `5e5e10b`
   - E-009: the trip page's `useEffect`+`fetch` Mapbox geocoding became a `useQuery` keyed on
     a signature of the geocode inputs (cached, re-resolves on change), with the geocoding
     extracted into named `buildTripMapPins`/`geocodePlace` helpers.
   - E-007: added `next`/`app/`/`@/` groups to the prettier `importOrder` (see Decisions).

4. **Doc alignment (E-010)** `52ce7df`
   - Updated the CLAUDE.md bug-tracking rule to reference `docs/todos/P{1,2,3}-*.md` (the real
     location, segmented by severity) instead of a `docs/BUGS.md` that never existed.

5. **File headers (E-006)** `309b006`
   - R-230 `/** what + why */` module headers added to ~163 server and client source files.
     Comments only. Barrels, single-constant files, pure type re-exports, and tests left
     exempt; `'use client'` kept first where present.

6. **Flatten single-file domain folders (R-223)**
   - 25 single-source `X/X.ts` domain subfolders collapsed to flat files: server
     `handlers/{auth,places,userPreferences}`, `middleware/{csrfGuard,errorHandler,
notFoundHandler,rateLimiter,requestLogger}`, `prompts/{bookingSteps,systemPrompt,
tripContext}`, `schemas/{auth,planCard,trips,userPreferences}`, `database/pool`; and
     client `lib/*`. Tests moved up alongside their source; relative imports fixed.

## Architectural decisions

1. **E-007 was misdiagnosed by the audit; fixed the root cause instead.** The audit claimed
   "prettier does not sort imports." It does, via `@trivago/prettier-plugin-sort-imports`. The
   real defect was that its `importOrder` had no group for the `app/`/`@/` path aliases, so
   aliased imports were lumped into `<THIRD_PARTY_MODULES>` and interleaved with real
   packages. Chosen: add `next`, `app/`, `@/` groups to the existing config. Rejected: adding
   `eslint-plugin-simple-import-sort` (two import sorters conflict; one must own ordering).

2. **E-012 not implemented (false positive).** The audit wanted `version.json` added to the
   `dist/` build-smoke assertion. But `version.json` is a deploy-time stamp written by
   `scripts/deploy.sh`, not a committed asset, and `app.ts readCommitSha()` already wraps the
   read in try/catch returning `'unknown'` on absence. Asserting it in the build guard would
   break every normal `pnpm build` (it only exists post-deploy). No change.

3. **Client `lib/` kept.** R-220 bans `lib/`, but `CLAUDE-FRONTEND.md` explicitly prescribes
   `lib/` for the client. Removing it would contradict the frontend convention file, so only
   the server `utils/` tree (which has no such exception) was torn down.

4. **Flattened every redundant single-source domain subfolder (25), kept structural trees.**
   All single-source `X/X.ts` domain folders were collapsed (phase 6 above). Deliberately kept
   as single-file folders: Next.js `app/` route segments (the folder structure IS the route,
   flattening breaks routing); the pool's `database/` tree (R-220 mandates the pool live in its
   own top-level tree); the top-level category trees `errors/`, `resilience/`, `types/`,
   `context/`, `providers/`, `data/`; and folder-per-component dirs (`AuthGuard/`, `GoogleIcon/`,
   `TripPDF/`), consistent with the stylesheet-bearing component folders. These are structural
   taxonomy, not the redundant `X/X.ts` nesting R-223 targets.

5. **No-action findings.** E-011 (a historical batched commit) and E-014 (Copilot autofix
   commit subjects) are already landed; E-013 is the import side of E-001.

## Testing

- `tsc --noEmit`: server clean; client 14 errors, all pre-existing (baseline on `main` was 17;
  none introduced, a few incidentally fixed). Client gates on `next build`, not bare tsc.
- `pnpm build`: server green (aliases + dist smoke), client `next build` green.
- Server suite: **1104 passed (76 files)**. Client suite: **250 passed (47 files)**. Stable.
- Every phase ran tsc + the relevant suite before its commit; all lefthook hooks (format,
  lint, commit-msg) passed on each commit.

## Reflection

What I understand now: the audit was a strong starting map but not ground truth. Two of its
findings (E-007 cause, E-012) were wrong on inspection, and catching them mattered: E-012
would have broken the build. Verifying each finding against the code before implementing,
rather than treating the audit as a checklist, is the load-bearing discipline here.

What I got wrong first: I initially added `eslint-plugin-simple-import-sort` for E-007 before
discovering prettier already sorts imports; the two conflicted (re-sorting on every format).
Reverted it and fixed the existing prettier config, which is the correct single-owner approach.
