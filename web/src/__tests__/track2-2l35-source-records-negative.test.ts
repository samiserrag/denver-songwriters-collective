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
const SOURCE_RECORD_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/source-records/[id]/route.ts",
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

describe("Track 2 2L.35 source records BOLA planned gate", () => {
  it("keeps the future source-record route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(SOURCE_RECORD_ROUTE_PATH),
      "Implementing source records requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future source-record management", () => {
    const row = rowFor(matrixSource, "T2-BOLA-SOURCE-RECORDS");

    expect(row).toContain("web/src/app/api/source-records/[id]/route.ts");
    expect(row).toContain("sourceRecordId, event/venue/org IDs");
    expect(row).toContain("Source records scoped to owning resource and actor with active grants only");
    expect(row).toContain("path sourceRecordId is authoritative");
    expect(row).toContain("body/imported/LLM-shaped resource IDs are untrusted");
    expect(row).toContain("event/venue/org ownership checks before reads, writes, status transitions");
    expect(row).toContain("public citation promotion");
    expect(row).toContain("audit, fanout, or service-role use");
    expect(row).toContain("public citation output allowlisted");
    expect(row).toContain(
      "web/src/__tests__/track2-2l35-source-records-negative.test.ts",
    );
  });

  it("pins the required future negative cases before source-record routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-SOURCE-RECORDS");

    for (const expected of [
      "anonymous/non-auth denial",
      "unrelated user denied",
      "source for Event A cannot read/write Event B",
      "source for private/draft/invite-only event not public",
      "sourceRecordId/resource mismatch denial",
      "revoked/inactive manager denial",
      "body event/venue/org IDs ignored for authorization",
      "stale/rejected/superseded source transitions fail closed",
      "public citation serializer excludes private fields/tokens/raw bodies",
      "service-worker identity explicit",
      "service-role/audit/fanout only after authorization and validation",
      "route-level source-record tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as source-scoped and citation-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-SOURCE-RECORDS");

    expect(row).toContain("web/src/app/api/source-records/[id]/route.ts");
    expect(row).toContain("Owner/admin/service worker");
    expect(row).toContain("active grants only");
    expect(row).toContain("public only through citation-safe serializer");
    expect(row).toContain("checked before request parsing, source-record reads");
    expect(row).toContain("citation promotion, audit, fanout, or service-role use");
    expect(row).toContain("path sourceRecordId is authoritative");
    expect(row).toContain("body/imported/LLM-shaped event/venue/org IDs are untrusted");
    expect(row).toContain("private/draft/invite-only event sources are not public by default");
    expect(row).toContain("service-role usage, if needed, only after route-local authorization");
    expect(row).toContain("public-citation allowlist validation");
    expect(row).toContain("status-transition validation");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("no trusted event mutation from fetched/imported/LLM-shaped text before review");
    expect(row).toContain("no raw bodies, secrets, tokens, or private rows");
    expect(row).toContain(
      "web/src/__tests__/track2-2l35-source-records-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-SOURCE-RECORDS");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
