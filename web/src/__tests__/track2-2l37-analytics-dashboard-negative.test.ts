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
const ANALYTICS_DASHBOARD_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/analytics/dashboard/route.ts",
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

describe("Track 2 2L.37 analytics dashboard BOLA planned gate", () => {
  it("keeps the future analytics-dashboard route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(ANALYTICS_DASHBOARD_ROUTE_PATH),
      "Implementing analytics dashboard requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future analytics dashboard reads", () => {
    const row = rowFor(matrixSource, "T2-BOLA-ANALYTICS-DASHBOARD");

    expect(row).toContain("web/src/app/api/analytics/dashboard/route.ts");
    expect(row).toContain("event IDs, org IDs, venue IDs, filters");
    expect(row).toContain("Authorized admin/host/org/venue manager only with active grants");
    expect(row).toContain("query/body event/org/venue/filter IDs are untrusted until scoped");
    expect(row).toContain("aggregate-only output");
    expect(row).toContain("small-count suppression n >= 10 before serialization");
    expect(row).toContain("raw/per-user/session/visitor rows absent");
    expect(row).toContain("bot/internal/AI-crawler metrics separated from human metrics");
    expect(row).toContain("no service-role/admin-client usage in v1 without approved manifest update");
    expect(row).toContain(
      "web/src/__tests__/track2-2l37-analytics-dashboard-negative.test.ts",
    );
  });

  it("pins required future negative cases before analytics dashboard can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-ANALYTICS-DASHBOARD");

    for (const expected of [
      "anonymous/non-auth denial",
      "non-admin/unauthorized dashboard denial",
      "host/org/venue cross-scope filter denial",
      "revoked/inactive manager denial",
      "query/body event/org/venue/filter IDs ignored until scope validation",
      "aggregate-only output",
      "raw/user-level/session/visitor data absent",
      "small-count suppression n >= 10 before serialization",
      "bot/internal/AI-crawler breakdowns separated from human metrics",
      "no fanout/email/audit/privileged side effect before authorization and validation",
      "no service-role/auth-admin creep",
      "route-level analytics-dashboard tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as scoped, aggregate-only, and suppression-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-ANALYTICS-DASHBOARD");

    expect(row).toContain("web/src/app/api/analytics/dashboard/route.ts");
    expect(row).toContain("Authorized admin/host/org/venue manager per resource scope");
    expect(row).toContain("active grants only");
    expect(row).toContain("auth checked before request parsing, filter resolution, aggregate reads");
    expect(row).toContain("Dashboard filters must map to actor-owned event/org/venue scope");
    expect(row).toContain("query/body event/org/venue/filter IDs are untrusted for authorization");
    expect(row).toContain("small-count suppression default n >= 10 before serialization");
    expect(row).toContain("raw/per-user/session/visitor rows are not exposed");
    expect(row).toContain("analytics aggregates only");
    expect(row).toContain("raw events not exposed to the dashboard");
    expect(row).toContain("service-role usage, if needed, only after route-local authorization");
    expect(row).toContain("suppression validation");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("no individual behavior dashboard, data sale, retargeting, demographic profiling");
    expect(row).toContain("without leaking small counts, PII, tokens, raw IPs");
    expect(row).toContain(
      "web/src/__tests__/track2-2l37-analytics-dashboard-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-ANALYTICS-DASHBOARD");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
