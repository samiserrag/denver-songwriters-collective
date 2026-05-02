# Event Audit & Admin Alerts — Decision Memo

**Date:** 2026-05-02
**Status:** Decision memo (docs-only). No runtime, schema, config, or test change.
**Author:** Claude (Lane 5)
**Companion to:** [`event-audit-and-admin-alerts.md`](./event-audit-and-admin-alerts.md) (the upstream investigation; Sami still owns the §7 blocking calls).
**Required reading:** `AGENTS.md`, [`docs/GOVERNANCE.md`](../GOVERNANCE.md), [`docs/agents/coordinator.md`](../agents/coordinator.md), [`docs/strategy/OPERATING_THESIS.md`](../strategy/OPERATING_THESIS.md), [`docs/strategy/INGESTION_AND_FAIR_COMPETITION.md`](../strategy/INGESTION_AND_FAIR_COMPETITION.md), [`docs/strategy/SOURCE_REGISTRY.md`](../strategy/SOURCE_REGISTRY.md), [`docs/strategy/AGENTIC_EVENT_MAINTENANCE.md`](../strategy/AGENTIC_EVENT_MAINTENANCE.md), [`.claude/rules/05-ingestion-and-agent-readability.md`](../../.claude/rules/05-ingestion-and-agent-readability.md), Trust Layer Invariant in [`.claude/rules/00-governance-and-safety.md`](../../.claude/rules/00-governance-and-safety.md).

---

## 0. Why this memo exists

The investigation doc landed (PR #193, merged `456db8d5`) and listed 10 open questions in §7, of which 5 are blocking. Since then Lane 6 strategy docs have shipped (`OPERATING_THESIS.md`, `INGESTION_AND_FAIR_COMPETITION.md`, `SOURCE_REGISTRY.md`, `AGENTIC_EVENT_MAINTENANCE.md`) and the Trust Layer Invariant is now canonical in `00-governance-and-safety.md`. Several of the §7 calls — especially the public-surface and admin-UI shape — now have to fit those constraints, and a few defaults that read as judgement calls in the investigation are actually pre-determined by the trust-never-pay-to-play boundary.

This memo:

1. Restates the §7 blocking questions in one place.
2. Gives a **single recommended default** for each of the five decision categories Sami asked Lane 5 to scope.
3. Notes risk + rollback per recommendation.
4. Documents Lane 6 trust-layer constraints that bound the public-surface decisions.
5. Confirms implementation remains blocked until Sami answers — the memo does not authorize anything.

**No runtime behavior changes. No schema, no migration, no email behavior, no admin UI, no public surface.**

---

## 1. §7 blocking questions, restated

From [`event-audit-and-admin-alerts.md` §7](./event-audit-and-admin-alerts.md). The investigation flagged questions 1, 2, 4, 6, and 9 as blocking implementation. The other §7 items remain open but are not gating PR A's start.

| §7 # | Question | Blocking? |
|---|---|---|
| 1 | Single PR or split into A / B / C? | ✅ blocking |
| 2 | Email frequency — immediate + digest, or digest-only? | ✅ blocking |
| 3 | Daily digest delivery time | non-blocking (default 8am MT) |
| 4 | Retention policy — keep forever, roll up older than 90d, drop after 1y for low-risk only? | ✅ blocking |
| 5 | Public surfaces (PR C) — opt-in, default-on, never? | non-blocking for PR A start, but **answer needed before PR C** |
| 6 | `ON DELETE` on `event_audit_log.event_id` — cascade, or set null with retention? | ✅ blocking |
| 7 | Service-role coverage sweep | non-blocking (follow-up) |
| 8 | AI-origin double-logging — table + Axiom, or Axiom-only? | non-blocking (follow-up) |
| 9 | Feature-flag default — flag-off + manual toggle, or flag-on at deploy? | ✅ blocking |
| 10 | `non_host_csc_edit` signal weight | non-blocking (tunable) |

---

## 2. Lane 5 recommended defaults

The task asks for concrete defaults across five decision categories. Each maps to one or more §7 questions; the mapping is in the heading. Each recommendation lists **why**, **risk**, and **rollback**.

### 2.1 PR shape / split (§7 #1)

**Recommendation: split into A → B → C, sequenced.**

- **PR A** ships first: `event_audit_log` migration + `web/src/lib/audit/eventAudit.ts` helper + log-on-write hook in event POST/PATCH/DELETE/overrides routes. Behind `EVENT_AUDIT_LOG_ENABLED` flag. No email, no admin UI, no public surface.
- **PR B** opens **after PR A has run silently in prod for ≥7 days** with row-shape verified against actual write volume. Suspicion scorer (`web/src/lib/events/auditSuspicion.ts`) + Vercel cron route + email plumbing through existing `sendAdminEventAlert`. Behind `EVENT_AUDIT_ALERTS_ENABLED` flag.
- **PR C** ships only after Sami signs off on a separate stop-gate per §2.4. Includes admin browser UI + the host-private edit-history sidebar + the public transparency line. RSS/JSON/MCP/agent-readable feeds defer further (§2.4 note).

**Why:** lower per-PR review surface, and the table contents from PR A directly inform the scorer thresholds in PR B. Any approach that bundles A+B forces threshold guesses without data.

**Risk:** PR A landing without alerts means a 7-day window where a bad actor could mutate without any alert beyond what already exists (the published-event safety gate). Mitigated by the existing gate already covering AI auto-apply on published events; manual mutations during this window land in the audit row but do not page anyone — same posture as today, but with forensics added.

**Rollback:** per investigation §4.4. Setting either flag to `false` makes the helper a no-op without any user-facing change.

### 2.2 Audit row retention (§7 #4)

**Recommendation: retain by `actor_role`, not by host payment status.**

| `actor_role` | Default retention | Why |
|---|---|---|
| `host`, `cohost`, `admin` | Indefinite | Long-term provenance for legitimate edits. Volume is small (§4.3 of investigation: ~75 MB/year total). |
| `service` | 365 days | Service-role writes need forensics for the kind of incident `unattributed_service_write` would catch. |
| `import` (when ingestion path lands) | 365 days | Bulk operations need a long forensic window per [`INGESTION_AND_FAIR_COMPETITION.md §10`](../strategy/INGESTION_AND_FAIR_COMPETITION.md). |
| `anon`, `unknown` | 90 days | Bot/spam noise; do not let it bloat the table. |

Cleanup runs as a Supabase scheduled function in PR B, not PR A. Until PR B lands, no rows are deleted automatically. `cleanup_old_logs()` in `app_logs` is a precedent — same mechanism, different filter.

**Why:** the trust-layer invariant ([`OPERATING_THESIS.md §6`](../strategy/OPERATING_THESIS.md)) says trust surfaces cannot be differentiated by payment tier. Retention is a trust surface (it underwrites accountability). Retention rules therefore key off **role**, not subscription tier. A future paid host gets the same indefinite retention as an unpaid host.

**Risk:** indefinite for hosts means storage growth scales with host count + edit velocity. At the modeled rate (75 MB/year for the whole table), this is negligible for a decade. If host count grows 10×, revisit.

**Rollback:** retention rules live in a single scheduled function. Tightening windows is a docs-only stop-gate plus one config change; no migration.

### 2.3 Email alert frequency (§7 #2)

**Recommendation: tiered — immediate for high-confidence signals, daily digest for everything else, weekly admin summary for trends.**

- **Immediate** (≤1 per actor/event/hour throttle): score ≥60. The bar is set at the threshold from investigation §3 PR B. Examples that trip it: `unattributed_service_write` (always), `non_host_csc_edit` co-occurring with `new_account_published_edit`, `field_zeroing` co-occurring with `actor_velocity_burst`.
- **Daily digest at 8am America/Denver** (§7 #3 default): everything below the immediate threshold, rolled up by `(actor, event)` so a host polishing a draft 10× appears as one digest line.
- **Weekly admin summary on Mondays at 9am MT**: aggregate counts by signal, top 10 actors by edit volume, anomaly delta vs prior week. Pure trend monitor, no per-event noise.

**Why:** mirrors what's already battle-tested in `sendAdminEventAlert` (it has its own dedupe map at `web/src/lib/email/adminEventAlerts.ts:83`). Tiering keeps admin inbox usable. Per [`OPERATING_THESIS.md §6`](../strategy/OPERATING_THESIS.md) and [`docs/GOVERNANCE.md`](../GOVERNANCE.md) email philosophy, alert volume must serve community value, not administrator anxiety.

**Risk:** false positives on the immediate path are user-visible (admin gets paged for nothing). Mitigated by the score threshold living in a constants file with a one-line bump, and by the throttle.

**Rollback:** `EVENT_AUDIT_ALERTS_ENABLED=false`. The cron still runs but returns 204; no email fires.

### 2.4 Public growth surfaces — default-on vs opt-in (§7 #5)

**Recommendation: split the surfaces into three buckets governed by the Trust Layer Invariant.** Some surfaces are the trust layer and **cannot** be opt-in. Some are personal-attribution and **must** be opt-in. Some are ingestion-policy-bound and defer until a separate Lane 6 stop-gate.

#### Bucket 1 — Trust-layer transparency (default-on, public, applies to every event)

Per [`.claude/rules/00-governance-and-safety.md` Trust Layer Invariant](../../.claude/rules/00-governance-and-safety.md) and [`OPERATING_THESIS.md §6`](../strategy/OPERATING_THESIS.md), source attribution and last-checked timestamps are public-good surfaces — they cannot be gated, degraded, deprioritized, or differentiated by payment tier.

- **"Last updated MMM D, YYYY · Source: host"** — generic role-only attribution, no personal name. Same for every published event regardless of host plan. Renders only after PR A has been live ≥7 days and the underlying row contents are validated.
- This is the **only** bucket-1 surface in PR C. It is explicitly part of the trust layer.

#### Bucket 2 — Personal-attribution surfaces (opt-in per host, default off)

Naming a specific human is a privacy surface, not a trust surface. The trust-layer invariant does not require it.

- **"Last updated by *<host display name>*"** — name shown to the public. Host opts in via a profile setting. Default off.
- **Public RSS / JSON feed of events the host owns** — when ingestion infra lands, this becomes a Lane 6 surface and must follow [`SOURCE_REGISTRY.md`](../strategy/SOURCE_REGISTRY.md) source-policy rules. Defers further; not in PR C.

#### Bucket 3 — Host-private surfaces (always-on for the host themselves, never public)

- **Edit-history sidebar on the host's own edit form.** Visible only to the row's hosts/cohosts. Reduces "did I save?" friction and gives hosts the same accountability view admins get.
- **Admin "this week's edit volume" dashboard tile.** Admin-only. Operational.

#### Bucket 4 — Defers to separate Lane 6 stop-gate

Per [`.claude/rules/05-ingestion-and-agent-readability.md`](../../.claude/rules/05-ingestion-and-agent-readability.md), any new public agent-readable surface (RSS / JSON / schema.org/Event JSON-LD / `/llms.txt` / MCP / public correction-flow API) needs source registration, classification, robots/terms summary, and stop-gate review **before** it ships. None of these belong in PR C.

**Why:** the Lane 6 strategy docs landed after the investigation was written. The investigation §6 listed these growth surfaces flatly; this memo separates them by trust posture. The default-on transparency line is required by the Trust Layer Invariant. Personal attribution is opt-in to respect host privacy. Public agent-readable feeds are out of scope for PR C entirely.

**Risk:** a default-on transparency line on an event with a contested edit could expose a host to drive-by criticism. Mitigated by showing only role + date, never personal identity, and by routing dispute through the §2.5 admin UI not through public commentary.

**Rollback:** the bucket-1 surface is gated by `EVENT_AUDIT_PUBLIC_TRANSPARENCY_ENABLED`. Setting false renders nothing. No data changes.

### 2.5 Admin UI minimum viable scope (extends §7; not in original list)

**Recommendation: strict read-only MVP scoped to the alert-response workflow only.**

The MVP exists to answer one question: *"I got an alert / a host complained — what changed, who changed it, when?"* Anything beyond that defers.

**In MVP (PR C):**

- Route: `/dashboard/admin/event-audit` (admin-only via existing `checkAdminRole`).
- Paginated table, default 50/page, sortable by `created_at desc`.
- Columns: timestamp, event title (link to detail), actor display name + role, source, action, primary changed fields summary, score (from PR B if active).
- Filters via URL params: `event_id=`, `actor_id=`, `source=`, `from=`, `to=`. Email deep links use these.
- Per-row expansion shows full `changed_fields` JSON pretty-printed.
- "Open event" + "Open actor profile" links per row.

**Out of MVP:**

- Bulk actions (select N, undo).
- Export (CSV, JSON).
- Charts / graphs / dashboards.
- Edit / delete of audit rows themselves.
- Admin write to events from this surface (admins still go to the event edit form).
- Public correction-flow review (separate Lane 6 surface per [`AGENTIC_EVENT_MAINTENANCE.md §6`](../strategy/AGENTIC_EVENT_MAINTENANCE.md)).
- Cross-event "this actor edited 50 events" graph view (already explicitly out per investigation §8).

**Why:** the alert email is the operational entry point. The MVP needs to satisfy the link target in the email and nothing else. Scope creep into bulk-actions or charts blocks PR C indefinitely.

**Risk:** an MVP that's too thin gets ignored, and admins fall back to direct DB queries (which is the status quo). Mitigated by the email-deep-link pattern: the MVP is the path of least resistance from the alert.

**Rollback:** admin UI sits behind `EVENT_AUDIT_ADMIN_UI_ENABLED`. Setting false hides the route + the navigation entry; no other surface depends on it.

---

## 3. Lane 6 trust-layer constraints applied to this memo

These are the policy boundaries the recommendations above respect. They are not new in this memo; they are the operating frame and they bind anything Lane 5 ships.

| Constraint (source) | How this memo respects it |
|---|---|
| **Trust layer is never pay-to-play** ([`00-governance-and-safety.md`](../../.claude/rules/00-governance-and-safety.md), [`OPERATING_THESIS.md §6`](../strategy/OPERATING_THESIS.md)) | §2.2 retention rules key off `actor_role` only. §2.4 transparency line default-on for all events regardless of host plan. No surface in this memo varies by payment tier. |
| **Source attribution required on every published event** ([`INGESTION_AND_FAIR_COMPETITION.md §7`](../strategy/INGESTION_AND_FAIR_COMPETITION.md)) | Bucket-1 transparency surface IS source attribution (role + date). It is default-on per the rule. It does not yet include `source_url` because PR A does not yet ingest external sources — the field becomes meaningful when [`SOURCE_REGISTRY.md`](../strategy/SOURCE_REGISTRY.md) data model lands. |
| **Correction flow + opt-out paths must exist for any public-good surface** ([`OPERATING_THESIS.md §6`](../strategy/OPERATING_THESIS.md), [`INGESTION_AND_FAIR_COMPETITION.md §8`](../strategy/INGESTION_AND_FAIR_COMPETITION.md)) | Hosts can dispute their own audit row via the existing event edit + admin contact paths (no new flow required for PR A/B). PR C admin UI provides the operational surface for admin-side correction. Public correction-flow API is explicitly out of scope until a Lane 6 stop-gate authorizes it. |
| **Crawler / write-API / agent-readable surface stop-gate** ([`.claude/rules/05-ingestion-and-agent-readability.md`](../../.claude/rules/05-ingestion-and-agent-readability.md)) | Bucket 2 RSS/JSON and bucket 4 MCP / `llms.txt` / agent-readable feeds are explicitly deferred to a separate Lane 6 stop-gate per §2.4. None ship inside Lane 5 PRs. |
| **Active confirmation contract is unchanged** ([`05-ingestion-and-agent-readability.md` rule 8](../../.claude/rules/05-ingestion-and-agent-readability.md), [`SOURCE_REGISTRY.md §7`](../strategy/SOURCE_REGISTRY.md)) | This memo does not propose changing badge derivation, label text, or DB-truth source for verification. The audit log is a parallel record and a future input to the §6 derivation function in `SOURCE_REGISTRY.md`, not a substitute for `last_verified_at`. |
| **Email systems philosophy** ([`00-governance-and-safety.md` Email Systems Philosophy](../../.claude/rules/00-governance-and-safety.md)) | §2.3 alert tiering serves community-protection value, not engagement. No retention dark patterns. Throttling + opt-out (admin can disable alerts) preserves consent. |
| **Concierge contract preserved** ([`AGENTIC_EVENT_MAINTENANCE.md §3`](../strategy/AGENTIC_EVENT_MAINTENANCE.md), `EVENTS-NL-01`) | Audit log captures concierge edits via the same PATCH path; no change to the draft-until-proven defaults; no new agent-write path proposed. |
| **Operating-thesis tradeoffs** ([`OPERATING_THESIS.md §8`](../strategy/OPERATING_THESIS.md)) | Recommendations bias toward smaller-team operability (tiered alerts), evidence-based trust (per-row provenance), and slower rollout (3 PRs over weeks, not days). |

---

## 4. Risk + rollback (consolidated)

| Recommendation | Top risk | Rollback path |
|---|---|---|
| §2.1 PR split | A 7-day quiet window between PR A and PR B; bad actors land mutations without alerts | Same posture as today (the published-event safety gate still applies); accelerate PR B if signal volume warrants; flag-off PR A entirely if needed |
| §2.2 Role-based retention | Host volume grows faster than modeled; storage grows | Tighten retention windows in the scheduled function; one-config change, no migration |
| §2.3 Tiered alerts | False-positive immediate emails; admin alert fatigue | Bump score threshold in constants file; flag-off `EVENT_AUDIT_ALERTS_ENABLED` |
| §2.4 Trust-layer surfaces | Drive-by criticism via the public transparency line | Show role + date only, never name; route disputes through admin UI; flag-off `EVENT_AUDIT_PUBLIC_TRANSPARENCY_ENABLED` |
| §2.5 Admin MVP | MVP too thin → admins fall back to DB queries | Email deep-links keep the MVP on the path of least resistance; flag-off `EVENT_AUDIT_ADMIN_UI_ENABLED` to hide entirely |

Each rollback is a docs-confirmed config change. No migration is reversible automatically — `event_audit_log` rows persist after a flag-off (per investigation §4.4 + `30-supabase-migrations-and-deploy.md` rollback-only file rule), but the table becomes inert. Removing the table requires a new migration in `supabase/migrations/_archived/`.

---

## 5. Why implementation remains blocked

This memo is **input** to Sami's decision, not authorization to begin code work. The following are explicitly required before any code/migration/route/UI change ships:

1. **Sami selects** one option per §2 (or modifies any of the recommended defaults). Specifically: PR-shape acceptance (§2.1) and feature-flag default (§7 #9) determine whether PR A starts at all.
2. **§7 #6 (`ON DELETE` behavior)** has no Lane 5 recommendation in this memo because the call hinges on retention preference (§2.2) and host-trust posture. If retention is indefinite for hosts, `ON DELETE CASCADE` is fine; if Sami wants permanent forensics independent of event existence, `ON DELETE SET NULL` with a `deleted_at` shadow becomes necessary. Sami picks.
3. **§7 #9 (feature-flag default)** also unrecommended here. Defaults: flag-off-then-toggle is safer; flag-on-at-deploy mirrors prior `last_verified_at` rollout. The investigation lays out both. Sami picks.
4. PR A's investigation doc (`event-audit-and-admin-alerts.md` §3 PR A) already spells out the schema, RLS, and route hooks. It is the canonical scope. This memo does not modify it.
5. `.claude/rules/05-ingestion-and-agent-readability.md` requires the PR-checklist add-ons for any future Lane 6-adjacent surface (bucket 2 / 4 in §2.4). Lane 5 PRs A and B are not in that scope; PR C bucket 1 cites the trust-layer invariant only.

**No code, schema, route, UI, email, or public-surface work begins until Sami signs off.**

---

## 6. Out of scope for this memo

For clarity, this memo does not:

- Modify the investigation doc.
- Propose any new `event_audit_log` schema fields beyond what the investigation already lists.
- Authorize PR A, B, or C to start.
- Decide §7 #6 (`ON DELETE`) or §7 #9 (flag default) — both require Sami input not derivable from policy.
- Touch any file under `web/`, `supabase/migrations/`, `tools/symphony/`, or any prompt/contract file.
- Propose any new ingestion source, crawler, write API, or agent-readable surface (bucket 4 in §2.4).

---

## 7. Decision-ready summary

| § | Decision | Recommended default |
|---|---|---|
| 2.1 | PR shape | A → B → C, sequenced; flagged; ≥7 days between A and B |
| 2.2 | Audit row retention | By `actor_role`: indefinite (host/cohost/admin), 365d (service/import), 90d (anon/unknown) |
| 2.3 | Email alert frequency | Immediate (score ≥60, throttled) + daily digest (8am MT) + weekly admin summary (Mon 9am MT) |
| 2.4 | Public growth surfaces | Bucket-1 transparency line default-on; bucket-2 personal attribution opt-in; bucket-3 host-private always-on; bucket-4 ingestion-bound deferred to Lane 6 |
| 2.5 | Admin UI MVP scope | Read-only paginated table with email-deep-link filters; no bulk/export/charts/edit |

§7 #6 and #9 remain Sami-call-only.

---

**End — Decision Memo v1. No runtime change. Implementation gated on Sami approval per [`docs/GOVERNANCE.md`](../GOVERNANCE.md) stop-gate workflow.**
