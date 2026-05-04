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
const FESTIVAL_PUBLIC_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/festivals/[id]/route.ts",
);
const FESTIVAL_ADMIN_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/admin/festivals/[id]/route.ts",
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

describe("Track 2 2L.38 festivals BOLA planned gate", () => {
  it("keeps planned festival routes absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(FESTIVAL_PUBLIC_ROUTE_PATH),
      "Implementing public festival route requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
    expect(
      existsSync(FESTIVAL_ADMIN_ROUTE_PATH),
      "Implementing admin festival route requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future festival reads and writes", () => {
    const row = rowFor(matrixSource, "T2-BOLA-FESTIVALS");

    expect(row).toContain("web/src/app/api/festivals/[id]/route.ts");
    expect(row).toContain("web/src/app/api/admin/festivals/[id]/route.ts");
    expect(row).toContain("festivalId, parent org ID, event IDs");
    expect(row).toContain("Public-safe festival reads");
    expect(row).toContain("admin/owner writes per approved schema ADR");
    expect(row).toContain("path festivalId is authoritative");
    expect(row).toContain("body parent org/event IDs are untrusted until server-scoped");
    expect(row).toContain("parent org ownership requires active grants");
    expect(row).toContain("draft/private/invite-only linked events absent from public output");
    expect(row).toContain("public output allowlisted");
    expect(row).toContain("no service-role/admin-client usage in v1 without approved manifest update");
    expect(row).toContain(
      "web/src/__tests__/track2-2l38-festivals-negative.test.ts",
    );
  });

  it("pins required future negative cases before festival routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-FESTIVALS");

    for (const expected of [
      "anonymous/non-auth write denial",
      "non-admin write denial",
      "cross-org owner denial",
      "revoked/inactive org manager denial",
      "festivalId/body ID trust denial",
      "draft/private/invite-only linked events absent",
      "public serializer excludes private org/event/internal fields",
      "stale/rejected/superseded linkage transitions fail closed",
      "no fanout/email/audit/privileged side effect before authorization and validation",
      "no service-role/auth-admin creep",
      "route-level festival tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as public-safe, scoped, and write-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-FESTIVALS");

    expect(row).toContain("web/src/app/api/festivals/[id]/route.ts");
    expect(row).toContain("web/src/app/api/admin/festivals/[id]/route.ts");
    expect(row).toContain("Public reads only through public-safe serializer");
    expect(row).toContain("writes require authenticated site admin or owner/active parent-org manager");
    expect(row).toContain("auth checked before request parsing, linked-event resolution");
    expect(row).toContain("Path festivalId is authoritative");
    expect(row).toContain("body parent org/event IDs are untrusted for authorization");
    expect(row).toContain("parent org ownership requires active grants");
    expect(row).toContain("linked events must belong to the validated festival/org scope");
    expect(row).toContain("draft/private/invite-only linked events are absent from public output");
    expect(row).toContain("no service-role usage without approved manifest update");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("audit/fanout only after authorized writes");
    expect(row).toContain("without private org/event fields, tokens, secrets, raw bodies, or private rows");
    expect(row).toContain(
      "web/src/__tests__/track2-2l38-festivals-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-FESTIVALS");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
