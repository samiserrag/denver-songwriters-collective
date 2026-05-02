/**
 * Lane 5 PR A — source-text contract tests.
 *
 * Pins:
 *   1. Each event write route imports the audit helper.
 *   2. Each event write route calls logEventAudit on the success path
 *      with .catch so the route never throws on audit failure.
 *   3. The helper has the feature-flag gate at the top of logEventAudit.
 *   4. The migration declares the schema/RLS/indexes Sami signed off
 *      on (decision memo §2.2 + §2.5 + Trust Layer Invariant).
 *
 * Mirrors the source-text pattern used by:
 *   - ai-edit-existing-event-parity.test.ts
 *   - ai-edit-routes.test.ts
 *   - happening-actions-row.test.ts
 *
 * The runtime behavior is gated behind EVENT_AUDIT_LOG_ENABLED so we
 * cannot exercise the insert against the live DB from CI. The source-
 * text pins prevent silent removal of the hook.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const HELPER_PATH = path.resolve(
  __dirname,
  "../lib/audit/eventAudit.ts"
);
const HELPER_TEST_FRIENDLY_PATH = path.resolve(
  __dirname,
  "./event-audit-helper.test.ts"
);
const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260502190000_create_event_audit_log.sql"
);
const POST_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/my-events/route.ts"
);
const EVENT_ID_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/my-events/[id]/route.ts"
);
const OVERRIDES_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/my-events/[id]/overrides/route.ts"
);

const helperSource = fs.readFileSync(HELPER_PATH, "utf-8");
const migrationSource = fs.readFileSync(MIGRATION_PATH, "utf-8");
const postRouteSource = fs.readFileSync(POST_ROUTE_PATH, "utf-8");
const eventIdRouteSource = fs.readFileSync(EVENT_ID_ROUTE_PATH, "utf-8");
const overridesRouteSource = fs.readFileSync(OVERRIDES_ROUTE_PATH, "utf-8");

// ─── 1) Helper module: feature flag, fire-and-forget, Axiom mirror ──────────
describe("event audit helper — module shape", () => {
  it("exports the feature-flag check and gates logEventAudit on it", () => {
    expect(helperSource).toContain("export function isEventAuditLogEnabled()");
    expect(helperSource).toMatch(
      /process\.env\.EVENT_AUDIT_LOG_ENABLED === "true"/
    );
    // The flag check must be the first line of logEventAudit.
    expect(helperSource).toMatch(
      /export async function logEventAudit\([^)]+\)[\s\S]*?if \(!isEventAuditLogEnabled\(\)\) return;/
    );
  });

  it("uses service-role client + bypasses RLS by design", () => {
    expect(helperSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(helperSource).toContain('"event_audit_log"');
  });

  it("mirrors to Axiom via console.info with the [event-audit] prefix", () => {
    expect(helperSource).toContain('console.info("[event-audit]"');
  });

  it("logs failures with the [event-audit-failed] prefix without throwing", () => {
    expect(helperSource).toContain('"[event-audit-failed]"');
    // No `throw` statements inside logEventAudit (fire-and-forget).
    const fnBody = helperSource.split("export async function logEventAudit")[1] ?? "";
    expect(fnBody.split("export ")[0]).not.toMatch(/^\s*throw\b/m);
  });

  it("hashes IP with a daily salt — never stores plaintext", () => {
    expect(helperSource).toContain("function hashIp");
    expect(helperSource).toContain("createHash(\"sha256\")");
    expect(helperSource).toContain("dailySalt");
  });

  it("exports the actor_role / source / action enums for route hooks", () => {
    expect(helperSource).toContain("export type EventAuditAction");
    expect(helperSource).toContain("export type EventAuditSource");
    expect(helperSource).toContain("export type EventAuditActorRole");
  });
});

// ─── 2) POST /api/my-events route hook ──────────────────────────────────────
describe("POST /api/my-events — audit hook", () => {
  it("imports the audit helper from @/lib/audit/eventAudit", () => {
    expect(postRouteSource).toMatch(
      /import\s*\{[^}]*logEventAudit[^}]*\}\s*from\s*"@\/lib\/audit\/eventAudit"/
    );
  });

  it("calls logEventAudit on the success path with .catch", () => {
    expect(postRouteSource).toMatch(
      /void logEventAudit\(\{[\s\S]*?action:\s*"create"[\s\S]*?\}\)\.catch\(/
    );
  });

  it("uses snapshotFromEventRow + readEventAuditRequestContext + resolveEventAuditSource", () => {
    expect(postRouteSource).toContain("snapshotFromEventRow");
    expect(postRouteSource).toContain("readEventAuditRequestContext");
    expect(postRouteSource).toContain("resolveEventAuditSource");
  });
});

// ─── 3) PATCH + DELETE /api/my-events/[id] route hooks ─────────────────────
describe("PATCH + DELETE /api/my-events/[id] — audit hooks", () => {
  it("imports the audit helper and the EventAuditAction type", () => {
    expect(eventIdRouteSource).toMatch(
      /import\s*\{[^}]*logEventAudit[^}]*\}\s*from\s*"@\/lib\/audit\/eventAudit"/
    );
    expect(eventIdRouteSource).toContain("type EventAuditAction");
  });

  it("destructures aiWriteSource from parseAiWriteMetadata for the source resolver", () => {
    expect(eventIdRouteSource).toContain(
      "const { aiConfirmation, isAiAutoApply, aiWriteSource, sanitizedBody } = parseAiWriteMetadata"
    );
  });

  it("PATCH success path classifies the action by intent (publish/unpublish/cancel/restore/cover_update/update)", () => {
    expect(eventIdRouteSource).toMatch(/const auditAction: EventAuditAction = \(\(\) => \{/);
    expect(eventIdRouteSource).toMatch(/return "publish"/);
    expect(eventIdRouteSource).toMatch(/return "unpublish"/);
    expect(eventIdRouteSource).toMatch(/return "cancel"/);
    expect(eventIdRouteSource).toMatch(/return "restore"/);
    expect(eventIdRouteSource).toMatch(/return "cover_update"/);
    expect(eventIdRouteSource).toMatch(/return "update"/);
  });

  it("PATCH success path calls logEventAudit with prevEvent + nextEvent + priorHash", () => {
    expect(eventIdRouteSource).toMatch(
      /void logEventAudit\(\{[\s\S]*?action: auditAction[\s\S]*?priorHash: hashPriorState\(prevEvent\)[\s\S]*?\}\)\.catch\(/
    );
  });

  it("DELETE hard-delete branch logs with eventId=null + snapshot from prior event row", () => {
    // The hard-delete branch must NOT pass eventId — it nulls it so
    // ON DELETE SET NULL on the FK matches the audit row's null.
    expect(eventIdRouteSource).toMatch(
      /void logEventAudit\(\{[\s\S]*?eventId: null[\s\S]*?action: "delete"[\s\S]*?\}\)\.catch\(/
    );
  });

  it("DELETE soft-delete branch logs as action: cancel with the cancel reason summary", () => {
    expect(eventIdRouteSource).toMatch(
      /void logEventAudit\(\{[\s\S]*?action: "cancel"[\s\S]*?summary: cancelReason/
    );
  });
});

// ─── 4) POST /api/my-events/[id]/overrides route hook ──────────────────────
describe("POST /api/my-events/[id]/overrides — audit hook", () => {
  it("imports the audit helper", () => {
    expect(overridesRouteSource).toMatch(
      /import\s*\{[^}]*logEventAudit[^}]*\}\s*from\s*"@\/lib\/audit\/eventAudit"/
    );
  });

  it("calls logEventAudit with action=update on the success path with the date_key in summary", () => {
    expect(overridesRouteSource).toMatch(
      /void logEventAudit\(\{[\s\S]*?action: "update"[\s\S]*?\$\{date_key\}[\s\S]*?\}\)\.catch\(/
    );
  });
});

// ─── 5) Migration shape ─────────────────────────────────────────────────────
describe("event_audit_log migration", () => {
  it("declares the table with the denormalized snapshot columns Sami signed off on (decision memo §2.5)", () => {
    expect(migrationSource).toContain("CREATE TABLE IF NOT EXISTS event_audit_log");
    expect(migrationSource).toContain("event_id_at_observation uuid NOT NULL");
    expect(migrationSource).toContain("event_title_at_observation text");
    expect(migrationSource).toContain("event_slug_at_observation text");
    expect(migrationSource).toContain("event_start_date_at_observation text");
    expect(migrationSource).toContain("event_venue_name_at_observation text");
  });

  it("uses ON DELETE SET NULL on event_id (NOT cascade) per Sami's §7 #6 answer", () => {
    expect(migrationSource).toMatch(
      /event_id\s+uuid\s+REFERENCES events\(id\)\s+ON DELETE SET NULL/
    );
    expect(migrationSource).not.toContain("ON DELETE CASCADE");
  });

  it("includes the canonical CHECK constraints on actor_role / action / source", () => {
    // 'import' is a separate actor_role (not just a source) per the
    // decision-memo retention table — service/import: 365d retention,
    // distinct from the per-actor host/cohost/admin: indefinite tier.
    expect(migrationSource).toContain(
      "actor_role IN ('host', 'cohost', 'admin', 'service', 'import', 'anon', 'unknown')"
    );
    expect(migrationSource).toMatch(
      /action IN \(\s*'create',\s*'update',\s*'delete',\s*'publish',\s*'unpublish',\s*'cancel',\s*'restore',\s*'cover_update'\s*\)/
    );
    expect(migrationSource).toMatch(
      /source IN \(\s*'manual_form',\s*'ai_chat',\s*'ai_edit',\s*'api',\s*'admin_console',\s*'import',\s*'service_role'\s*\)/
    );
  });

  it("enables RLS and denies all client inserts (no app_logs-style wide-open policy)", () => {
    expect(migrationSource).toContain("ALTER TABLE event_audit_log ENABLE ROW LEVEL SECURITY");
    expect(migrationSource).toMatch(
      /CREATE POLICY "no client inserts on event_audit_log"[\s\S]*?FOR INSERT[\s\S]*?TO authenticated, anon[\s\S]*?WITH CHECK \(false\)/
    );
  });

  it("admin SELECT policy reads from profiles.role = 'admin'", () => {
    expect(migrationSource).toMatch(
      /CREATE POLICY "admins read all event_audit_log"[\s\S]*?profiles\.role = 'admin'/
    );
  });

  it("host/cohost SELECT policy joins event_hosts with accepted invitation_status", () => {
    expect(migrationSource).toMatch(
      /CREATE POLICY "hosts read event_audit_log for their events"[\s\S]*?event_hosts\.invitation_status = 'accepted'/
    );
  });

  it("declares no UPDATE / DELETE policy — audit rows are immutable from the API", () => {
    expect(migrationSource).not.toMatch(/CREATE POLICY[^;]+FOR UPDATE/);
    expect(migrationSource).not.toMatch(/CREATE POLICY[^;]+FOR DELETE/);
  });

  it("includes the CI Guardrail C policy-change acknowledgment header", () => {
    expect(migrationSource).toContain("-- REVIEWED: policy change acknowledged");
  });

  it("declares the indexes the investigation §3 PR A scope listed", () => {
    expect(migrationSource).toContain("idx_event_audit_log_event_id_created");
    expect(migrationSource).toContain("idx_event_audit_log_event_id_at_obs_created");
    expect(migrationSource).toContain("idx_event_audit_log_actor_id_created");
    expect(migrationSource).toContain("idx_event_audit_log_source_created");
    expect(migrationSource).toContain("idx_event_audit_log_created_at");
  });

  it("documents the runtime RLS smoke queries in the header per 30-supabase-migrations-and-deploy.md", () => {
    expect(migrationSource).toContain("Runtime RLS smoke queries");
    expect(migrationSource).toContain("Service role insert succeeds");
    expect(migrationSource).toContain("Authenticated insert blocked");
    expect(migrationSource).toContain("Admin SELECT succeeds");
    expect(migrationSource).toContain("Host SELECT scoped to their events succeeds");
  });
});

// ─── 6) Anti-creep — PR A boundaries ────────────────────────────────────────
describe("PR A — anti-creep", () => {
  it("does NOT introduce admin UI, email behavior, suspicion scorer, or public surface code in this PR", () => {
    // No PR B/C symbols should be referenced from PR A files.
    expect(helperSource).not.toMatch(/\bauditSuspicion\b/);
    expect(helperSource).not.toMatch(/sendAdminEventAlert/);
    expect(helperSource).not.toMatch(/cron/i);
    // Routes should not gain any new admin/email/scorer wiring around
    // the audit hook.
    for (const src of [postRouteSource, eventIdRouteSource, overridesRouteSource]) {
      expect(src).not.toMatch(/auditSuspicion/);
    }
  });

  it("keeps the helper test file present (signal that PR A includes its tests)", () => {
    expect(fs.existsSync(HELPER_TEST_FRIENDLY_PATH)).toBe(true);
  });
});
