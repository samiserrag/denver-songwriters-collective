/**
 * Lane 6 Step 3a — event_sources Registry Migration (Content-Scan Tests)
 *
 * Static assertions over the migration SQL file. Verifies that the migration:
 *
 * - Creates public.event_sources with the columns, defaults, CHECK enums, and
 *   FK ON DELETE SET NULL constraints described in the Step 3a brief.
 * - Adds the three indexes required by the brief.
 * - Enables RLS and ships an admin-only FOR ALL policy via public.is_admin().
 * - Does not grant SELECT to anon or authenticated (no readers exist in 3a).
 * - Includes the Guardrail C policy-change-acknowledged header.
 * - Includes the table comment disambiguating registry vs per-fetch
 *   observations, and the column comment marking claim_status inert until
 *   the maintenance trigger ships in step 3e.
 * - Honors the decision-memo Q2/Q4 outcomes (no UNIQUE on URL columns;
 *   claim_status default 'unclaimed' with trigger deferred).
 * - Does not introduce SECURITY DEFINER, a SECURITY INVOKER public view,
 *   modifications to events.last_verified_at / events.verified_by, or any
 *   sibling tables (event_source_observations, event_change_log,
 *   artist_claims).
 *
 * Source: docs/investigation/source-observation-step-3a-migration-brief.md
 *
 * No production verification behavior changes. last_verified_at remains the
 * only active rule. SOURCE-OBS-01 stays Draft / Proposed / Not Active.
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

describe("Lane 6 Step 3a — event_sources registry migration", () => {
  const { filename, sql } = findMigration("event_sources_registry");
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

    it("file header cites the brief", () => {
      expect(sql).toMatch(/source-observation-step-3a-migration-brief\.md/i);
    });
  });

  describe("table creation", () => {
    it("creates public.event_sources", () => {
      expect(sql).toMatch(
        /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.event_sources/i,
      );
    });

    it("declares id as UUID primary key with gen_random_uuid default", () => {
      expect(sql).toMatch(
        /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i,
      );
    });

    it("declares NOT NULL on type, risk_tier, display_name, default_cadence_minutes, claim_status, created_at, updated_at", () => {
      expect(sql).toMatch(/type\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/risk_tier\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/display_name\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/default_cadence_minutes\s+INTEGER\s+NOT\s+NULL/i);
      expect(sql).toMatch(/claim_status\s+TEXT\s+NOT\s+NULL/i);
      expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
      expect(sql).toMatch(/updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL/i);
    });

    it("type CHECK includes every source-type enum value from the brief", () => {
      const types = [
        "claimed_feed",
        "first_party_site",
        "first_party_calendar",
        "civic_calendar",
        "nonprofit_calendar",
        "aggregator_public",
        "ticket_page",
        "community_submission",
        "concierge_created",
      ];
      for (const t of types) {
        expect(sql).toContain(`'${t}'`);
      }
    });

    it("risk_tier CHECK covers tiers A through F", () => {
      for (const tier of ["A", "B", "C", "D", "E", "F"]) {
        expect(sql).toMatch(new RegExp(`'${tier}'`));
      }
    });

    it("claim_status CHECK includes all four states", () => {
      const states = [
        "unclaimed",
        "claimed_by_venue",
        "claimed_by_artist",
        "claimed_by_organization",
      ];
      for (const s of states) {
        expect(sql).toContain(`'${s}'`);
      }
    });

    it("FK columns reference venues, organizations, profiles ON DELETE SET NULL", () => {
      expect(sql).toMatch(
        /claimed_by_venue_id\s+UUID\s+REFERENCES\s+public\.venues\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
      expect(sql).toMatch(
        /claimed_by_organization_id\s+UUID\s+REFERENCES\s+public\.organizations\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
      expect(sql).toMatch(
        /claimed_by_artist_id\s+UUID\s+REFERENCES\s+public\.profiles\(id\)\s+ON\s+DELETE\s+SET\s+NULL/i,
      );
    });
  });

  describe("decision-memo Q2 — no UNIQUE on URL columns", () => {
    it("does not declare UNIQUE on homepage_url", () => {
      expect(sql).not.toMatch(/homepage_url[^,\n]*\bUNIQUE\b/i);
      expect(sql).not.toMatch(/UNIQUE[^,\n]*homepage_url/i);
      expect(sql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX[^;]*\(\s*homepage_url\s*\)/i);
    });

    it("does not declare UNIQUE on feed_url", () => {
      expect(sql).not.toMatch(/feed_url[^,\n]*\bUNIQUE\b/i);
      expect(sql).not.toMatch(/UNIQUE[^,\n]*feed_url/i);
      expect(sql).not.toMatch(/CREATE\s+UNIQUE\s+INDEX[^;]*\(\s*feed_url\s*\)/i);
    });
  });

  describe("decision-memo Q4 — claim_status default + trigger deferred", () => {
    it("claim_status default is 'unclaimed'", () => {
      expect(sql).toMatch(/claim_status[^,\n]*DEFAULT\s+'unclaimed'/i);
    });

    it("does not add a claim_status maintenance trigger", () => {
      expect(sql).not.toMatch(/CREATE\s+TRIGGER[^\n]*claim_status/i);
      expect(sql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION[^\n]*(refresh_claim_status|sync_claim_status|maintain_claim_status|claim_status_sync|update_event_sources_claim_status)/i,
      );
    });

    it("only adds the updated_at maintenance trigger", () => {
      expect(sql).toMatch(/CREATE\s+TRIGGER\s+event_sources_updated_at/i);
    });
  });

  describe("indexes (brief §4.2)", () => {
    it("creates idx_event_sources_type on (type)", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_sources_type[\s\n]+ON\s+public\.event_sources\(type\)/i,
      );
    });

    it("creates idx_event_sources_risk_tier on (risk_tier)", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_sources_risk_tier[\s\n]+ON\s+public\.event_sources\(risk_tier\)/i,
      );
    });

    it("creates idx_event_sources_claim_status on (claim_status)", () => {
      expect(sql).toMatch(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_event_sources_claim_status[\s\n]+ON\s+public\.event_sources\(claim_status\)/i,
      );
    });
  });

  describe("RLS posture (brief §5)", () => {
    it("enables row level security on public.event_sources", () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+public\.event_sources\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
      );
    });

    it("includes admin-only FOR ALL policy via public.is_admin()", () => {
      expect(sql).toMatch(/CREATE\s+POLICY\s+event_sources_admin_all/i);
      expect(sql).toMatch(/FOR\s+ALL/i);
      expect(sql).toMatch(/USING\s*\(\s*public\.is_admin\(\)\s*\)/i);
      expect(sql).toMatch(/WITH\s+CHECK\s*\(\s*public\.is_admin\(\)\s*\)/i);
    });

    it("does not grant any privileges to anon (no reader exists in 3a)", () => {
      expect(sql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+anon\b/i);
    });

    it("does not grant any privileges to authenticated (admin uses RLS, not GRANT)", () => {
      expect(sql).not.toMatch(/GRANT\b[\s\S]*?\bTO\s+authenticated\b/i);
    });

    it("grants ALL on public.event_sources to service_role", () => {
      expect(sql).toMatch(
        /GRANT\s+ALL\s+ON\s+public\.event_sources\s+TO\s+service_role/i,
      );
    });
  });

  describe("Guardrail C — policy-change-acknowledged header", () => {
    it("includes the REVIEWED header (file scan would otherwise fail in CI)", () => {
      expect(sql).toMatch(/--\s*REVIEWED:\s*policy change acknowledged/i);
    });
  });

  describe("comments", () => {
    it("table comment names registry vs per-fetch observations", () => {
      expect(sql).toMatch(/COMMENT\s+ON\s+TABLE\s+public\.event_sources\s+IS/i);
      expect(sql).toMatch(/Registry of external data sources/);
      expect(sql).toMatch(/event_source_observations/);
      expect(sql).toMatch(/maintenance trigger ships in step 3e/);
    });

    it("claim_status column comment marks it inert until trigger ships", () => {
      expect(sql).toMatch(
        /COMMENT\s+ON\s+COLUMN\s+public\.event_sources\.claim_status\s+IS/i,
      );
      expect(sql).toMatch(/inert until the maintenance trigger ships in step 3e/i);
    });
  });

  describe("brief compliance — out-of-scope additions excluded", () => {
    it("does not declare any SECURITY DEFINER function", () => {
      expect(sql).not.toMatch(/SECURITY\s+DEFINER/i);
    });

    it("does not create the SECURITY INVOKER public view in 3a", () => {
      expect(sql).not.toMatch(
        /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.event_sources_public/i,
      );
      expect(sql).not.toMatch(/security_invoker\s*=\s*true/i);
    });

    it("does not modify the events table or its verification columns", () => {
      // Use stripped SQL — the migration's header comment legitimately
      // mentions last_verified_at while asserting it remains unchanged.
      expect(cleanSql).not.toMatch(/ALTER\s+TABLE\s+(?:public\.)?events\b/i);
      expect(cleanSql).not.toMatch(/last_verified_at/i);
      expect(cleanSql).not.toMatch(/verified_by/i);
    });

    it("does not create event_source_observations or event_change_log tables", () => {
      expect(cleanSql).not.toMatch(
        /CREATE\s+TABLE[^;]*\bevent_source_observations\b/i,
      );
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bevent_change_log\b/i);
    });

    it("does not create an artist_claims table", () => {
      expect(cleanSql).not.toMatch(/CREATE\s+TABLE[^;]*\bartist_claims\b/i);
    });

    it("does not insert any seed rows", () => {
      expect(cleanSql).not.toMatch(/INSERT\s+INTO\s+public\.event_sources/i);
    });
  });
});
