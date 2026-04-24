# Decisions log

> Non-obvious calls, with date + reason. Append-only. Future "why is it like this?" questions get answered here, not in Slack archaeology.

---

## 2026-04-24 — `ENFORCE_PRO` stays off (Pro gating bypassed in production)

**Decision**: Leave the `ENFORCE_PRO` env var unset (or `false`) in Lovable Cloud. All Pro-tier features remain freely accessible to all users.

**Reason**: Pre-PMF stage. Per `00_CURRENT_REALITY.md` traffic is ~7 scans/24h with 29% completion. At this scale, ₹399/month revenue is rounding error compared to the conversion lift from a fully open product. Growth signal > monetization signal until the funnel proves itself.

**Costs accepted**:
- No revenue from existing users.
- Pro CTAs in the UI act as soft signals only (telemetry on intent, no actual paywall).

**Reversal trigger**: when *either* (a) DAU sustainably > 100 *or* (b) the operator chooses to test pricing. Reversal is one env-var flip; no code change required. Run a Razorpay smoke test first (BL-001 acceptance criteria).

**Owner**: founder.
**Related**: BL-001 (status updated to `wontfix-for-now`), Hazard D in CLAUDE.md, INV-X01 in `INVARIANTS.md`.

---

## How to add an entry

```
## YYYY-MM-DD — short title

**Decision**: what we chose.
**Reason**: why this over the alternatives.
**Costs accepted**: what we are knowingly giving up.
**Reversal trigger**: what would make us revisit.
**Owner**: name.
**Related**: BL-###, invariant IDs, file paths.
```

---

## Assessments RLS — re-audit 2026-04-24

External audit flagged USING (true) on assessments (migration
20260304053357). Investigation confirmed this was already replaced by
the scans-join policy in migration 20260304054450 ~12h later. No
action taken. Reconsider adding a direct user_id column if any
frontend starts querying assessments directly.
