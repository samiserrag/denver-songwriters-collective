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
const VENUE_CSV_PARSER_PATH = join(WEB_SRC, "lib/ops/venueCsvParser.ts");

type RouteSpec = {
  name: string;
  method: "GET" | "POST";
  path: string;
  parseMarker?: string;
  serviceMarker: string;
};

const routeSpecs: RouteSpec[] = [
  {
    name: "venues preview",
    method: "POST",
    path: "app/api/admin/ops/venues/preview/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "venues apply",
    method: "POST",
    path: "app/api/admin/ops/venues/apply/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "venues export",
    method: "GET",
    path: "app/api/admin/ops/venues/export/route.ts",
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
const venueCsvParserSource = readFileSync(VENUE_CSV_PARSER_PATH, "utf-8");

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

describe("Track 2 2L.20 admin ops venues BOLA negative cluster", () => {
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
      expectBefore(source, 'error: "Unauthorized"', spec.serviceMarker);
      expectBefore(source, "checkAdminRole(supabase, user.id)", 'error: "Forbidden"');
      expectBefore(source, 'error: "Forbidden"', spec.serviceMarker);

      if (spec.parseMarker) {
        expectBefore(source, 'error: "Unauthorized"', spec.parseMarker);
        expectBefore(source, 'error: "Forbidden"', spec.parseMarker);
      }
    }
  });

  it("keeps venue CSV parsing and validation before privileged venue reads or writes", () => {
    for (const spec of routeSpecs.filter((route) => route.method === "POST")) {
      const source = handlers.get(spec.name)!;

      expectBefore(source, "request.json()", spec.serviceMarker);
      expectBefore(source, "Invalid JSON body", spec.serviceMarker);
      expectBefore(source, "parseVenueCsv(body.csv)", "validateVenueRows(");
      expectBefore(source, "validateVenueRows(", spec.serviceMarker);
      expectBefore(source, "validationResult.validRows.map((r) => r.id)", ".from(\"venues\")");
      expect(source).toContain("const venueIds = validationResult.validRows.map((r) => r.id)");
      expect(source).toContain(".in(\"id\", venueIds)");
      expect(source).not.toContain("body.id");
      expect(source).not.toContain("body.venueId");
      expect(source).not.toContain("body.venueIds");
    }
  });

  it("keeps venue apply update-only and scopes mutations by server-derived venue IDs", () => {
    const apply = handlers.get("venues apply")!;

    expectBefore(apply, ".from(\"venues\")", "computeVenueDiff(");
    expectBefore(apply, "computeVenueDiff(", "buildUpdatePayloads(");
    expectBefore(apply, "buildUpdatePayloads(diff.updates)", ".update(payload.updates)");
    expect(apply).toMatch(
      /\.from\("venues"\)\s*\.update\(payload\.updates\)\s*\.eq\("id", payload\.id\)/
    );
    expect(apply).not.toContain(".insert(");
    expect(apply).not.toContain(".upsert(");
    expect(apply).not.toContain(".delete(");
    expect(apply.indexOf(".update(payload.updates)")).toBeLessThan(
      apply.lastIndexOf("opsAudit.venuesCsvApply(")
    );
    expectBefore(apply, "diff.updates.length === 0", "opsAudit.venuesCsvApply(");
  });

  it("keeps preview/export read-only and private fields out of venue CSV output", () => {
    const preview = handlers.get("venues preview")!;
    const exportSource = handlers.get("venues export")!;

    for (const source of [preview, exportSource]) {
      expect(source).not.toContain(".insert(");
      expect(source).not.toContain(".update(");
      expect(source).not.toContain(".upsert(");
      expect(source).not.toContain(".delete(");
    }

    expectBefore(exportSource, 'error: "Forbidden"', "createServiceRoleClient()");
    expect(exportSource).toContain("serializeVenueCsv(venues || [])");
    expectBefore(exportSource, "serializeVenueCsv(venues || [])", "opsAudit.venuesCsvExport(");

    expect(venueCsvParserSource).toContain("export const VENUE_CSV_HEADERS");
    for (const publicHeader of [
      "id",
      "name",
      "address",
      "city",
      "state",
      "zip",
      "website_url",
      "phone",
      "google_maps_url",
      "notes",
    ]) {
      expect(venueCsvParserSource).toContain(`"${publicHeader}"`);
    }
    expect(venueCsvParserSource).not.toMatch(
      /VENUE_CSV_HEADERS[\s\S]*"(?:created_at|updated_at|created_by|deleted_at|venue_manager|private_notes|internal_notes|claim_token|invite_token)"/
    );
  });

  it("does not use auth-admin and records this source-contract cluster in Track 2 docs", () => {
    for (const source of routeSources.values()) {
      expect(source).not.toContain("auth.admin");
      expect(source).not.toContain("getServiceRoleClient");
    }

    const testPath =
      "web/src/__tests__/track2-2l20-admin-ops-venues-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ADMIN-OPS-VENUES");
    expect(manifestSource).toContain("T2-SR-ADMIN-OPS-VENUES");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("server-derived venue ID scoping");
    expect(manifestSource).toContain("malformed cross-venue route-invocation");
  });
});
