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
const IMPORT_CANDIDATE_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/import-runs/[id]/candidates/[candidateId]/route.ts",
);

const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function rowFor(source: string, id: string): string {
  const row = source
    .split("\n")
    .find((line) => line.startsWith(`| ${id} |`));

  expect(row, `Missing row ${id}`).toBeDefined();
  return row ?? "";
}

describe("Track 2 2L.34 import candidates BOLA planned gate", () => {
  it("keeps the future import-candidate route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(IMPORT_CANDIDATE_ROUTE_PATH),
      "Implementing import candidates requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future import-candidate management", () => {
    const row = rowFor(matrixSource, "T2-BOLA-IMPORT-CANDIDATES");

    expect(row).toContain("web/src/app/api/import-runs/[id]/candidates/[candidateId]/route.ts");
    expect(row).toContain("importRunId, candidateId, matched event IDs");
    expect(row).toContain("Candidate belongs to path importRunId");
    expect(row).toContain("run belongs to actor scope with active grants only");
    expect(row).toContain("path importRunId is authoritative");
    expect(row).toContain("path candidateId is authoritative");
    expect(row).toContain("body IDs and imported/LLM-shaped matched event IDs are untrusted");
    expect(row).toContain("candidate status transitions validate actor");
    expect(row).toContain("matched event scope before writes");
    expect(row).toContain("writes route through approved event gates only");
    expect(row).toContain(
      "web/src/__tests__/track2-2l34-import-candidates-negative.test.ts",
    );
  });

  it("pins the required future negative cases before import-candidate routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-IMPORT-CANDIDATES");

    for (const expected of [
      "anonymous/non-auth denial",
      "Host A cannot read/write Host B candidate",
      "importRunId/candidateId mismatch denial",
      "matched event cross-owner denial",
      "body importRunId/candidateId/matched event IDs ignored for authorization",
      "revoked/inactive manager denial",
      "rejected/stale candidate transition denial",
      "review required before approved-event writes",
      "service-role/audit/fanout only after authorization and validation",
      "rejected candidate private data absent",
      "route-level import-candidate tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as candidate-scoped and matched-event-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-IMPORT-RUNS");

    expect(row).toContain("web/src/app/api/import-runs/[id]/candidates/[candidateId]/route.ts");
    expect(row).toContain("active grants only");
    expect(row).toContain("checked before request parsing, import-run reads, or worker fanout");
    expect(row).toContain("candidate reads also require the same gate");
    expect(row).toContain("path importRunId is authoritative");
    expect(row).toContain("path candidateId is authoritative");
    expect(row).toContain("body IDs are untrusted");
    expect(row).toContain("T2-BOLA-IMPORT-CANDIDATES");
    expect(row).toContain(
      "web/src/__tests__/track2-2l34-import-candidates-negative.test.ts",
    );
    expect(row).toContain("matched-event scope validation");
    expect(row).toContain("status-transition validation");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("no direct trusted event mutation from imported or LLM-shaped data before review");
    expect(row).toContain("candidateId");
    expect(row).toContain("no raw bodies, secrets, tokens, or private rows");
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
