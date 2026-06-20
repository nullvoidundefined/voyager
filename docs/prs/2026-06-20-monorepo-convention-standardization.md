# Monorepo convention standardization (Voyager to Doppelscript)

/ Branch: `refactor/convention-cleanup` (continuation) / Date: 2026-06-20 /

## Summary

Aligns Voyager's repository structure and naming with the canonical layout that
Doppelscript already follows, and codifies the decisions as five new global
architecture rules (R-236 through R-240). This continues the existing
convention-cleanup branch (7 prior commits, E-001..E-015) with the cross-repo
standardization phase: five further commits on top of `0a04efb`.

The goal was the user's: make the two repos "as similar as the application
requirements allow." Legitimate differences are preserved (Voyager is web-only;
Doppelscript is multi-surface). Arbitrary drift is removed.

## What changed

| Commit    | Change                                                                                                                                                                            | Rule         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `668f109` | `@voyager/shared-types` -> `@repo/types` (package dir, scope, 40 import sites, Dockerfiles, tooling paths)                                                                        | R-236        |
| `21f196f` | Web `lib/` torn down: business modules -> `services/`, transport -> `api/request.ts`, shared -> `constants.ts`; `context/`+`providers/` folded into `state/`                      | R-220, R-240 |
| `f648b4e` | Server tests consolidated into a single `src/__tests__/` mirror; `__integration__/` -> `__tests__/integration/`; `test-fixtures/` + nested `__fixtures__/` -> `src/__fixtures__/` | R-239        |
| `6b3d101` | Web tests consolidated into `src/__tests__/` mirror; `src/test/` setup relocated                                                                                                  | R-239        |
| `1b8fc15` | Remaining kebab names camelCased: `enrichment-sources/` -> `enrichmentSources/`, `tool-call-log.ts` -> `toolCallLog.ts`, `visa-matrix.ts` -> `visaMatrix.ts`                      | R-237, R-217 |

233 files changed (mostly renames plus import-specifier updates).

### New global rules (`~/.claude/CLAUDE.md`)

- **R-236** Canonical monorepo layout: `apps/server`, `apps/client/<surface>`, `packages/<name>`; shared packages use the `@repo/*` scope with canonical names.
- **R-237** Directory name case: camelCase for all multi-word dirs; Next.js URL route segments keep kebab (application-requirement exception).
- **R-238** Server `src/` taxonomy: fixed top-level vocabulary; `database/` not `db/`, `dependencyInjection/` not `di/`; generic catch-alls banned.
- **R-239** Test/fixture directories: single top-level `src/__tests__/` mirror, `__tests__/integration/`, `src/__fixtures__/`.
- **R-240** Client web `src/` taxonomy: `app/`, `components/`, `features/`, `services/`, `api/`, `clients/`, `state/`; no `lib/`.

## Architectural decisions

**Reference direction: Voyager conforms to Doppelscript.** Doppelscript already
implements the global rules; Voyager had drifted. Chosen over a "meet in the
middle" approach because it minimizes total churn and fixes the most violations.
Alternative (re-derive a fresh ideal for both) rejected as higher cost for no
gain over an already-conformant reference.

**Test imports use the `app/`/`@/` alias, not relative re-depthing.** Doppelscript's
canonical style is a top-level `__tests__/` mirror importing source via the alias
(588 alias imports vs 29 relative). The consolidation was performed by a
deterministic codemod that resolves each specifier against a pre-built file index
and rewrites only imports that would otherwise break (moving targets; relative
imports in moved files). Alternative (hand re-depth 29+ files) rejected as
error-prone.

**`camelCase everywhere` with a URL carve-out.** The user chose camelCase for all
multi-word directories. Next.js App Router URL route segments are exempt because
the folder name is the public URL; renaming would change live URLs. Encoded
explicitly in R-237.

**`data/` is allowed; only code catch-alls are banned.** Static reference data
(`data/destinations.ts`) is legitimate and matches Doppelscript. R-238/R-240 ban
`lib/`, `utils/`, `helpers/`, `common/`, `core/`, `misc/` but not `data/`.

## Testing

- `@repo/types` build: pass
- Server build (`tsc` + `tsc-alias`): pass
- Server unit tests: 74 files, 1063 tests pass
- Web build (`next build`): pass
- Web tests: 47 files, 250 tests pass
- Root `format:check`: clean; root `lint`: 0 errors (152 pre-existing warnings)
- Integration tests: imports verified via `tsc` (tsconfig includes all tests).
  Not executed locally; they load `.env` and hit a real database (per the
  2026-05-29 staging-wipe incident), so they are CI-only.

## Reflection

The codemod took three iterations to get right, and each failure taught the
real shape of the codebase: (1) resolution must run against a pre-built index,
not live disk, because files move mid-run; (2) the code uses explicit NodeNext
`.js` extensions, so `.js` must map to `.ts` on resolve and be re-emitted; (3)
source files import test fixtures (a pre-existing smell), so a "rewrite only
moving files" scope was too narrow. What I got wrong first was assuming tests
imported source relatively (they mostly use the alias) and assuming a single
pass over moving files would suffice. The cleanest signal throughout was the
test suite itself: collection failures pinpointed every missed path.

Time since base implementation: the prior convention-cleanup commits landed
2026-06-16; this standardization phase is 4 days later (2026-06-20).
