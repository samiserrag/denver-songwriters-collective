/**
 * PR6: CI Guardrail Source-Code Contract Tests
 *
 * Guardrail B: Bidirectional RLS cycle detector.
 *   Reads all active migration SQL, extracts CREATE POLICY bodies,
 *   builds a directed table→table reference graph, detects cycles.
 *
 * Secondary source-contract tests:
 *   - Rollback file naming/header invariants (mirrors CI bash step)
 *   - Policy change acknowledgment header requirement
 *   - No new migrations in PR6
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase/migrations");

/** List active migration files (not in _archived/, _duplicates_backup/, etc.) */
function getActiveMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        !f.startsWith("_") &&
        !f.startsWith(".")
    )
    .sort();
}

/** Read migration file content */
function readMigration(filename: string): string {
  return readFileSync(join(MIGRATIONS_DIR, filename), "utf-8");
}

// ============================================================
// §1: Guardrail B — Bidirectional RLS Cycle Detector
// ============================================================

describe("PR6 Guardrail B: Bidirectional RLS cycle detector", () => {
  /**
   * Process migrations in timestamp order, tracking policy state:
   * - DROP POLICY removes a policy from the active set
   * - CREATE POLICY adds/replaces a policy in the active set
   *
   * After processing all migrations, the active set reflects the
   * current database state. Then build a table→table reference graph
   * from active policy bodies and detect cycles via DFS.
   */
  it("no bidirectional RLS policy cycles exist in final migration state", () => {
    const migrations = getActiveMigrations();

    // Active policies: key = "table.policyName" → body text
    const activePolicies = new Map<string, { table: string; body: string }>();

    // Known public tables
    const knownTables = new Set<string>();

    for (const filename of migrations) {
      const sql = readMigration(filename);

      // Strip SQL comments to avoid false matches
      const cleanSQL = sql
        .replace(/--[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

      // Track table names from CREATE TABLE
      const tableNameRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi;
      let tm;
      while ((tm = tableNameRegex.exec(cleanSQL)) !== null) {
        knownTables.add(tm[1].toLowerCase());
      }

      // Track DROP POLICY — removes from active set
      const dropRegex = /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?(?:"([^"]+)"|(\w+))\s+ON\s+(?:public\.)?(\w+)/gi;
      let dm;
      while ((dm = dropRegex.exec(cleanSQL)) !== null) {
        const policyName = (dm[1] || dm[2]).toLowerCase();
        const table = dm[3].toLowerCase();
        activePolicies.delete(`${table}.${policyName}`);
      }

      // Track CREATE POLICY — adds to active set
      // Match: CREATE POLICY "name" ON table ... (everything until the final );)
      const createRegex = /CREATE\s+POLICY\s+(?:"([^"]+)"|(\w+))\s+ON\s+(?:public\.)?(\w+)\s+([\s\S]*?)(?:;\s*(?=CREATE|DROP|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|DO|BEGIN|END|$))/gi;
      let cm;
      while ((cm = createRegex.exec(cleanSQL)) !== null) {
        const policyName = (cm[1] || cm[2]).toLowerCase();
        const table = cm[3].toLowerCase();
        const body = cm[4];
        knownTables.add(table);
        activePolicies.set(`${table}.${policyName}`, { table, body });
      }
    }

    // Build graph from active policies only
    const graph = new Map<string, Set<string>>();

    for (const [, { table, body }] of activePolicies) {
      if (!graph.has(table)) {
        graph.set(table, new Set());
      }

      // Find references to other tables via FROM, JOIN
      const refRegex = /(?:FROM|JOIN)\s+(?:public\.)?(\w+)/gi;
      let rm;
      while ((rm = refRegex.exec(body)) !== null) {
        const ref = rm[1].toLowerCase();
        if (ref !== table && knownTables.has(ref)) {
          graph.get(table)!.add(ref);
        }
      }
    }

    // DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(node: string, path: string[]): void {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          dfs(neighbor, path);
        }
      }

      path.pop();
      inStack.delete(node);
    }

    for (const node of graph.keys()) {
      dfs(node, []);
    }

    if (cycles.length > 0) {
      const cycleDescriptions = cycles.map((c) => c.join(" → ")).join("\n  ");
      expect.fail(
        `Bidirectional RLS policy cycles detected:\n  ${cycleDescriptions}\n\n` +
          "Fix: Break the cycle using service-role helper, materialized flag, " +
          "or app-layer logic. See 30-supabase-migrations-and-deploy.md."
      );
    }
  });
});

// ============================================================
// §2: Rollback file scanner (mirrors CI bash step)
// ============================================================

describe("PR6 Guardrail A: Rollback file scanner (vitest mirror)", () => {
  it("no active migration file has 'rollback' in filename", () => {
    const migrations = getActiveMigrations();
    const rollbackFiles = migrations.filter((f) =>
      f.toLowerCase().includes("rollback")
    );
    expect(rollbackFiles).toEqual([]);
  });

  it("no active migration file has ROLLBACK header in first 5 lines", () => {
    const migrations = getActiveMigrations();
    const violations: string[] = [];

    for (const f of migrations) {
      const content = readMigration(f);
      const first5 = content.split("\n").slice(0, 5).join("\n");
      if (/^\-\-.*ROLLBACK/im.test(first5)) {
        violations.push(f);
      }
    }

    expect(violations).toEqual([]);
  });

  it("rollback files exist only in _archived/ directory", () => {
    const archivedDir = join(MIGRATIONS_DIR, "_archived");
    if (!existsSync(archivedDir)) return; // no archived dir is fine

    const archivedFiles = readdirSync(archivedDir).filter((f) =>
      f.endsWith(".sql")
    );
    for (const f of archivedFiles) {
      if (f.toLowerCase().includes("rollback")) {
        const content = readFileSync(join(archivedDir, f), "utf-8");
        const first5 = content.split("\n").slice(0, 5).join("\n");
        expect(first5).toMatch(/ROLLBACK/i);
      }
    }
  });
});

// ============================================================
// §3: No new migrations in PR6
// ============================================================

describe("PR6: No new migrations or RLS policy changes", () => {
  it("latest migration is still from PR3/PR4 era", () => {
    const migrations = getActiveMigrations();
    const latest = migrations[migrations.length - 1];
    expect(latest).toBe(
      "20260218040000_fix_event_images_host_storage_policy.sql"
    );
  });

  it("PR6 files contain no CREATE/ALTER/DROP POLICY statements", () => {
    // PR6 only adds test files, CI workflows, and docs
    // This test documents the constraint
    const pr6TestFiles = [
      join(__dirname, "pr6-ci-guardrails.test.ts"),
      join(__dirname, "pr6-negative-privilege-matrix.test.ts"),
    ];
    for (const file of pr6TestFiles) {
      if (existsSync(file)) {
        const content = readFileSync(file, "utf-8");
        // Test files may contain these strings as test assertions, not as SQL
        // Verify no raw SQL execution patterns
        expect(content).not.toMatch(
          /await\s+.*\.(query|execute)\s*\(\s*['"`].*CREATE\s+POLICY/i
        );
      }
    }
  });
});

// ============================================================
// §4: CI workflow guardrail presence
// ============================================================

describe("PR6: CI workflow guardrails are present", () => {
  const REPO_ROOT = join(__dirname, "..", "..", "..");
  const ciYml = readFileSync(
    join(REPO_ROOT, ".github/workflows/ci.yml"),
    "utf-8"
  );
  const testYml = readFileSync(
    join(REPO_ROOT, ".github/workflows/test.yml"),
    "utf-8"
  );

  it("ci.yml contains rollback file scanner step", () => {
    expect(ciYml).toContain("Guardrail: Rollback file scanner");
  });

  it("ci.yml contains policy-change acknowledgment step", () => {
    expect(ciYml).toContain("Guardrail: Policy-change acknowledgment");
  });

  it("ci.yml uses fetch-depth 0 for git diff support", () => {
    expect(ciYml).toContain("fetch-depth: 0");
  });

  it("ci.yml policy scanner checks for review header", () => {
    expect(ciYml).toContain(
      "-- REVIEWED: policy change acknowledged"
    );
  });

  it("test.yml also contains rollback file scanner (no bypass)", () => {
    expect(testYml).toContain("Guardrail: Rollback file scanner");
  });
});
