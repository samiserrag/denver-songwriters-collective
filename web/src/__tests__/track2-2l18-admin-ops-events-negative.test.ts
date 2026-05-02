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

type RouteSpec = {
  name: string;
  method: "GET" | "POST";
  path: string;
  parseMarker: string;
  serviceMarker: string;
};

const routeSpecs: RouteSpec[] = [
  {
    name: "events preview",
    method: "POST",
    path: "app/api/admin/ops/events/preview/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "events apply",
    method: "POST",
    path: "app/api/admin/ops/events/apply/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "events import preview",
    method: "POST",
    path: "app/api/admin/ops/events/import-preview/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "events import apply",
    method: "POST",
    path: "app/api/admin/ops/events/import-apply/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "events bulk verify",
    method: "POST",
    path: "app/api/admin/ops/events/bulk-verify/route.ts",
    parseMarker: "request.json()",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "events export",
    method: "GET",
    path: "app/api/admin/ops/events/export/route.ts",
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

describe("Track 2 2L.18 admin ops events BOLA negative cluster", () => {
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

  it("keeps POST body validation before service-role reads or writes", () => {
    for (const spec of routeSpecs.filter((route) => route.method === "POST")) {
      const source = handlers.get(spec.name)!;

      expectBefore(source, "request.json()", spec.serviceMarker);
      expectBefore(source, 'error: "Invalid JSON in request body"', spec.serviceMarker);
    }

    const preview = handlers.get("events preview")!;
    const apply = handlers.get("events apply")!;
    const importPreview = handlers.get("events import preview")!;
    const importApply = handlers.get("events import apply")!;
    const bulkVerify = handlers.get("events bulk verify")!;

    for (const source of [preview, apply]) {
      expectBefore(source, "parseEventCsv(csv)", "validateEventRows(");
      expectBefore(source, "validateEventRows(", "createServiceRoleClient()");
    }

    for (const source of [importPreview, importApply]) {
      expectBefore(source, "parseImportCsv(csv)", "validateImportRows(");
      expectBefore(source, "validateImportRows(", "createServiceRoleClient()");
    }

    expectBefore(bulkVerify, "eventIds = body.eventIds", "createServiceRoleClient()");
    expectBefore(bulkVerify, "eventIds must be a non-empty array", "createServiceRoleClient()");
    expectBefore(bulkVerify, "action must be 'verify' or 'unverify'", "createServiceRoleClient()");
  });

  it("keeps event writes and audit calls behind admin validation and service-role resource checks", () => {
    const apply = handlers.get("events apply")!;
    const importApply = handlers.get("events import apply")!;
    const bulkVerify = handlers.get("events bulk verify")!;

    expect(apply).toMatch(
      /\.from\("events"\)\s*\.update\(payload\.updates\)\s*\.eq\("id", payload\.id\)/
    );
    expectBefore(apply, "computeEventDiff(", "buildEventUpdatePayloads(");
    expectBefore(apply, "buildEventUpdatePayloads(", ".update(payload.updates)");
    expectBefore(apply, ".update(payload.updates)", "opsAudit.eventsCsvApply(");

    expect(importApply).toContain("checkDuplicates(");
    expect(importApply).toContain("validateVenueIds(");
    expect(importApply).toContain("buildInsertPayloads(");
    expect(importApply).toMatch(
      /\.from\("events"\)\s*\.insert\(payload as EventInsert\)\s*\.select\("id, title"\)\s*\.single\(\)/
    );
    expectBefore(importApply, "checkDuplicates(", "buildInsertPayloads(");
    expectBefore(importApply, "validateVenueIds(", "buildInsertPayloads(");
    expectBefore(importApply, "buildInsertPayloads(", ".insert(payload as EventInsert)");
    expectBefore(importApply, ".insert(payload as EventInsert)", "opsAudit.eventsImport(");

    expectBefore(bulkVerify, "createServiceRoleClient()", ".update(updatePayload)");
    expect(bulkVerify).toMatch(
      /\.from\("events"\)\s*\.update\(updatePayload\)\s*\.in\("id", eventIds\)\s*\.select\("id"\)/
    );
    expectBefore(bulkVerify, ".update(updatePayload)", "opsAudit.eventsBulkVerify(");
    expectBefore(bulkVerify, ".update(updatePayload)", "opsAudit.eventsBulkUnverify(");
  });

  it("keeps preview/export surfaces read-only and export filters behind admin auth", () => {
    const preview = handlers.get("events preview")!;
    const importPreview = handlers.get("events import preview")!;
    const exportSource = handlers.get("events export")!;

    for (const source of [preview, importPreview, exportSource]) {
      expect(source).not.toContain(".insert(");
      expect(source).not.toContain(".update(");
      expect(source).not.toContain(".delete(");
    }

    expectBefore(exportSource, 'error: "Forbidden"', "request.nextUrl.searchParams");
    expectBefore(exportSource, "request.nextUrl.searchParams", "createServiceRoleClient()");
    expect(exportSource).toContain('query = query.eq("status", statusFilter)');
    expect(exportSource).toContain('query = query.eq("venue_id", venueIdFilter)');
    expect(exportSource).toContain("opsAudit.eventsCsvExport(");
  });

  it("does not use auth-admin and records this source-contract cluster in Track 2 docs", () => {
    for (const source of routeSources.values()) {
      expect(source).not.toContain("auth.admin");
      expect(source).not.toContain("getServiceRoleClient");
    }

    const testPath =
      "web/src/__tests__/track2-2l18-admin-ops-events-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ADMIN-OPS-EVENTS");
    expect(manifestSource).toContain("T2-SR-ADMIN-OPS-EVENTS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("admin gate and service-role ordering");
    expect(manifestSource).toContain("malformed cross-resource batch route-invocation");
  });
});
