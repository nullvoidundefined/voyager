# De-flake the E2E_BYPASS_RATE_LIMITS rate-limiter test

**Date:** 2026-06-24
**Branch:** `fix/flaky-ratelimiter-bypass-test`

## Summary

`rateLimiter > E2E_BYPASS_RATE_LIMITS > skips the auth limiter entirely when set to "1"` fired 50 sequential supertest requests in a loop. Under full-suite CPU contention those round-trips occasionally exceeded Vitest's default 5000ms test timeout, so the test failed intermittently. After PR #57 added `test:coverage` to the pre-push hook (P2-08), this flake began intermittently blocking pushes.

It is not a hang or a logic bug: the test passes 10/10 in isolation and the work it does is legitimate, just slow under load.

## What changed

- Reduced the loop from 50 to 20 requests. The auth limit is 10/15-min, so 20 with zero 429s still proves the bypass skips the limiter; 50 was overkill.
- Added an explicit 15s timeout to the test so a loaded CI/pre-push run has headroom and cannot trip the default 5s ceiling.

## Architectural decisions

- **Reduce iterations and raise the timeout (chosen) vs. only raise the timeout (alternative).** Raising the timeout alone fixes the flake but leaves 50 needless round-trips; trimming to 20 keeps the assertion meaningful (2x the limit) and faster. Both together remove the flake decisively.
- **Did not quarantine/skip the test.** It is a real, valuable assertion (the E2E bypass must skip the limiter); skipping it would violate the project's no-suppression rule. The fix makes it reliable instead.

## Testing

- `rateLimiter.test.ts`: 10/10 green in isolation and under the full suite.

## Reflection

P2-08 (run tests on pre-push) was the right call, but it exposed a latent flake that had been invisible while tests only ran in CI. The lesson: a flake is a blocked push waiting to happen once the test runs on a gating hook.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
