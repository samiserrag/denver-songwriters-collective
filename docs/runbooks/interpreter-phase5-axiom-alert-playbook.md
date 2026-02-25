# Runbook: Interpreter Phase 5 Axiom Alert Playbook

**Status:** ACTIVE  
**Owner:** Engineering  
**Last updated:** 2026-02-25  
**Scope:** `/api/events/interpret` post-Phase-5 venue-resolution hardening

---

## Purpose

Provide lightweight, high-signal production monitoring for:
- interpreter upstream/runtime failures,
- venue-resolution gating regressions,
- online clarification behavior regressions,
- rate-limit fallback incidents.

Dataset assumed: `vercel-runtime`.

---

## Trigger Windows

Use two windows:
- **Fast window:** `15m` for immediate incidents.
- **Trend window:** `24h` for drift and behavioral changes.

---

## Alert Conditions

### A1) Interpreter Errors (P0)

**Condition:** any interpreter error log in last `15m`.

```bash
axiom query "['vercel-runtime']
| where _time > ago(15m)
| where message has '[events/interpret]'
| where message has 'upstream error'
   or message has 'non-json model output'
   or message has 'parse/call error'
   or message has 'timeout'
| summarize errors=count()" --format table
```

**Threshold:** `errors > 0`  
**Action:** open incident, verify OpenAI/API health, rollback if sustained.

---

### A2) Rate-Limit Fallback Usage (P1)

**Condition:** RPC rate-limit path fails and memory fallback is used.

```bash
axiom query "['vercel-runtime']
| where _time > ago(15m)
| where message has '[events/interpret] rate-limit rpc'
| summarize fallbacks=count() by message" --format table
```

**Threshold:** `fallbacks > 0`  
**Action:** check DB RPC availability and Supabase latency/errors.

---

### A3) H6 Regression Sentinel (P1)

**Condition:** `edit_series` clarifications blocked by `venue_id` appear unexpectedly.

```bash
axiom query "['vercel-runtime']
| where _time > ago(24h)
| where message == '[events/interpret] response'
| where mode == 'edit_series' and nextAction == 'ask_clarification'
| mv-expand bf = blockingFields
| where tostring(bf) == 'venue_id'
| summarize count=count()" --format table
```

**Threshold:** investigate if:
- `count > 0` immediately after deploy validation, or
- day-over-day increase is materially above baseline.

**Action:** sample logs and validate message intent; if non-location edits are affected, hotfix gate logic.

---

### A4) H7 Regression Sentinel (P1)

**Condition:** online-transition clarifications incorrectly include `venue_id`.

```bash
axiom query "['vercel-runtime']
| where _time > ago(24h)
| where message == '[events/interpret] response'
| where mode == 'edit_series' and nextAction == 'ask_clarification'
| mv-expand bf = blockingFields
| summarize fields=make_set(tostring(bf), 10) by _time
| where set_has_element(fields, 'online_url') and set_has_element(fields, 'venue_id')
| summarize count=count()" --format table
```

**Threshold:** `count > 0`  
**Action:** verify unresolved path logic (`needsOnlineUrl`) and patch immediately.

---

## Baseline Health Queries

### B1) Response distribution

```bash
axiom query "['vercel-runtime']
| where _time > ago(24h)
| where message == '[events/interpret] response'
| summarize count=count() by mode, nextAction
| sort by count desc" --format table
```

### B2) Venue resolution outcome distribution

```bash
axiom query "['vercel-runtime']
| where _time > ago(24h)
| where message == '[events/interpret] response'
| summarize count=count() by mode, status=tostring(venueResolution.status)
| sort by count desc" --format table
```

### B3) Clarification blocking field mix

```bash
axiom query "['vercel-runtime']
| where _time > ago(24h)
| where message == '[events/interpret] response' and nextAction == 'ask_clarification'
| mv-expand bf = blockingFields
| summarize count=count() by mode, blocking_field=tostring(bf)
| sort by count desc" --format table
```

---

## Incident Checklist

1. Confirm deployment SHA and first-seen timestamp.
2. Run A1/A2 first (hard failures).
3. Run A3/A4 to validate behavior contracts.
4. Capture 3-5 representative log rows with `mode`, `nextAction`, `blockingFields`, and `venueResolution`.
5. Decide:
   - hotfix now (behavior regression), or
   - monitor + backlog (non-critical drift).

---

## Related Docs

- `docs/SMOKE-PROD.md`
- `docs/investigation/interpreter-image-extraction-stopgate.md`
- `docs/investigation/interpreter-venue-abbreviation-phase6-stopgate.md`
