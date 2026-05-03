/**
 * Lane 6 Step 3b — event_source_observations Migration (Content-Scan Tests)
 *
 * Static assertions over the migration SQL file. Verifies that the migration:
 *
 * - Creates public.event_source_observations with columns, defaults, CHECK
 *   enums, and FKs described in the Step 3b brief and decision memo.
 * - Implements memo Q1: event_id is NULLABLE with FK ON DELETE CASCADE +
 *   partial index on event_id IS NULL.
 * - Implements memo Q4: source_url is text NOT NULL per observation.
 * - Implements memo Q5: agent_run_id is uuid nullable, no FK, no CHECK in 3b.
 * - Implements memo Q6: created_by_role enum has no "user direct write"
 *   value; only crawler / admin_seed / concierge_extract /
 *   community_evidence_fetch are permitted.
 * - Implements memo Q7: RLS-deny posture only; no immutability trigger ships
 *   in 3b.
 * - Brief §3.6: only extracted_fields jsonb (no normalized_fields jsonb).
 * - Brief §3.7: no stored conflict or possible_cancellation flags.
 * - Brief §6: five required indexes (event+observed_at, source+observed_at,
 *   observation_type, partial unmatched, content_hash); no GIN; no covering
 *   composite.
 * - Brief §5: admin-read RLS only; no anon, authenticated, or admin
 *   INSERT/UPDATE/DELETE policies in 3b; service_role grant.
 * - Does not introduce SECURITY DEFINER, a public view, modifications to
 *   events.last_verified_at / events.verified_by, or sibling tables
 *   (event_change_log, artist_claims).
 *
 * Source: docs/investigation/source-observation-step-3b-observations-brief.md
 *         docs/investigation/source-observation-step-3b-open-questions-decision-memo.md
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

describe("Lane 6 Step 3b — event_source_observations migration", () => {
  const { filename, sql } = findMigration("event_source_observations");
  // SQL with comments stripped, for tests asserting on actual operations
  // (column types, FKs, INSERTs, ALTERs, etc.) rather than explanatory prose
  // in `-- ...` or `/* ... */` blocks. Matches the pr6-ci-guardrails pattern.
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
      expect(sql).toMatch(/source-observation-step-3b-observations-brief\.md/i);
      expect(sql).toMatch(
        /source-observation-step-3b-open-questions-decision-memo\.md/i,
      );
    });
  });

  describe("table creation", () => {
    it("creates public.event_source_observations", () => {
      expect(sql).toMatch(
        /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.event_source_observations/i,
      );
    });

    it("declares id as UUID primary key with gen_random_uuid default", () => {
      expect(sql).toMatch(
        /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
      );
    });

    it("declares NOT NULL on source_id, source_url, source_type, observation_type, observed_at, created_by_role, created_at", () => {
      expect(sql).toMatch(/source_id\s+UUID\s+NOT\s+NULL/i);
      expect(sql).toMatch(/source_url\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/source_type\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/observation_type\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/observed_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
      expect(sql).toMatch(/created_by_role\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    });

    it("observation_type CHECK includes the five enum values from the memo", () => {
      const types = ["found", "missing", "changed", "cancelled", "error"];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it("created_by_role CHECK includes the four sanctioned roles only", () => {
      const roles = [
        "crawler",
        "admin_seed",
        "concierge_extract",
        "community_evidence_fetch",
      ];
      for (const r of roles) {
        expect(sql).toContain(`'${r}'`);
      }
    });

    it("extraction_confidence and source_confidence have CHECK between 0 and 1", () => {
      expect(sql).toMatch(
        /extraction_confidence\s+NUMERIC\(4,3\)\s+CHECK\s*\(\s*extraction_confidence\s+BETWEEN\s+0\s+AND\s+1\s*\)/i,
      );
      expect(sql).toMatch(
        /source_confidence\s+NUMERIC\(4,3\)\s+CHECK\s*\(\s*source_confidence\s+BETWEEN\s+0\s+AND\s+1\s*\)/i,
      );
    });
  });

  describe("memo Q1 — event_id NULLABLE with FK ON DELETE CASCADE", () => {
    it("event_id column has no NOT NULL", () => {
      // Regex: "event_id UUID REFERENCES" (no NOT NULL between UUID and REFERENCES)
      expect(sql).toMatch(
        /event_id\s+UUID\s+REFERENCES\s+public\.events\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      );
      // Negative: should NOT have "event_id UUID NOT NULL"
      expect(sql).not.toMatch(/event_id\s+UUID\s+NOT\s+NULL/i);
    });

    it("partial index on event_id IS NULL exists", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_unmatched[\s\S]*?WHERE\s+event_id\s+IS\s+NULL/i,
      );
    });
  });

  describe("memo Q4 — source_url per observation", () => {
    it("source_url is text NOT NULL", () => {
      expect(sql).toMatch(/source_url\s+TEXT\s+NOT\s+NULL/i);
    });

    it("source_url is not declared UNIQUE", () => {
      expect(sql).not.toMatch(/source_url[^,\n]*\bUNIQUE\b/i);
      expect(sql).not.toMatch(
        /CREATE\s+UNIQUE\s+INDEX[^;]*\(\s*source_url\s*\)/i,
      );
    });
  });

  describe("memo Q5 — agent_run_id nullable, no FK, no CHECK in 3b", () => {
    it("agent_run_id is uuid nullable", () => {
      // The full pattern: agent_run_id UUID, (with no NOT NULL, REFERENCES, or CHECK)
      expect(sql).toMatch(/agent_run_id\s+UUID,/i);
    });

    it("agent_run_id has no FK", () => {
      expect(cleanSql).not.toMatch(/agent_run_id[^,\n]*REFERENCES/i);
    });

    it("agent_run_id has no CHECK constraint", () => {
      expect(cleanSql).not.toMatch(/agent_run_id[^,\n]*CHECK/i);
    });
  });

  describe("memo Q6 — created_by_role enum has no 'user direct write' value", () => {
    it("CHECK enum exhaustively lists only the four sanctioned roles", () => {
      // Capture the IN-list for created_by_role
      const match = sql.match(
        /created_by_role\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'crawler'\s+CHECK\s*\(\s*created_by_role\s+IN\s*\(([^)]+)\)/is,
      );
      expect(match).not.toBeNull();
      const inList = (match?.[1] ?? "")
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""))
        .filter(Boolean);
      expect(inList.sort()).toEqual(
        ["admin_seed", "community_evidence_fetch", "concierge_extract", "crawler"].sort(),
      );
    });

    it("no 'user_direct' or similar value is present in the enum", () => {
      // Specifically forbid any user-direct-write style enum value.
      const forbidden = [
        "user_direct",
        "user_write",
        "user_correction",
        "direct_correction",
        "user_submitted",
      ];
      for (const v of forbidden) {
        expect(sql).not.toContain(`'${v}'`);
      }
    });

    it("default created_by_role is 'crawler'", () => {
      expect(sql).toMatch(
        /created_by_role\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'crawler'/i,
      );
    });

    it("created_by FK is to public.profiles ON DELETE SET NULL (nullable)", () => {
      expect(sql).toMatch(
        /created_by\s+UUID\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
    });
  });

  describe("memo Q7 — RLS-deny posture, no immutability trigger in 3b", () => {
    it("ENABLE ROW LEVEL SECURITY is set", () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+public\.event_source_observations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      );
    });

    it("admin SELECT policy uses public.is_admin()", () => {
      expect(sql).toMatch(
        /CREATE\s+POLICY\s+event_source_observations_admin_select/i,
      );
      expect(sql).toMatch(/FOR\s+SELECT/i);
      expect(sql).toMatch(/USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
    });

    it("no INSERT policy ships in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_source_observations[\s\S]*?FOR\s+INSERT/i,
      );
    });

    it("no UPDATE policy ships in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_source_observations[\s\S]*?FOR\s+UPDATE/i,
      );
    });

    it("no DELETE policy ships in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_source_observations[\s\S]*?FOR\s+DELETE/i,
      );
    });

    it("no FOR ALL policy ships (would over-grant)", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+POLICY[^\n]+ON\s+public\.event_source_observations[\s\S]*?FOR\s+ALL/i,
      );
    });

    it("no immutability trigger ships in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+TRIGGER[^\n]*event_source_observations/i,
      );
      expect(cleanSql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[^\n]*(immutable|prevent_update|enforce_append_only)/i,
      );
    });

    it("does not grant SELECT/INSERT/UPDATE/DELETE to anon", () => {
      expect(cleanSql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+anon\b/i);
    });

    it("does not grant SELECT/INSERT/UPDATE/DELETE to authenticated", () => {
      expect(cleanSql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+authenticated\b/i);
    });

    it("grants ALL to service_role", () => {
      expect(sql).toMatch(
        /GRANT\s+ALL\s+ON\s+public\.event_source_observations\s+TO\s+service_role/i,
      );
    });
  });

  describe("brief §3.6 — only extracted_fields jsonb (no normalized_fields)", () => {
    it("declares extracted_fields jsonb", () => {
      expect(sql).toMatch(/extracted_fields\s+JSONB/i);
    });

    it("does not declare normalized_fields", () => {
      expect(cleanSql).not.toMatch(/normalized_fields/i);
    });
  });

  describe("brief §3.7 — no stored conflict or possible_cancellation flags", () => {
    it("does not declare a conflict_flag column", () => {
      expect(cleanSql).not.toMatch(/conflict_flag/i);
      expect(cleanSql).not.toMatch(/has_conflict/i);
    });

    it("does not declare a possible_cancellation column", () => {
      expect(cleanSql).not.toMatch(/possible_cancellation\s+BOOLEAN/i);
      expect(cleanSql).not.toMatch(/possible_cancellation\s+(BOOL|TEXT|INTEGER)/i);
    });
  });

  describe("brief §6 — indexes", () => {
    it("creates idx_event_source_observations_event_observed (event_id, observed_at DESC)", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_event_observed[\s\n]+ON\s+public\.event_source_observations\(event_id,\s*observed_at\s+DESC\)/i,
      );
    });

    it("creates idx_event_source_observations_source_observed (source_id, observed_at DESC)", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_source_observed[\s\n]+ON\s+public\.event_source_observations\(source_id,\s*observed_at\s+DESC\)/i,
      );
    });

    it("creates idx_event_source_observations_observation_type", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_observation_type[\s\n]+ON\s+public\.event_source_observations\(observation_type\)/i,
      );
    });

    it("creates idx_event_source_observations_unmatched partial WHERE event_id IS NULL", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_unmatched[\s\S]*?WHERE\s+event_id\s+IS\s+NULL/i,
      );
    });

    it("creates idx_event_source_observations_content_hash", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_source_observations_content_hash[\s\n]+ON\s+public\.event_source_observations\(content_hash\)/i,
      );
    });

    it("does not create a GIN index on extracted_fields in 3b", () => {
      expect(cleanSql).not.toMatch(/USING\s+GIN[\s\S]*?extracted_fields/i);
    });

    it("does not create a covering composite (event_id, observation_type, observed_at) in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+INDEX[^;]*\(\s*event_id\s*,\s*observation_type\s*,\s*observed_at/i,
      );
    });
  });

  describe("Guardrail C — policy-change-acknowledged header", () => {
    it("includes the REVIEWED header", () => {
      expect(sql).toMatch(/--\s*REVIEWED:\s*policy change acknowledged/i);
    });
  });

  describe("comments", () => {
    it("table comment names append-only evidence ledger and Deduper UPDATE carve-out", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+TABLE\s+public\.event_source_observations\s+IS/i,
      );
      expect(sql).toMatch(/append-only evidence ledger/i);
      expect(sql).toMatch(/Deduper sets event_id later via service_role/i);
    });

    it("created_by_role column comment names the COMMUNITY-CORRECTION-01 boundary", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+COLUMN\s+public\.event_source_observations\.created_by_role\s+IS/i,
      );
      expect(sql).toMatch(/no value for "user direct write"/i);
      expect(sql).toMatch(/COMMUNITY-CORRECTION-01/i);
    });

    it("event_id column comment names the Deduper UPDATE NULL -> uuid carve-out", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+COLUMN\s+public\.event_source_observations\.event_id\s+IS/i,
      );
      expect(sql).toMatch(/UPDATE NULL -> uuid/i);
    });
  });

  describe("brief compliance — out-of-scope additions excluded", () => {
    it("does not declare any SECURITY DEFINER function", () => {
      expect(cleanSql).not.toMatch(/SECURITY\s+DEFINER/i);
    });

    it("does not create any view in 3b", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.event_source_observations/i,
      );
      expect(cleanSql).not.toMatch(/security_invoker\s*=\s*true/i);
    });

    it("does not modify the events table or its verification columns", () => {
      // Stripped SQL — comments may legitimately mention these names.
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE\s+(?:public\.)?events\b/i);
      expect(cleanSql).not.toMatch(/last_verified_at/i);
      expect(cleanSql).not.toMatch(/verified_by/i);
    });

    it("does not modify event_audit_log or event_sources", () => {
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE[^;]*event_audit_log/i);
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE[^;]*event_sources/i);
    });

    it("does not create event_change_log, artist_claims, or event_sources_public", () => {
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bevent_change_log\b/i);
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bartist_claims\b/i);
      expect(cleanSql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW[^;]*\bevent_sources_public\b/i,
      );
    });

    it("does not insert any seed rows", () => {
      expect(cleanSql).not.toMatch(
        /INSERT\s+INTO\s+public\.event_source_observations/i,
      );
    });

    it("does not create partitions", () => {
      expect(cleanSql).not.toMatch(/PARTITION\s+(BY|OF)/i);
    });
  });

  describe("FK references", () => {
    it("source_id references public.event_sources(id) ON DELETE RESTRICT", () => {
      expect(sql).toMatch(
        /source_id\s+UUID\s+NOT\s+NULL\s+REFERENCES\s+public\.event_sources\(id\)\s+ON\s+DELETE\s+RESTRICT/i,
      );
    });

    it("event_id references public.events(id) ON DELETE CASCADE", () => {
      expect(sql).toMatch(
        /event_id\s+UUID\s+REFERENCES\s+public\.events\(id\)\s+ON\s+DELETE\s+CASCADE/i,
      );
    });

    it("created_by references public.profiles(id) ON DELETE SET NULL", () => {
      expect(sql).toMatch(
        /created_by\s+UUID\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
    });
  });
});
