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
const PERFORMER_PUBLIC_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/performers/[id]/route.ts",
);
const PERFORMER_ADMIN_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/admin/performers/[id]/route.ts",
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

describe("Track 2 2L.39 performers BOLA planned gate", () => {
  it("keeps planned performer routes absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(PERFORMER_PUBLIC_ROUTE_PATH),
      "Implementing public performer route requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
    expect(
      existsSync(PERFORMER_ADMIN_ROUTE_PATH),
      "Implementing admin performer route requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future performer reads and writes", () => {
    const row = rowFor(matrixSource, "T2-BOLA-PERFORMERS");

    expect(row).toContain("web/src/app/api/performers/[id]/route.ts");
    expect(row).toContain("web/src/app/api/admin/performers/[id]/route.ts");
    expect(row).toContain("performerId, event IDs, profile IDs, relationship IDs");
    expect(row).toContain("Public-safe performer reads only through allowlisted serializer");
    expect(row).toContain("path performerId is authoritative");
    expect(row).toContain("body/imported/LLM-shaped/event/profile/relationship IDs are untrusted until server-scoped");
    expect(row).toContain("linked event/profile relationships must validate before write");
    expect(row).toContain("draft/private/invite-only linked events absent from public output");
    expect(row).toContain("no service-role/admin-client usage in v1 without approved manifest update");
    expect(row).toContain("web/src/__tests__/track2-2l39-performers-negative.test.ts");
  });

  it("pins required future negative cases before performer routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-PERFORMERS");

    for (const expected of [
      "anonymous/non-auth write denial",
      "non-admin write denial",
      "cross-profile write denial",
      "relationship mismatch denial",
      "linked-event scope validation before association/write",
      "revoked/inactive owner-manager grant denial",
      "performerId/body ID trust denial",
      "private profile fields absent from public output",
      "stale/rejected/superseded relationship transition denial",
      "no fanout/email/audit/privileged side effect before authorization and validation",
      "no service-role/auth-admin creep",
      "route-level performer tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as public-safe, scoped, and write-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-PERFORMERS");

    expect(row).toContain("web/src/app/api/performers/[id]/route.ts");
    expect(row).toContain("web/src/app/api/admin/performers/[id]/route.ts");
    expect(row).toContain("Public read through public-safe serializer");
    expect(row).toContain("writes require authenticated site admin or active owner/approved self-service actor");
    expect(row).toContain("auth checked before request parsing, relationship resolution, write validation");
    expect(row).toContain("Path performerId is authoritative");
    expect(row).toContain("body/profile/event/relationship IDs are untrusted for authorization");
    expect(row).toContain("linked event/profile relationships must be scoped and validated before write");
    expect(row).toContain("draft/private/invite-only linked events are absent from public output");
    expect(row).toContain("no service-role usage without approved manifest update");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("audit/fanout only after authorized writes");
    expect(row).toContain("without private profile fields, emails, tokens, secrets, raw bodies, or private rows");
    expect(row).toContain("web/src/__tests__/track2-2l39-performers-negative.test.ts");
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-PERFORMERS");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
