# Event Audit Log + Admin Alerts — Investigation

**Date:** 2026-05-02
**Status:** Investigation only (Step A + B per `docs/GOVERNANCE.md`). No code, schema, or runtime changes proposed in this PR.
**Author:** Claude (web)
**Reading order:** `AGENTS.md` → `docs/GOVERNANCE.md` → `docs/CONTRACTS.md` → `docs/PRODUCT_NORTH_STAR.md` → this file.

---

## 1. Problem statement

Hosts, admins, AI flows, and the occasional unauthenticated import path can all mutate `events.*` rows. Today there is no canonical "who changed what, when, from where" record for manual edits, no admin alerting on suspicious mutations, and no host-visible edit history. Three concrete failure modes are reachable today:

1. **Drive-by corruption.** A bot or low-effort spammer signs up and edits a CSC-branded or admin-verified event (title, venue, date) — the change lands silently and only surfaces when an attendee shows up at the wrong place.
2. **Subtle bot drift.** Programmatic edits at scale (an AI client looping the interpret + apply path, or a script hitting `/api/my-events/[id]`) corrupt the catalog one field at a time. The published-event safety gate from PR #182 / #139 catches AI-origin auto-applies but does **not** catch a malicious actor PATCHing the route directly with no `ai_write_source` header.
3. **Lost host trust.** When an event detail changes the original host has no per-field history to point to ("did I really change the venue?"), so legitimate edits get reported as suspect.

The user's framing is: **defend against bad info while staying useful for fair public use and for site growth.** This investigation scopes a system that does both — a trustworthy audit log + a throttled admin alert path + an opt-in growth surface that turns the same data into trust signals on public pages.

---

## 2. Current state — evidence

### 2.1 What already exists

| Surface | Path | What it does | Reuse plan |
|---|---|---|---|
| Audit helpers (other domains) | [`web/src/lib/audit/moderationAudit.ts`](../../web/src/lib/audit/moderationAudit.ts), [`opsAudit.ts`](../../web/src/lib/audit/opsAudit.ts), [`venueAudit.ts`](../../web/src/lib/audit/venueAudit.ts) | Service-role inserts into `app_logs` with `source: "<domain>_audit"` | **Pattern** copied for events; **table** NOT (see §2.3) |
| Admin alert email | [`web/src/lib/email/adminEventAlerts.ts:117`](../../web/src/lib/email/adminEventAlerts.ts) — `sendAdminEventAlert(params)` | Already wired with admin recipient resolution + a `__resetAdminEventAlertDedupeForTests` helper at line 83 | Reuse for the throttled suspicion-alert path (PR 2) |
| Host notifications | `web/src/lib/notifications/{eventCancelled,eventRestored,eventUpdated,occurrenceCancelled}.ts` | Host-facing only, not admin-facing | Out of scope — these stay as-is |
| Edit-turn telemetry | [`web/src/lib/events/editTurnTelemetry.ts`](../../web/src/lib/events/editTurnTelemetry.ts) (`buildEditTurnTelemetryEvent`, `emitEditTurnTelemetry`, `hashPriorState`) | Emits `[edit-turn-telemetry]` to Axiom from AI-origin PATCH path; includes `priorStateHash`, `proposedChangedFields`, `riskTier`, `enforcementMode` | Mirror to the new audit table for AI-origin edits so analytics + the human audit row stay in sync |
| Patch field registry | [`web/src/lib/events/patchFieldRegistry.ts`](../../web/src/lib/events/patchFieldRegistry.ts) — `RISK_TIERS`, `ENFORCEMENT_MODES` | Single source of truth for `risk_tier: "low" / "medium" / "high"` and `enforcement_mode: "enforced" / "shadow"` per field | Reuse to weight suspicion scoring (PR 2) |
| Diff utility | [`web/src/lib/events/computePatchDiff.ts`](../../web/src/lib/events/computePatchDiff.ts) | Registry-aware structural diff already used by `evaluatePublishedAiSafetyGate` | Reuse to populate `changed_fields` JSON in audit rows |
| Safety gate | [`web/src/app/api/my-events/[id]/route.ts:53`](../../web/src/app/api/my-events/[id]/route.ts) — `evaluatePublishedAiSafetyGate` | Server-side 409 + `requires_confirmation` for AI auto-apply on published events | Out of scope — preserved unchanged |
| Lifecycle columns on `events` | `supabase/migrations/20251228000001_event_lifecycle_audit.sql` adds `cancelled_at`, `cancel_reason`, `published_at`, `last_major_update_at` | Major-update timestamp, not per-field history | Read by the suspicion scorer; not modified |

### 2.2 What is missing

- **No per-field, per-actor audit row** for manual events PATCH/POST/DELETE. AI-origin edits leave a trace in Axiom, manual edits leave none.
- **No admin email** triggered by event mutations. `sendAdminEventAlert` is only called from `web/src/lib/email/adminEventAlerts.ts` consumers (event claim notifications, etc.) — not from the events PATCH path.
- **No host-visible "edit history" surface** on the edit form.
- **No public "last updated by" surface** on event detail pages (only `last_verified_at` exists).

### 2.3 Why the existing `app_logs` table is not enough

[`supabase/migrations/20251220050000_create_app_logs_table.sql`](../../supabase/migrations/20251220050000_create_app_logs_table.sql) creates `app_logs` with:

```sql
-- Allow inserts from authenticated users (for logging their own errors)
CREATE POLICY "Authenticated users can insert logs"
  ON app_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Allow anonymous inserts too (for unauthenticated error logging)
CREATE POLICY "Anonymous can insert logs"
  ON app_logs FOR INSERT TO anon WITH CHECK (true);
```

…and a `cleanup_old_logs()` function that drops anything older than 30 days. Two reasons this disqualifies it as the audit surface:

1. **Trust:** `WITH CHECK (true)` for both `authenticated` and `anon` means any client can insert any payload. An audit row that an attacker can also forge or backdate cannot be relied on as evidence.
2. **Retention:** 30 days is fine for transient debug logs but not for "who changed this venue six months ago" host history or for growth surfaces.

The recommendation below introduces a dedicated table with insert restricted to a `SECURITY DEFINER` function called from server routes only. `app_logs` continues to serve transient debug.

---

## 3. Proposed scope (three small PRs, each behind a feature flag)

### PR A — Audit log table + log-on-write (defense + history)

- Migration adds `event_audit_log`:
  ```sql
  CREATE TABLE event_audit_log (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role    text NOT NULL CHECK (actor_role IN ('host','cohost','admin','service','anon','unknown')),
    action        text NOT NULL CHECK (action IN ('create','update','delete','publish','unpublish','cancel','restore','cover_update')),
    source        text NOT NULL CHECK (source IN ('manual_form','ai_chat','ai_edit','api','admin_console','import','service_role')),
    changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb, -- output shape from computePatchDiff
    prior_hash    text,                                -- hashPriorState(prevEvent)
    summary       text,                                -- human-readable one-liner (e.g. "venue: Lost Lake → Larimer Lounge")
    request_id    text,                                -- Vercel x-vercel-id for cross-log correlation
    ip_hash       text,                                -- sha256 of remote IP, never the IP itself
    user_agent_class text,                             -- bucketed: "browser" / "mobile" / "bot" / "unknown"
    created_at    timestamptz NOT NULL DEFAULT now()
  );
  ```
- RLS: insert only via `SECURITY DEFINER` function `log_event_audit(...)` callable by `service_role`. Read for `admin` profiles AND for users who are an accepted host/cohost on the event (defense AND host trust).
- Indexes on `(event_id, created_at desc)`, `(actor_id, created_at desc)`, `(source, created_at desc)`.
- Server-side hook: thin `logEventAudit({ eventId, actorId, action, source, prevEvent, nextEvent, request })` helper invoked from POST / PATCH / DELETE / publish-toggle / cover-update success paths.
- Mirror to Axiom (`[event-audit]` prefix) so existing analytics work without DB load.
- Feature flag: `EVENT_AUDIT_LOG_ENABLED` (default off in non-prod, on in prod).

**Files likely touched:**
- `supabase/migrations/<ts>_event_audit_log.sql` (new)
- `web/src/lib/audit/eventAudit.ts` (new) — mirrors `moderationAudit.ts`
- `web/src/app/api/my-events/route.ts` (POST)
- `web/src/app/api/my-events/[id]/route.ts` (PATCH + DELETE)
- `web/src/app/api/my-events/[id]/overrides/route.ts` (occurrence overrides)
- `web/src/lib/events/computePatchDiff.ts` (no API change, just consumed)
- `web/src/__tests__/event-audit-*.test.ts` (new)

### PR B — Suspicion scorer + throttled admin email (defense)

- Pure scorer module `web/src/lib/events/auditSuspicion.ts` — `scoreEventEdit(input): { score: 0..100, signals: string[], shouldAlertImmediately: boolean }`. Pure + unit-testable.
- Signals (each contributes 0–30 to the score):
  - Account created in last 7d **and** event is published, signal `new_account_published_edit`
  - Editing a `is_dsc_event=true` row without being host/cohost/admin, signal `non_host_csc_edit`
  - >5 distinct events PATCHed by the same actor in the last hour, signal `actor_velocity_burst`
  - High-risk fields (per `patchFieldRegistry.ts`) changed on a published event without `ai_confirm_published_high_risk` AND actor is not the primary host, signal `published_high_risk_no_confirm`
  - Field zeroing (title cleared / venue removed) on a previously-populated published event, signal `field_zeroing`
  - `event_date` set >2y in the future or to a past date, signal `time_travel`
  - First edit ever from this account, signal `first_edit`
  - User-agent classifies as `bot` (curl / python-requests / phantom / no UA), signal `bot_user_agent`
  - Service-role write where `actor_id` is null AND `source != 'service_role'` declared, signal `unattributed_service_write` (always alert)
- Throttling state stored in a tiny in-memory map keyed by `(actor_id, event_id)` with 1h TTL. Lost on cold start; that is acceptable for an alerting layer.
- Daily digest at 8:00 America/Denver lists everything below the immediate-alert threshold from the previous 24h. Implemented as a Vercel cron route hitting a server-side aggregator that reads from `event_audit_log`.
- Reuse `sendAdminEventAlert` from `web/src/lib/email/adminEventAlerts.ts:117`. Email body links to `/dashboard/admin/event-audit?event_id=...&actor_id=...` (deep link to the row).
- Feature flag: `EVENT_AUDIT_ALERTS_ENABLED` (default off everywhere; enable manually in prod after watching the audit table for ~1 week).

**Files likely touched:**
- `web/src/lib/events/auditSuspicion.ts` (new)
- `web/src/app/api/my-events/[id]/route.ts` (call the scorer after audit log insert)
- `web/src/app/api/cron/event-audit-digest/route.ts` (new, Vercel cron)
- `vercel.json` (new cron entry)
- `web/src/__tests__/event-audit-suspicion-*.test.ts` (new)

### PR C — Optional growth surfaces (deferred until A is stable)

- Admin-only `/dashboard/admin/event-audit` UI (paginated list, filterable by event/actor/source/time).
- Host-visible "Edit history" sidebar on the edit form (reads only the rows for events the host owns).
- Public-facing "Last updated by *<host name>*, *<rel time>* — *<changed fields summary>*" footer on event detail pages, opt-in per host.
- Public RSS / JSON feed of recent updates per venue for embedding on venue websites.

**Defer until** PR A has been live for ≥7 days with no anomalies. Public surfaces require a content / UX call from Sami before scope is confirmed.

---

## 4. Step B critique — risks, coupling, rollback, tests

### 4.1 Risks

| Severity | Category | Risk | Mitigation |
|---|---|---|---|
| `blocking` | correctness | Audit insert fails → user-facing PATCH succeeds with no record. Worst-case: silent corruption. | Insert wrapped in `try/catch` with `console.error` fallback emitting to Axiom (`[event-audit-failed]` prefix) so the failure itself is logged. Audit is **not** in the request critical path; PATCH still returns success. Trade silent gap for 100% PATCH availability. |
| `blocking` | correctness | Audit insert fails → user-facing PATCH **also** fails because we wrapped it in a transaction. | Do NOT use a transaction. Insert is best-effort, fire-and-forget via `void logEventAudit(...).catch(...)`. |
| `blocking` | privacy | Storing IP addresses in plaintext violates privacy posture in `docs/PRODUCT_NORTH_STAR.md`. | Store `ip_hash = sha256(ip + per-day salt)` instead. Allows velocity scoring without storing the IP. Salt rotates daily so cross-day linking is impossible. |
| `non-blocking` | correctness | High write volume from a single bot fills the table. | Index on `(actor_id, created_at desc)` plus a partial-index cleanup job that prunes rows older than 1 year for `actor_role IN ('host','cohost','admin')` and 90 days for `actor_role IN ('anon','unknown','service')`. Storage budget below. |
| `non-blocking` | correctness | Suspicion scorer false positives (busy host polishing a draft). | All "polishing" signals weighted ≤10. Immediate-alert threshold = 60. Polishing alone cannot trip an alert. Daily digest still surfaces patterns. |
| `non-blocking` | correctness | Admin email floods. | Throttle: 1 immediate alert per `(actor, event)` per hour. Daily digest collapses everything else. `sendAdminEventAlert` already has its own dedupe map (line 83). |
| `non-blocking` | privacy | Host-visible "edit history" leaks who reverted whose change in a co-host scenario. | Display only `actor_role` (host / cohost / admin / AI) by default. Show actor display name only to admins. Decision lives in PR C, not A. |
| `non-blocking` | cosmetic | Daily digest delivered to admin inboxes too early in the day. | 8am MT default; configurable per admin in their notification preferences. |

### 4.2 Coupling

**Touches:** event POST/PATCH/DELETE routes, occurrence overrides POST, the AI auto-apply path inside `ConversationalCreateUI` (which already PATCHes through the same route — automatic coverage), `sendAdminEventAlert`, Vercel cron config.

**Does NOT touch:**
- Symphony orchestrator (`tools/symphony/**`)
- Track 2 BOLA / RLS audit work (`web/src/__tests__/track2-*-negative.test.ts`, `docs/investigation/track2-2l*.md`)
- Geocoding pipeline (`web/src/lib/geocoding/**` + `events.geocode_source` / `geocoded_at`)
- Prompt / interpreter contract files (`web/src/lib/events/aiPromptContract.ts`, `interpretEventContract.ts`, `interpreterPostprocess.ts`, `web/src/app/api/events/interpret/`)
- Existing `evaluatePublishedAiSafetyGate` logic (PR A is read-only relative to it)
- Existing `editTurnTelemetry` (PR A only mirrors to a new sink, doesn't replace)

**Single-writer locks already declared in the Track 1 collaboration plan §8.2** — none of the locked files are in scope. The only AI-flow file we read from (`ConversationalCreateUI.tsx`) is **read** for context, not modified.

### 4.3 Storage budget

Conservative estimate: 100 events × 5 edits/day average = 500 rows/day. Each row ~400 bytes (including JSON diff). ~200 KB/day = ~75 MB/year. Cleanup job below keeps this bounded. Negligible for Supabase free / pro tier.

### 4.4 Rollback plan

| PR | Rollback |
|---|---|
| A | Set `EVENT_AUDIT_LOG_ENABLED=false`. Audit hook becomes a no-op; PATCH path is unchanged. The migration is forward-only (no DROP); audit rows remain in DB but are inert. To fully remove, follow the rollback-only SQL placement rule in `30-supabase-migrations-and-deploy.md` (file under `supabase/migrations/_archived/`). |
| B | Set `EVENT_AUDIT_ALERTS_ENABLED=false`. Scorer becomes a no-op. No emails fire. Cron route returns 204. |
| C | Per-component flags. Public surface flags default off; turning them off restores prior UI. |

### 4.5 Test strategy

| Test class | Scope | Notes |
|---|---|---|
| Unit — `auditSuspicion.test.ts` | Score calculation per signal, threshold behavior, throttling state | Pure function, no I/O |
| Unit — `eventAudit.test.ts` | Helper builds the right payload from `prevEvent + nextEvent + actor` | Mock supabase client |
| Integration — PATCH route | Audit row written on success, no row on 400/403/409, fire-and-forget on insert error | Use existing mock pattern from `track1-pr9-published-event-gate.test.ts` |
| RLS smoke | Insert succeeds via service role; insert blocked for `authenticated` / `anon`; SELECT succeeds for admin + event host; SELECT blocked for unrelated authenticated user | Required by `30-supabase-migrations-and-deploy.md` policy gate |
| Email — `sendAdminEventAlert` integration | Throttle dedupe key respected, digest renders right, email body links resolve | Reuse `__resetAdminEventAlertDedupeForTests` |
| Source-text contract tests | Audit hook called from each write path, scorer wired only behind the flag | Same pattern as `ai-edit-existing-event-parity.test.ts` |

### 4.6 Migration safety

- New table only. No ALTER on existing tables. `ON DELETE CASCADE` from `events.id` is intentional — if an event row is removed, its audit history goes with it (avoids orphan rows). If the user prefers permanent retention even after delete, switch to `ON DELETE SET NULL` with a `deleted_at`-style soft-delete; flagged as an open question below.
- Add `-- REVIEWED: policy change acknowledged` per CI Guardrail C in `30-supabase-migrations-and-deploy.md`.
- No bidirectional RLS cycles introduced — `event_audit_log.event_id` references `events`, but no policy on `events` reads back from `event_audit_log`.

---

## 5. Edge-case map (defensive intent vs friction)

| Scenario | Logged? | Scored? | Alert? | Why |
|---|---|---|---|---|
| Host polishes a draft 10× in 5 minutes | ✅ each | ≤10 each | ❌ | Polishing intent — appears in digest as one rolled-up line |
| AI auto-apply landing a venue change on a draft | ✅ | ≤20 | ❌ | Already gated by safety gate; logged for analytics |
| AI auto-apply landing a date change on a published event with confirmation | ✅ | ≤30 | ❌ unless second handshake fails | Confirmation handshake is the alert proxy |
| AI auto-apply on a published event WITHOUT the confirmation header | ❌ (gate rejects with 409 before audit fires) | n/a | n/a | The 409 already makes it impossible |
| New account (3 days old) PATCHes a CSC-branded event | ✅ | 50–80 | ✅ immediate | Highest-confidence bad-actor signal |
| Admin edits another host's event | ✅, `actor_role='admin'` | 0 | ❌ | Tag in admin console; audit row provides accountability |
| Bulk import of 50 open mics | ✅ each, `source='import'` | 0 (excluded from velocity) | ❌ | Single digest line: "Import landed N events" |
| Cancellation of a published event | ✅ + existing host notification | ≤20 | ❌ unless paired with `field_zeroing` | Cancellation already has its own UX |
| Cover swap on a draft | ✅, `action='cover_update'` | 0 | ❌ | Not safety-relevant for unpublished |
| Cover swap on a published event by host | ✅ | ≤10 | ❌ | Confirmation handshake covers high-risk path |
| Service-role write where actor cannot be resolved | ✅, `actor_role='service'`, signal `unattributed_service_write` | 100 | ✅ immediate | Always alert — investigation required |
| Cron job updating `last_verified_at` (admin bulk verify) | ✅ once per batch, `source='admin_console'` | 0 | ❌ | Single batch row; per-event rows would be noise |
| Field zeroing on previously-populated venue | ✅ | 30 | ❌ alone, ✅ if combined with another signal | Often a legit "we don't have a venue yet" toggle, but a strong combinator |
| Time-travel `event_date = 2099-01-01` | ✅ | 30 | ✅ if combined | Real cases exist (festival 5y out) — not alone |
| Edit by host whose account was created 6mo ago, low score | ✅ | ≤5 | ❌ | Normal maintenance |

The **balance principle**: any single signal cannot trip an immediate alert by itself except `unattributed_service_write` and `non_host_csc_edit + new_account_published_edit` co-occurring. Everything else lands in the daily digest, which is non-blocking for hosts.

---

## 6. Growth angles bundled into the same data

These are **opt-in per host / per event** and gated by PR C feature flags. The table is the same; only the surfaces differ.

| Surface | Audience | Win | Gate |
|---|---|---|---|
| "Last updated by *<host>*, *<rel time>* — *<fields>*" footer | Public detail page visitors | Trust signal, freshness for SEO | Per-host opt-in setting; default off until first audit-week is reviewed |
| Edit-history sidebar on the host's edit form | Host themselves | Reduces "did I save?" anxiety; deflects "who changed this?" support | Host always sees their own; cohosts see their own |
| RSS / JSON feed of venue updates | Venue websites embedding our data | Distribution channel; venue sites point traffic back to us | Venue-claim-required; admin verifies first |
| Admin "this week's edit volume" dashboard tile | Admins | Operational awareness | Admin-only, no public surface |

The growth surfaces do not require new data — they're slices of `event_audit_log`. Cost is a few rendering components.

---

## 7. Open questions for Sami

These need a decision before any code lands. Listed in priority order.

1. **Single PR or split into A / B / C?** Recommended: split. PR A (audit log) lands first and runs silently for ~1 week. PR B (alerts) lands after we know what the table contains. PR C is deferred indefinitely until A+B prove their value.
2. **Email frequency:** immediate-on-suspicion + daily digest, or digest-only? Immediate is recommended for the highest-confidence signals, digest for everything else.
3. **Daily digest delivery time:** 8am America/Denver default — is this right, or do you prefer something else?
4. **Retention policy:**
   - Keep audit rows forever?
   - Roll up rows older than 90 days into monthly summaries (lossy)?
   - Drop rows older than 1 year for low-risk actors only?
5. **Public surfaces (PR C):** opt-in per host, default-on once content is clean, or never (admins-only is fine)?
6. **`ON DELETE` behavior** when an event is deleted: cascade audit rows (clean, current proposal), or keep them with `event_id` set to NULL (permanent forensics)?
7. **Service-role coverage:** every service-role write to `events` should set `source = 'service_role'` and pass an actor identity (system task name). Today there's no convention. Should a follow-up sweep audit the existing service-role call sites and add the metadata?
8. **AI-origin double-logging:** AI edits already emit to Axiom via `editTurnTelemetry`. The new audit table will also capture them. Acceptable double-write, or should the AI path skip the table and rely on Axiom (with a join-by-turnId report instead)?
9. **Feature flag default:** ship A flagged-off in prod and turn on manually after reviewing migration apply, or ship flagged-on (mirroring the `last_verified_at` rollout)?
10. **CSC-branding signal weight:** how aggressive do you want the `non_host_csc_edit` signal? It has the highest false-positive risk if a co-host hasn't been added correctly to `event_hosts`.

---

## 8. Out of scope for this investigation

Listed to make the bounds explicit; not a commitment to ever build them.

- ML-based anomaly detection (statistical baselines per actor, embeddings on edit summaries).
- Auto-revert on suspicion (too aggressive for a community platform; humans should decide).
- Real-time admin dashboard with WebSockets.
- Cross-event "this actor edited 50 events in 5 minutes" graph view.
- Audit log for non-event tables (`venues`, `profiles`, etc.) — separate investigation if needed.
- Migrating `moderationAudit` / `opsAudit` / `venueAudit` callers off `app_logs` onto a hardened table — separate scope, valuable but not blocking.
- Integration with the existing `editTurnTelemetry` user-outcome capture (PR #148) beyond data join.

---

## 9. Definition of done

### 9.1 PR A (audit log + log-on-write)

- [ ] Migration creates `event_audit_log` with RLS, indexes, and `-- REVIEWED: policy change acknowledged` header.
- [ ] `web/src/lib/audit/eventAudit.ts` mirrors the `moderationAudit.ts` shape; service-role insert; fire-and-forget error handling.
- [ ] All event write paths call the helper (POST, PATCH, DELETE, occurrence overrides POST). One call per write, one row per call.
- [ ] Feature flag `EVENT_AUDIT_LOG_ENABLED` gates the helper.
- [ ] RLS smoke test from `30-supabase-migrations-and-deploy.md` recorded.
- [ ] Unit + integration + source-text tests added.
- [ ] No regression in `track1-pr9-published-event-gate.test.ts`, `ai-edit-existing-event-parity.test.ts`, `interpreter-host-draft-sync.test.ts`, `edit-turn-telemetry-wiring.test.ts`.
- [ ] `docs/CONTRACTS.md` updated with the audit-row shape (read-only contract for future surfaces).
- [ ] `docs/completed/CLAUDE.md` updated.

### 9.2 PR B (suspicion scorer + admin email)

- [ ] Pure scorer module + unit tests.
- [ ] Vercel cron route + `vercel.json` entry.
- [ ] Throttle in-memory state covered by tests; cold-start behavior documented.
- [ ] Email body verified end-to-end against the existing `sendAdminEventAlert` template.
- [ ] Feature flag `EVENT_AUDIT_ALERTS_ENABLED` gates immediate + digest.
- [ ] Manual smoke: trigger each signal once in staging, confirm email lands.

### 9.3 PR C (growth surfaces)

- Deferred. Requires explicit re-investigation after PR A has been live ≥7 days.

---

## 10. Stop-gate ask

This document is Step A (investigation) + Step B (critique) per `docs/GOVERNANCE.md`. **No code, schema, or runtime change is being proposed for merge with this PR.** It is investigation-only per the doc-only PR carve-out.

Before any code work begins, Sami needs to:

1. Approve PR A's scope, schema, and feature-flag posture.
2. Decide PR A vs A+B together vs all three.
3. Answer the open questions in §7 (at least 1, 2, 4, 6, and 9 are blocking).

After that, the implementation can proceed under the existing PR-by-PR pattern (one focused PR per concern, source-text tests, browser smoke for any UI surface, no Symphony / Track 2 / geocoding / prompt-contract files touched).

---

**End — Investigation v1.**
