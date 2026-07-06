# P1: High Priority

Fix in the first work session. These are trust-breakers, layout inversions, or missing signals that undermine the portfolio impression within 2 minutes of use.

---

## Sign Anthropic DPA

Every registered user's messages are sent to Anthropic. Without a signed DPA, no GDPR data subject deletion request can be honored downstream.

**Why P1:** Self-service via Anthropic Console, 10 minutes. Removes a compliance gap.

**Scope:** Anthropic Console > sign DPA.

**Roles:** Legal

---

## Verify Google Cloud Places API Billing Cap

`docs/BILLING.md` shows the GCP billing cap as "Blocked" since 2026-04-07. 7+ weeks stale.

**Why P1:** No cap means any photo-proxy or text-search runaway hits Google's pay-as-you-go tier with no ceiling.

**Scope:** Log into GCP Billing, set the $50/month budget cutoff if the audit blocker has cleared. Update BILLING.md.

**Roles:** Financial

---

## Replace Font-Size Pixel Literals with Design Tokens

140+ raw `font-size` pixel literals scattered across SCSS modules bypass the existing `--text-*` scale tokens in `globals.scss`.

**Why P1:** The token system was built for this but components bypass it. Any new component written without checking will diverge further. A design-savvy reviewer will notice the inconsistency.

**Scope:** Replace `14px`, `13px`, `12px`, `11px` occurrences with `var(--text-sm)`, `var(--text-xs)`, etc. from the existing scale.

**Roles:** Design

---

## Fix SEC-02: Rotate Mapbox Public Token Committed in Git History

Commit `f36d7d6` added a live Mapbox public token (`pk.*`) to `web-client/.env.example`. Cleared in `f0dee63` but still retrievable via `git show f36d7d6:web-client/.env.example`. The `secret-scan.sh` hook fired twice during the security audit on this history.

**Why P1:** Token in public git history is permanently exposed. Even read-only scope allows quota exhaustion billed to the token owner. Write scopes (Tilesets, Styles, Datasets) would let an attacker modify map assets.

**Scope:** Rotate token on Mapbox dashboard. Generate a new token scoped to Maps JS API read-only with HTTP origin restriction to production URL only. Update the Railway env var. The old history token becomes inert after rotation.

**Source:** 2026-05-28 security audit (Opus)

