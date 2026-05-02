import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);
const OVERRIDE_CSV_PARSER_PATH = join(
  WEB_SRC,
  "lib/ops/overrideCsvParser.ts"
);

type RouteSpec = {
  name: string;
  method: "GET" | "POST";
  path: string;
  parseMarker: string;
  serviceMarker: string;
};

const routeSpecs: RouteSpec[] = [
  {
    name: "overrides preview",
    method: "POST",
    path: "app/api/admin/ops/overrides/preview/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "overrides apply",
    method: "POST",
    path: "app/api/admin/ops/overrides/apply/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "overrides export",
    method: "GET",
    path: "app/api/admin/ops/overrides/export/route.ts",
    parseMarker: "request.nextUrl.searchParams",
    serviceMarker: "createServiceRoleClient()",
  },
];

const routeSources = new Map(
  routeSpecs.map((spec) => [
    spec.name,
    readFileSync(join(WEB_SRC, spec.path), "utf-8"),
  ])
);
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");
const overrideCsvParserSource = readFileSync(OVERRIDE_CSV_PARSER_PATH, "utf-8");

function handlerSource(spec: RouteSpec): string {
  const routeSource = routeSources.get(spec.name);
  expect(routeSource, `Missing route source for ${spec.name}`).toBeDefined();

  const startNeedle = `export async function ${spec.method}(`;
  const start = routeSource!.indexOf(startNeedle);
  expect(start, `Missing ${spec.method} handler for ${spec.name}`).toBeGreaterThanOrEqual(0);

  const nextExport = routeSource!.indexOf(
    "export async function",
    start + startNeedle.length
  );

  return nextExport === -1
    ? routeSource!.slice(start)
    : routeSource!.slice(start, nextExport);
}

function expectBefore(source: string, before: string, after: string): void {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  expect(beforeIndex, `Missing before marker ${before}`).toBeGreaterThanOrEqual(0);
  expect(afterIndex, `Missing after marker ${after}`).toBeGreaterThanOrEqual(0);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(
    afterIndex
  );
}

const handlers = new Map(routeSpecs.map((spec) => [spec.name, handlerSource(spec)]));

describe("Track 2 2L.19 admin ops overrides BOLA negative cluster", () => {
  it("denies anonymous and non-admin actors before parsing request data or using service role", () => {
    for (const spec of routeSpecs) {
      const source = handlers.get(spec.name)!;

      expect(source).toContain("supabase.auth.getUser()");
      expect(source).toContain("checkAdminRole(supabase, user.id)");
      expect(source).toContain('error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
      expect(source).toContain('error: "Forbidden"');
      expect(source).toContain("{ status: 403 }");

      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', "checkAdminRole(supabase, user.id)");
      expectBefore(source, 'error: "Unauthorized"', spec.parseMarker);
      expectBefore(source, 'error: "Unauthorized"', spec.serviceMarker);
      expectBefore(source, "checkAdminRole(supabase, user.id)", 'error: "Forbidden"');
      expectBefore(source, 'error: "Forbidden"', spec.parseMarker);
      expectBefore(source, 'error: "Forbidden"', spec.serviceMarker);
    }
  });

  it("keeps override CSV parsing and validation before privileged reads or writes", () => {
    for (const spec of routeSpecs.filter((route) => route.method === "POST")) {
      const source = handlers.get(spec.name)!;

      expectBefore(source, "request.json()", spec.serviceMarker);
      expectBefore(source, 'error: "Invalid JSON in request body"', spec.serviceMarker);
      expectBefore(source, "parseOverrideCsv(csv)", "validateOverrideRows(");
      expectBefore(source, "validateOverrideRows(", spec.serviceMarker);
      expectBefore(source, "validateOverrideRows(", "validationResult.validRows.map");
    }

    const preview = handlers.get("overrides preview")!;
    const apply = handlers.get("overrides apply")!;

    for (const source of [preview, apply]) {
      expectBefore(source, "validationResult.validRows.map", ".from(\"events\")");
      expectBefore(source, ".from(\"events\")", ".from(\"occurrence_overrides\")");
      expect(source).toContain(".in(\"id\", eventIds)");
      expect(source).toContain(".in(\"event_id\", eventIds)");
      expectBefore(source, ".in(\"id\", eventIds)", "computeOverrideDiff(");
      expectBefore(source, ".in(\"event_id\", eventIds)", "computeOverrideDiff(");
    }
  });

  it("keeps override writes scoped through validated event/date-key diffs and audit after writes", () => {
    const apply = handlers.get("overrides apply")!;

    expect(apply).toContain("invalidEventIds");
    expectBefore(apply, "invalidEventIds", ".from(\"occurrence_overrides\")");
    expectBefore(apply, "computeOverrideDiff(", "buildOverrideUpdatePayloads(");
    expectBefore(apply, "computeOverrideDiff(", "diff.inserts");

    expect(apply).toMatch(
      /\.from\("occurrence_overrides"\)\s*\.insert\(\{\s*event_id: insert\.event_id,\s*date_key: insert\.date_key,/s
    );
    expect(apply).toContain("created_by: user.id");
    expectBefore(apply, "diff.inserts", ".insert({");
    expectBefore(apply, "buildOverrideUpdatePayloads(diff.updates)", ".update({");
    expect(apply).toMatch(
      /\.from\("occurrence_overrides"\)\s*\.update\(\{\s*\.\.\.payload\.updates,\s*updated_at: new Date\(\)\.toISOString\(\),\s*\}\)\s*\.eq\("id", payload\.id\)/s
    );

    expectBefore(apply, ".insert({", "opsAudit.overridesCsvApply(");
    expectBefore(apply, ".update({", "opsAudit.overridesCsvApply(");
  });

  it("keeps preview/export read-only, export filters behind admin auth, and private fields out of CSV output", () => {
    const preview = handlers.get("overrides preview")!;
    const exportSource = handlers.get("overrides export")!;

    for (const source of [preview, exportSource]) {
      expect(source).not.toContain(".insert(");
      expect(source).not.toContain(".update(");
      expect(source).not.toContain(".delete(");
    }

    expectBefore(exportSource, 'error: "Forbidden"', "request.nextUrl.searchParams");
    expectBefore(exportSource, "request.nextUrl.searchParams", "createServiceRoleClient()");
    expect(exportSource).toContain('query = query.eq("event_id", eventIdFilter)');
    expect(exportSource).toContain('query = query.eq("status", statusFilter)');
    expect(exportSource).toContain("serializeOverrideCsv(overrides || [])");
    expectBefore(exportSource, "serializeOverrideCsv(overrides || [])", "opsAudit.overridesCsvExport(");

    expect(overrideCsvParserSource).toContain("export const OVERRIDE_CSV_HEADERS");
    expect(overrideCsvParserSource).toContain('"event_id"');
    expect(overrideCsvParserSource).toContain('"date_key"');
    expect(overrideCsvParserSource).not.toMatch(
      /OVERRIDE_CSV_HEADERS[\s\S]*"(?:id|created_at|updated_at|created_by)"/
    );
  });

  it("does not use auth-admin and records this source-contract cluster in Track 2 docs", () => {
    for (const source of routeSources.values()) {
      expect(source).not.toContain("auth.admin");
      expect(source).not.toContain("getServiceRoleClient");
    }

    const testPath =
      "web/src/__tests__/track2-2l19-admin-ops-overrides-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ADMIN-OPS-OVERRIDES");
    expect(manifestSource).toContain("T2-SR-ADMIN-OPS-OVERRIDES");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("event/date-key diff scoping");
    expect(manifestSource).toContain("malformed cross-event/date-key route-invocation");
  });
});
