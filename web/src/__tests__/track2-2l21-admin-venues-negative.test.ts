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
const MANAGER_AUTH_PATH = join(WEB_SRC, "lib/venue/managerAuth.ts");

type RouteSpec = {
  name: string;
  method: "GET" | "PATCH" | "POST" | "DELETE";
  path: string;
  serviceMarker?: string;
  parseMarker?: string;
};

const routeSpecs: RouteSpec[] = [
  {
    name: "admin venue get",
    method: "GET",
    path: "app/api/admin/venues/[id]/route.ts",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "admin venue patch",
    method: "PATCH",
    path: "app/api/admin/venues/[id]/route.ts",
    serviceMarker: "createServiceRoleClient()",
    parseMarker: "request.json()",
  },
  {
    name: "admin venue delete",
    method: "DELETE",
    path: "app/api/admin/venues/[id]/route.ts",
    serviceMarker: "createServiceRoleClient()",
  },
  {
    name: "admin venue invite create",
    method: "POST",
    path: "app/api/admin/venues/[id]/invite/route.ts",
    parseMarker: "request.json()",
  },
  {
    name: "admin venue invite list",
    method: "GET",
    path: "app/api/admin/venues/[id]/invite/route.ts",
  },
  {
    name: "admin venue invite revoke",
    method: "DELETE",
    path: "app/api/admin/venues/[id]/invite/[inviteId]/route.ts",
    parseMarker: "request.json().catch(() => ({}))",
  },
  {
    name: "admin venue manager revoke",
    method: "DELETE",
    path: "app/api/admin/venues/[id]/managers/[managerId]/route.ts",
    serviceMarker: "createServiceRoleClient()",
    parseMarker: "request.json().catch(() => ({}))",
  },
  {
    name: "admin venue revert",
    method: "POST",
    path: "app/api/admin/venues/[id]/revert/route.ts",
    serviceMarker: "createServiceRoleClient()",
    parseMarker: "request.json()",
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
const managerAuthSource = readFileSync(MANAGER_AUTH_PATH, "utf-8");
const managerEditableFieldBlock = managerAuthSource.slice(
  managerAuthSource.indexOf("export const MANAGER_EDITABLE_VENUE_FIELDS = ["),
  managerAuthSource.indexOf("] as const;") + "] as const;".length
);

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

describe("Track 2 2L.21 admin venue management BOLA negative cluster", () => {
  it("denies anonymous and non-admin actors before parsing request data or privileged access", () => {
    for (const spec of routeSpecs) {
      const source = handlers.get(spec.name)!;

      expect(source).toContain("supabase.auth.getUser()");
      expect(source).toContain("checkAdminRole(supabase,");
      expect(source).toContain('error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
      expect(source).toContain('error: "Forbidden"');
      expect(source).toContain("{ status: 403 }");

      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', "checkAdminRole(supabase,");
      expectBefore(source, "checkAdminRole(supabase,", 'error: "Forbidden"');

      if (spec.serviceMarker) {
        expectBefore(source, 'error: "Forbidden"', spec.serviceMarker);
      }
      if (spec.parseMarker) {
        expectBefore(source, 'error: "Forbidden"', spec.parseMarker);
      }
    }
  });

  it("uses path venue IDs for admin venue reads, writes, deletes, and writable-field filtering", () => {
    const getSource = handlers.get("admin venue get")!;
    const patch = handlers.get("admin venue patch")!;
    const deleteSource = handlers.get("admin venue delete")!;

    expect(getSource).toContain("const { id } = await params");
    expect(getSource).toContain('.eq("id", id)');
    expect(deleteSource).toContain("const { id } = await params");
    expect(deleteSource).toMatch(/\.from\("venues"\)\.delete\(\)\.eq\("id", id\)/);

    expect(patch).toContain("const { id: venueId } = await params");
    expect(patch).toContain("for (const field of MANAGER_EDITABLE_VENUE_FIELDS)");
    expect(patch).toContain('.eq("id", venueId)');
    expect(patch).not.toContain("body.id");
    expect(patch).not.toContain("body.venue_id");
    expect(patch).not.toContain("body.venueId");

    expect(managerAuthSource).toContain("MANAGER_EDITABLE_VENUE_FIELDS");
    for (const forbiddenField of [
      "id",
      "slug",
      "created_at",
      "updated_at",
      "notes",
    ]) {
      expect(managerEditableFieldBlock).not.toContain(`"${forbiddenField}"`);
    }
  });

  it("scopes venue invite creation, listing, and revocation to path venue and invite IDs", () => {
    const inviteCreate = handlers.get("admin venue invite create")!;
    const inviteList = handlers.get("admin venue invite list")!;
    const inviteRevoke = handlers.get("admin venue invite revoke")!;

    expect(inviteCreate).toContain("const { id: venueId } = await params");
    expect(inviteCreate).toContain('.eq("id", venueId)');
    expectBefore(inviteCreate, '.eq("id", venueId)', "crypto.randomBytes");
    expectBefore(inviteCreate, "crypto.randomBytes", '.from("venue_invites")');
    expect(inviteCreate).toContain("venue_id: venueId");
    expect(inviteCreate).toContain("created_by: sessionUser.id");
    expect(inviteCreate).not.toContain("body.venueId");
    expect(inviteCreate).not.toContain("body.venue_id");

    expect(inviteList).toContain("const { id: venueId } = await params");
    expect(inviteList).toContain(
      '.select("id, email_restriction, expires_at, created_at, created_by")'
    );
    expect(inviteList).toContain('.eq("venue_id", venueId)');
    expect(inviteList).toContain('.is("accepted_at", null)');
    expect(inviteList).toContain('.is("revoked_at", null)');
    expect(inviteList).toContain('.gt("expires_at", new Date().toISOString())');
    expect(inviteList).not.toContain("token_hash");

    expect(inviteRevoke).toContain("const { id: venueId, inviteId } = await params");
    expect(inviteRevoke).toContain('.eq("id", inviteId)');
    expect(inviteRevoke).toContain('.eq("venue_id", venueId)');
    expectBefore(inviteRevoke, '.eq("venue_id", venueId)', ".update({");
    expectBefore(inviteRevoke, "invite.accepted_at", ".update({");
    expectBefore(inviteRevoke, "invite.revoked_at", ".update({");
    expect(inviteRevoke).toContain("revoked_by: sessionUser.id");
    expect(inviteRevoke).not.toContain("body.inviteId");
    expect(inviteRevoke).not.toContain("body.venueId");
  });

  it("scopes manager revoke and audit-log revert before privileged mutations or side effects", () => {
    const managerRevoke = handlers.get("admin venue manager revoke")!;
    const revert = handlers.get("admin venue revert")!;

    expect(managerRevoke).toContain("const { id: venueId, managerId } = await params");
    expect(managerRevoke).toContain('.eq("id", managerId)');
    expect(managerRevoke).toContain('.eq("venue_id", venueId)');
    expectBefore(managerRevoke, '.eq("venue_id", venueId)', ".update({");
    expectBefore(managerRevoke, "manager.revoked_at", ".update({");
    expectBefore(managerRevoke, ".update({", "console.log(");
    expect(managerRevoke).toContain("revoked_by: user.id");
    expect(managerRevoke).not.toContain("body.managerId");
    expect(managerRevoke).not.toContain("body.venueId");

    expect(revert).toContain("const { id: venueId } = await params");
    expect(revert).toContain("const { log_id, reason } = body");
    expect(revert).toContain('.eq("id", log_id)');
    expect(revert).toContain('.eq("source", "venue_audit")');
    expectBefore(revert, "context.venueId !== venueId", ".update(sanitizedRestore)");
    expectBefore(revert, 'context.action !== "venue_edit"', ".update(sanitizedRestore)");
    expectBefore(revert, "sanitizeVenuePatch(valuesToRestore)", ".update(sanitizedRestore)");
    expect(revert).toContain('.eq("id", venueId)');
    expectBefore(revert, ".update(sanitizedRestore)", "venueAudit.venueEditReverted(");
  });

  it("keeps privileged side effects after authorization and avoids leaking invite token hashes", () => {
    const patch = handlers.get("admin venue patch")!;
    const inviteCreate = handlers.get("admin venue invite create")!;
    const inviteList = handlers.get("admin venue invite list")!;
    const inviteRevoke = handlers.get("admin venue invite revoke")!;

    expectBefore(patch, 'error: "Forbidden"', "processVenueGeocodingWithStatus(");
    expectBefore(patch, ".update(updatesWithGeo)", "venueAudit.venueEdited(");
    expectBefore(patch, ".update(updatesWithGeo)", "notifyVenueGeocodingFailure(");

    const inviteSuccessResponse = inviteCreate.slice(
      inviteCreate.indexOf("return NextResponse.json({\n      success: true")
    );

    expect(inviteCreate).toContain("token_hash: tokenHash");
    expect(inviteCreate).toContain("inviteUrl");
    expect(inviteSuccessResponse).not.toContain("tokenHash");
    expect(inviteSuccessResponse).not.toContain("token_hash");
    expect(inviteList).not.toContain("token_hash");
    expect(inviteRevoke).not.toContain("token_hash");
  });

  it("does not use auth-admin and records this source-contract cluster in Track 2 docs", () => {
    for (const source of routeSources.values()) {
      expect(source).not.toContain("auth.admin");
      expect(source).not.toContain("getServiceRoleClient");
    }

    const testPath = "web/src/__tests__/track2-2l21-admin-venues-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ADMIN-VENUES");
    expect(manifestSource).toContain("T2-SR-ADMIN-VENUES");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("path venue/invite/manager/log scoping");
    expect(manifestSource).toContain("full route-invocation mismatch tests");
  });
});
