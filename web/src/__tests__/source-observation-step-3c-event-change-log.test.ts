/**
 * Lane 6 Step 3c — event_change_log Migration (Content-Scan Tests)
 *
 * Static assertions over the migration SQL file. Verifies that the migration:
 *
 * - Creates public.event_change_log with the columns, defaults, CHECK enums,
 *   FKs, and RLS posture described in the Step 3c brief and decision memo.
 * - Q1: event_id is NOT NULL with FK ON DELETE CASCADE.
 * - Q2: BOTH an RLS UPDATE policy AND a BEFORE UPDATE
 *   `event_change_log_validate_transition` trigger are present (defense-
 *   in-depth). The trigger function raises on terminal-state transitions
 *   and on direct pending -> applied.
 * - Q3: field_name CHECK enum lists the 9 initial allowlisted fields.
 * - Q4: change_severity CHECK enum lists `minor` / `material` /
 *   `cancellation_risk`.
 * - Q5: applied_audit_log_id is uuid nullable with NO FK constraint in 3c.
 * - Q6: proposal_source CHECK enum is exhaustive over the three sanctioned
 *   roles only; no `user_direct` / similar value.
 * - Q7: no partitioning DDL.
 * - Q8: schema implicitly supports per-(event, observation, field) rows.
 * - Five indexes per brief §6 (no GIN, no covering composite, no partition).
 * - Admin SELECT + admin transition-constrained UPDATE policies; no
 *   anon/authenticated/admin INSERT/DELETE policies; service_role grant.
 * - No SECURITY DEFINER, no public view, no events-table modification, no
 *   sibling tables.
 *
 * Source: docs/investigation/source-observation-step-3c-event-change-log-brief.md
 *         docs/investigation/source-observation-step-3c-open-questions-decision-memo.md
 *
 * No production verification behavior changes. last_verified_at IS NOT NULL
 * remains the only active rule. SOURCE-OBS-01 stays Draft / Proposed /
 * Not Active. event_audit_log semantics unchanged. Lane 5 PR B scope not
 * expanded.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase/migrations");

function findMigration(stem: string): { filename: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR).filter(
    (f) => f.endsWith(".sql") && f.includes(stem),
  );
  if (files.length === 0) {
    throw new Error(`migration matching '${stem}' not found in ${MIGRATIONS_DIR}`);
  }
  if (files.length > 1) {
    throw new Error(
      `multiple migrations match '${stem}': ${files.join(", ")} — expected exactly one`,
    );
  }
  return {
    filename: files[0],
    sql: readFileSync(join(MIGRATIONS_DIR, files[0]), "utf-8"),
  };
}

describe("Lane 6 Step 3c — event_change_log migration", () => {
  // Match the 3c migration (must include the table name, not just a substring
  // that could match 3b / 3a).
  const { filename, sql } = findMigration("_event_change_log.sql");
  const cleanSql = sql
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  describe("file presence and naming", () => {
    it("uses the standard timestamp_underscore_lowercase migration filename", () => {
      expect(filename).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    });

    it("filename is not a rollback file", () => {
      expect(filename.toLowerCase()).not.toContain("rollback");
    });

    it("file header cites the brief and decision memo", () => {
      expect(sql).toMatch(
        /source-observation-step-3c-event-change-log-brief\.md/i,
      );
      expect(sql).toMatch(
        /source-observation-step-3c-open-questions-decision-memo\.md/i,
      );
    });
  });

  describe("table creation", () => {
    it("creates public.event_change_log", () => {
      expect(sql).toMatch(
        /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.event_change_log/i,
      );
    });

    it("declares id as UUID primary key with gen_random_uuid default", () => {
      expect(sql).toMatch(
        /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
      );
    });

    it("declares NOT NULL on critical columns", () => {
      expect(sql).toMatch(/event_id\s+UUID\s+NOT\s+NULL/i);
      expect(sql).toMatch(/observation_id\s+UUID\s+NOT\s+NULL/i);
      expect(sql).toMatch(/source_id\s+UUID\s+NOT\s+NULL/i);
      expect(sql).toMatch(/field_name\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/change_severity\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/proposal_source\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/status\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
      expect(sql).toMatch(/updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    });

    it("confidence has CHECK between 0 and 1", () => {
      expect(sql).toMatch(
        /confidence\s+NUMERIC\(4,3\)\s+CHECK\s*\(\s*confidence\s+BETWEEN\s+0\s+AND\s+1\s*\)/i,
      );
    });
  });

  describe("memo Q1 — event_id NOT NULL with FK ON DELETE CASCADE", () => {
    it("event_id has NOT NULL and FK to events with CASCADE", () => {
      expect(sql).toMatch(
        /event_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.events\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      );
    });
  });

  describe("memo Q2 — RLS + transition trigger (defense-in-depth)", () => {
    it("creates the transition validation function", () => {
      expect(sql).toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.event_change_log_validate_transition\(\)\s+RETURNS\s+TRIGGER/i,
      );
    });

    it("transition function raises on terminal-state transitions", () => {
      expect(sql).toMatch(
        /OLD\.status\s+IN\s*\(\s*'applied'\s*,\s*'rejected'\s*,\s*'withdrawn'\s*,\s*'superseded'\s*\)/i,
      );
      expect(sql).toMatch(/cannot transition out of terminal status/i);
    });

    it("transition function raises on direct pending -> applied", () => {
      expect(sql).toMatch(
        /OLD\.status\s*=\s*'pending'\s+AND\s+NEW\.status\s*=\s*'applied'/i,
      );
      expect(sql).toMatch(
        /direct pending\s*->\s*applied transition is not allowed/i,
      );
    });

    it("creates the BEFORE UPDATE trigger that fires the validation function", () => {
      expect(sql).toMatch(
        /CREATE\s+TRIGGER\s+event_change_log_validate_transition[\s\S]*?BEFORE\s+UPDATE\s+ON\s+public\.event_change_log[\s\S]*?EXECUTE\s+FUNCTION\s+public\.event_change_log_validate_transition\(\)/i,
      );
    });

    it("admin UPDATE policy allows only pending -> approved/rejected", () => {
      expect(sql).toMatch(/CREATE\s+POLICY\s+event_change_log_admin_update/i);
      expect(sql).toMatch(/FOR\s+UPDATE/i);
      // USING includes status = 'pending'
      expect(sql).toMatch(/USING\s*\([\s\S]*?status\s*=\s*'pending'[\s\S]*?\)/i);
      // WITH CHECK includes status IN ('approved', 'rejected')
      expect(sql).toMatch(
        /WITH\s+CHECK\s*\([\s\S]*?status\s+IN\s*\(\s*'approved'\s*,\s*'rejected'\s*\)[\s\S]*?\)/i,
      );
    });
  });

  describe("memo Q3 — field_name CHECK enum (9 values)", () => {
    it("CHECK enum exhaustively lists the 9 initial allowlist fields", () => {
      const match = sql.match(
        /field_name\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*field_name\s+IN\s*\(([^)]+)\)/is,
      );
      expect(match).not.toBeNull();
      const list = (match?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean)
        .sort();
      expect(list).toEqual(
        [
          "description",
          "end_at",
          "organizer",
          "start_at",
          "status",
          "ticket_url",
          "title",
          "venue_id",
          "venue_name",
        ].sort(),
      );
    });
  });

  describe("memo Q4 — change_severity CHECK enum (3 values)", () => {
    it("CHECK enum lists minor / material / cancellation_risk", () => {
      const match = sql.match(
        /change_severity\s+TEXT\s+NOT\s+NULL\s+CHECK\s*\(\s*change_severity\s+IN\s*\(([^)]+)\)/is,
      );
      expect(match).not.toBeNull();
      const list = (match?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean)
        .sort();
      expect(list).toEqual(["cancellation_risk", "material", "minor"].sort());
    });

    it("change_severity does NOT have an UPDATE trigger to compute it", () => {
      // Severity is emitted by the Trust agent at INSERT, immutable per row.
      expect(cleanSql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[^\n]*(compute_severity|maintain_severity|sync_severity)/i,
      );
    });
  });

  describe("memo Q5 — applied_audit_log_id nullable uuid, no FK in 3c", () => {
    it("declares applied_audit_log_id as bare UUID (no NOT NULL)", () => {
      expect(sql).toMatch(/applied_audit_log_id\s+UUID,/i);
    });

    it("has no FK on applied_audit_log_id in 3c", () => {
      expect(cleanSql).not.toMatch(/applied_audit_log_id[^,\n]*REFERENCES/i);
    });

    it("declares derivation_run_id as bare UUID (no FK, no CHECK)", () => {
      expect(sql).toMatch(/derivation_run_id\s+UUID,/i);
      expect(cleanSql).not.toMatch(/derivation_run_id[^,\n]*REFERENCES/i);
      expect(cleanSql).not.toMatch(/derivation_run_id[^,\n]*CHECK/i);
    });
  });

  describe("memo Q6 — proposal_source enum has no user-direct-write value", () => {
    it("CHECK enum exhaustively lists the three sanctioned roles only", () => {
      const match = sql.match(
        /proposal_source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'derivation'\s+CHECK\s*\(\s*proposal_source\s+IN\s*\(([^)]+)\)/is,
      );
      expect(match).not.toBeNull();
      const list = (match?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean)
        .sort();
      expect(list).toEqual(
        ["admin_seed", "concierge_extract", "derivation"].sort(),
      );
    });

    it("no 'user_direct' or similar value is present", () => {
      const forbidden = [
        "user_direct",
        "user_write",
        "user_correction",
        "user_submitted",
        "community_direct",
      ];
      for (const v of forbidden) {
        expect(sql).not.toContain(`'${v}'`);
      }
    });

    it("default proposal_source is 'derivation'", () => {
      expect(sql).toMatch(
        /proposal_source\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'derivation'/i,
      );
    });

    it("does not grant INSERT to authenticated", () => {
      expect(cleanSql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+authenticated\b/i);
    });
  });

  describe("memo Q7 — no partitioning, no retention", () => {
    it("does not declare partitioning", () => {
      expect(cleanSql).not.toMatch(/PARTITION\s+(BY|OF)/i);
    });
  });

  describe("memo Q8 — one row per (event, observation, field)", () => {
    it("schema does not collapse multi-field deltas into a jsonb array column", () => {
      // The brief recommends one row per field, not one row per observation.
      // Guard: no `field_deltas jsonb` or similar bundle column.
      expect(cleanSql).not.toMatch(/field_deltas\s+JSONB/i);
      expect(cleanSql).not.toMatch(/proposed_fields\s+JSONB/i);
      expect(cleanSql).not.toMatch(/normalized_fields\s+JSONB/i);
    });

    it("there is no UNIQUE constraint that would prevent multi-field rows per observation", () => {
      // (event_id, observation_id) UNIQUE would force one row per observation;
      // we want one row per (event, observation, field).
      expect(cleanSql).not.toMatch(
        /UNIQUE\s*\(\s*event_id\s*,\s*observation_id\s*\)/i,
      );
      expect(cleanSql).not.toMatch(
        /CREATE\s+UNIQUE\s+INDEX[^;]*\(\s*event_id\s*,\s*observation_id\s*\)/i,
      );
    });
  });

  describe("brief §3 — required workflow / metadata columns", () => {
    it("includes status column with the 6-value workflow CHECK enum", () => {
      const match = sql.match(
        /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'\s+CHECK\s*\(\s*status\s+IN\s*\(([^)]+)\)/is,
      );
      expect(match).not.toBeNull();
      const list = (match?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean)
        .sort();
      expect(list).toEqual(
        [
          "applied",
          "approved",
          "pending",
          "rejected",
          "superseded",
          "withdrawn",
        ].sort(),
      );
    });

    it("declares reviewed_by FK to profiles ON DELETE SET NULL (nullable)", () => {
      expect(sql).toMatch(
        /reviewed_by\s+UUID\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
    });

    it("declares observation_id FK to event_source_observations ON DELETE CASCADE", () => {
      expect(sql).toMatch(
        /observation_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.event_source_observations\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      );
    });

    it("declares source_id FK to event_sources ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /source_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.event_sources\(id\)\s+ON\s+DELETE\s+RESTRICT/i,
      );
    });

    it("includes reviewed_at and applied_at timestamps", () => {
      expect(sql).toMatch(/reviewed_at\s+TIMESTAMPTZ/i);
      expect(sql).toMatch(/applied_at\s+TIMESTAMPTZ/i);
    });

    it("includes a BEFORE UPDATE trigger maintaining updated_at", () => {
      expect(sql).toMatch(/CREATE\s+TRIGGER\s+event_change_log_updated_at/i);
      expect(sql).toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.update_event_change_log_updated_at/i,
      );
    });
  });

  describe("brief §6 — indexes (5 expected)", () => {
    it("creates idx_event_change_log_event_status_created", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_change_log_event_status_created[\s\S]*?ON\s+public\.event_change_log\(event_id,\s*status,\s*created_at\s+DESC\)/i,
      );
    });

    it("creates idx_event_change_log_observation", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_change_log_observation[\s\S]*?ON\s+public\.event_change_log\(observation_id\)/i,
      );
    });

    it("creates idx_event_change_log_source", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_change_log_source[\s\S]*?ON\s+public\.event_change_log\(source_id\)/i,
      );
    });

    it("creates idx_event_change_log_status_severity", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_change_log_status_severity[\s\S]*?ON\s+public\.event_change_log\(status,\s*change_severity\)/i,
      );
    });

    it("creates idx_event_change_log_pending_severity_created partial WHERE status = 'pending'", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_change_log_pending_severity_created[\s\S]*?WHERE\s+status\s*=\s*'pending'/i,
      );
    });

    it("does not create a covering composite (event_id, field_name, status) in 3c", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+INDEX[^;]*\(\s*event_id\s*,\s*field_name\s*,\s*status/i,
      );
    });

    it("does not create any GIN index", () => {
      expect(cleanSql).not.toMatch(/USING\s+GIN/i);
    });
  });

  describe("brief §5 — RLS posture", () => {
    it("ENABLE ROW LEVEL SECURITY is set", () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+public\.event_change_log\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      );
    });

    it("has admin SELECT policy via public.is_admin()", () => {
      expect(sql).toMatch(/CREATE\s+POLICY\s+event_change_log_admin_select/i);
      expect(sql).toMatch(/FOR\s+SELECT/i);
      expect(sql).toMatch(/USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
    });

    it("does not have an INSERT policy in 3c", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_change_log[\s\S]*?FOR\s+INSERT/i,
      );
    });

    it("does not have a DELETE policy in 3c", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_change_log[\s\S]*?FOR\s+DELETE/i,
      );
    });

    it("does not have a FOR ALL policy", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_change_log[\s\S]*?FOR\s+ALL/i,
      );
    });

    it("does not grant any privileges to anon", () => {
      expect(cleanSql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+anon\b/i);
    });

    it("grants ALL to service_role", () => {
      expect(sql).toMatch(
        /GRANT\s+ALL\s+ON\s+public\.event_change_log\s+TO\s+service_role/i,
      );
    });
  });

  describe("Guardrail C — policy-change-acknowledged header", () => {
    it("includes the REVIEWED header", () => {
      expect(sql).toMatch(/--\s*REVIEWED:\s*policy change acknowledged/i);
    });
  });

  describe("comments", () => {
    it("table comment names workflow-mutable proposed-change surface (not applied audit history)", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+TABLE\s+public\.event_change_log\s+IS/i,
      );
      expect(sql).toMatch(/Proposed-change workflow surface/i);
      expect(sql).toMatch(/NOT applied audit history/i);
      expect(sql).toMatch(/event_audit_log/i);
    });

    it("proposal_source column comment names COMMUNITY-CORRECTION-01 boundary", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+COLUMN\s+public\.event_change_log\.proposal_source\s+IS/i,
      );
      expect(sql).toMatch(/no value for "user direct write"/i);
      expect(sql).toMatch(/COMMUNITY-CORRECTION-01/i);
    });
  });

  describe("brief compliance — out-of-scope additions excluded", () => {
    it("does not declare any SECURITY DEFINER function", () => {
      expect(cleanSql).not.toMatch(/SECURITY\s+DEFINER/i);
    });

    it("does not create any view in 3c", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.event_change_log/i,
      );
      expect(cleanSql).not.toMatch(/security_invoker\s*=\s*true/i);
    });

    it("does not modify the events table or its verification columns", () => {
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE\s+(?:public\.)?events\b/i);
      expect(cleanSql).not.toMatch(/last_verified_at/i);
      expect(cleanSql).not.toMatch(/verified_by/i);
    });

    it("does not modify event_audit_log, event_sources, or event_source_observations", () => {
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE[^;]*event_audit_log/i);
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE[^;]*event_sources\b/i);
      expect(cleanSql).not.toMatch(
        /ALTER\s+TABLE[^;]*event_source_observations/i,
      );
    });

    it("does not create artist_claims or other sibling tables", () => {
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bartist_claims\b/i);
      expect(cleanSql).not.toMatch(
        /CREATE\s+TABLE[^;]*\bcommunity_correction_proposals\b/i,
      );
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bderivation_runs\b/i);
    });

    it("does not insert any seed rows", () => {
      expect(cleanSql).not.toMatch(/INSERT\s+INTO\s+public\.event_change_log/i);
    });
  });
});
