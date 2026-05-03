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
const PUBLIC_EVENTS_JSON_ROUTE_PATHS = [
  join(WEB_SRC, "app/events.json/route.ts"),
  join(WEB_SRC, "app/api/events.json/route.ts"),
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

describe("Track 2 2L.29 public events JSON BOLA planned gate", () => {
  it("keeps the future public events JSON routes absent until route-level BOLA tests replace this sentinel", () => {
    for (const routePath of PUBLIC_EVENTS_JSON_ROUTE_PATHS) {
      expect(
        existsSync(routePath),
        "Implementing /events.json requires replacing this planned-gate source-contract test with route-level negative tests",
      ).toBe(false);
    }
  });

  it("documents the matrix boundary for future public events JSON", () => {
    const row = rowFor(matrixSource, "T2-BOLA-PUBLIC-EVENTS-JSON");

    expect(row).toContain("web/src/app/events.json/route.ts");
    expect(row).toContain("web/src/app/api/events.json/route.ts");
    expect(row).toContain("query pagination/cursor/filter IDs");
    expect(row).toContain("Schema-driven public serializer");
    expect(row).toContain("anonymous read only");
    expect(row).toContain("rate limit");
    expect(row).toContain("cache policy");
    expect(row).toContain("crawler policy");
    expect(row).toContain("no service-role/admin-client usage in v1");
    expect(row).toContain(
      "web/src/__tests__/track2-2l29-public-events-json-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the planned routes can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-PUBLIC-EVENTS-JSON");

    for (const expected of [
      "draft/invite-only/private events absent",
      "private host notes/emails/analytics/internal IDs absent",
      "pagination/cursor/filter IDs validated before query shaping",
      "cancelled semantics explicit",
      "stable public IDs and canonical URLs only",
      "crawler/rate/cache policy required",
      "no write/fanout/privileged side effect",
      "private fields absent",
      "route-level negative tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as public serializer only", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-PUBLIC-EVENTS-JSON");

    expect(row).toContain("web/src/app/events.json/route.ts");
    expect(row).toContain("web/src/app/api/events.json/route.ts");
    expect(row).toContain("Public/anonymous read only");
    expect(row).toContain("schema-driven serializer");
    expect(row).toContain("no service-role write");
    expect(row).toContain("Only public-safe published event fields");
    expect(row).toContain("cancelled/private/draft/invite-only semantics explicit");
    expect(row).toContain("public event serializer and cache/rate metadata");
    expect(row).toContain("Public read/citation output, not privileged mutation");
    expect(row).toContain("crawler policy does not default to allow all AI crawlers");
    expect(row).toContain(
      "web/src/__tests__/track2-2l29-public-events-json-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client or runtime implementation drift", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-PUBLIC-EVENTS-JSON");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
