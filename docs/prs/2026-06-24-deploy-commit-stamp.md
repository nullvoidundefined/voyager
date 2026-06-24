# Report deployed commit from RAILWAY_GIT_COMMIT_SHA (#59)

**Date:** 2026-06-24
**Branch:** `fix/deploy-commit-stamp`
**Closes:** #59

## Summary

`/health/ready` reports the deployed commit so a deploy can be verified. That value came solely from `apps/server/src/data/version.json`, which only `scripts/deploy.sh` writes (it stamps `git rev-parse HEAD` before `railway up`). Any deploy path that bypasses the script left a stale stamp. This was hit during the 2026-06-24 production deploy: a raw `railway up` shipped the new code but `/health` kept reporting the previous commit until `deploy.sh` was re-run, which silently breaks deploy verification.

## What changed

- New `apps/server/src/config/deployedCommit.ts` exporting `readDeployedCommit(versionFilePath)`: prefers `process.env.RAILWAY_GIT_COMMIT_SHA` (injected by Railway on every git-sourced deploy, no build/pre-deploy step needed), falls back to the `version.json` stamp for manual `railway up` via `deploy.sh`, then `'unknown'`.
- `app.ts` `readCommitSha()` now delegates to it (removing the inline file read).
- Unit tests cover env-var precedence, file fallback, missing file, missing `commit` field, and blank env var.

## Architectural decisions

- **Prefer the platform env var over a pre-deploy stamp (chosen) vs. only fixing `deploy.sh` (alternative).** Keying off `RAILWAY_GIT_COMMIT_SHA` makes the reported commit correct without depending on a human running the right script, so the git-sourced web service and any future git-triggered deploy report accurately by default. `version.json` remains as the fallback for the manual upload path, so nothing regresses.
- **Inject the version-file path as a parameter (chosen) vs. resolving it inside the function.** Keeps the resolver pure and unit-testable against a temp file; `app.ts` owns the path resolution.

## Testing

- `deployedCommit.test.ts`: 5 cases, all green. `tsc --noEmit` clean.
- Note: this does not fully cover a raw `railway up` with no git env var set (still falls back to whatever `version.json` holds); the durable fix for that path is the documented `scripts/deploy.sh`. The env-var preference removes the dependency for every git-sourced deploy.

## Reflection

The bug surfaced from operator error (I deployed with raw `railway up` instead of `deploy.sh`), but the real fault is that the commit stamp depended on a side effect of one script. Sourcing it from the platform-provided env var makes the common path self-correcting.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
