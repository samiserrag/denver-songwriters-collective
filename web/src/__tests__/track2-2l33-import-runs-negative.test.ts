import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md",
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md",
);
const IMPORT_RUN_ROUTE_PATHS = [
  join(WEB_SRC, "app/api/import-runs/route.ts"),
  join(WEB_SRC, "app/api/import-runs/[id]/route.ts"),
];

const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function rowFor(source: string, id: string): string {
  const row = source
    .split("\n")
    .find((line) => line.startsWith(`| ${id} |`));

  expect(row, `Missing row ${id}`).toBeDefined();
  return row ?? "";
}

describe("Track 2 2L.33 import runs BOLA planned gate", () => {
  it("keeps the future import-run routes absent until route-level BOLA tests replace this sentinel", () => {
    for (const routePath of IMPORT_RUN_ROUTE_PATHS) {
      expect(
        existsSync(routePath),
        "Implementing import runs requires replacing this planned-gate source-contract test with route-level negative tests",
      ).toBe(false);
    }
  });

  it("documents the matrix boundary for future import-run management", () => {
    const row = rowFor(matrixSource, "T2-BOLA-IMPORT-RUNS");

    expect(row).toContain("web/src/app/api/import-runs/[id]/route.ts");
    expect(row).toContain("web/src/app/api/import-runs/route.ts");
    expect(row).toContain("importRunId, sourceId, owner/org/venue IDs");
    expect(row).toContain("Owner/admin/service-worker scoping with active grants only");
    expect(row).toContain("path importRunId is authoritative");
    expect(row).toContain("source/org/venue ownership checks before reads, writes, or status transitions");
    expect(row).toContain("service-role use only after route-local authorization and validation");
    expect(row).toContain("review before event/venue/source-record writes");
    expect(row).toContain("no body ID trust");
    expect(row).toContain(
      "web/src/__tests__/track2-2l33-import-runs-negative.test.ts",
    );
  });

  it("pins the required future negative cases before import-run routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-IMPORT-RUNS");

    for (const expected of [
      "anonymous/non-auth denial",
      "Host A cannot read/write Host B import run",
      "org/venue scope denial",
      "revoked/inactive manager denial",
      "body importRunId/sourceId/owner IDs ignored for authorization",
      "source must belong to the run scope",
      "status transitions validate actor and current state before mutation",
      "service-worker identity explicit",
      "service-role/audit/fanout only after authorization and validation",
      "review required before downstream writes",
      "private fields/tokens absent",
      "route-level import-run tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as actor-scoped and status-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-IMPORT-RUNS");

    expect(row).toContain("web/src/app/api/import-runs/route.ts");
    expect(row).toContain("web/src/app/api/import-runs/[id]/route.ts");
    expect(row).toContain("Owner/host/org manager/admin/service worker depending on run scope");
    expect(row).toContain("active grants only");
    expect(row).toContain("checked before request parsing, import-run reads, or worker fanout");
    expect(row).toContain("path importRunId is authoritative");
    expect(row).toContain("body IDs are untrusted");
    expect(row).toContain("T2-BOLA-IMPORT-CANDIDATES");
    expect(row).toContain("service-role usage, if needed, only after route-local authorization");
    expect(row).toContain("status-transition validation");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("no direct trusted event mutation from imported or LLM-shaped data before review");
    expect(row).toContain("no raw bodies, secrets, tokens, or private rows");
    expect(row).toContain(
      "web/src/__tests__/track2-2l33-import-runs-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-IMPORT-RUNS");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
