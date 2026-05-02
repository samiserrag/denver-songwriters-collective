import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/my-organizations/[id]/route.ts");
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const routeSource = readFileSync(ROUTE_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function handlerSource(handlerName: "GET" | "PATCH" | "DELETE"): string {
  const startNeedle = `export async function ${handlerName}(`;
  const start = routeSource.indexOf(startNeedle);
  expect(start, `Missing ${handlerName} handler`).toBeGreaterThanOrEqual(0);

  const nextExport = routeSource.indexOf(
    "export async function",
    start + startNeedle.length
  );

  return nextExport === -1
    ? routeSource.slice(start)
    : routeSource.slice(start, nextExport);
}

function functionSource(functionName: string): string {
  const startNeedle = `function ${functionName}(`;
  const asyncStartNeedle = `async function ${functionName}(`;
  const start = routeSource.indexOf(startNeedle);
  const asyncStart = routeSource.indexOf(asyncStartNeedle);
  const sourceStart = start === -1 ? asyncStart : start;

  expect(sourceStart, `Missing ${functionName} function`).toBeGreaterThanOrEqual(0);

  const nextFunction = routeSource.indexOf("\nfunction ", sourceStart + 1);
  const nextAsyncFunction = routeSource.indexOf("\nasync function ", sourceStart + 1);
  const nextExport = routeSource.indexOf("\nexport async function ", sourceStart + 1);
  const nextMarkers = [nextFunction, nextAsyncFunction, nextExport].filter(
    (index) => index >= 0
  );
  const end = nextMarkers.length > 0 ? Math.min(...nextMarkers) : routeSource.length;

  return routeSource.slice(sourceStart, end);
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

function jsonResponses(source: string): string[] {
  return [...source.matchAll(/NextResponse\.json\(([\s\S]*?)\);/g)].map(
    (match) => match[1]
  );
}

const activeGrantSource = functionSource("getActiveGrant");
const sanitizeSource = functionSource("sanitizeOrganizationPatch");
const memberTagSyncSource = functionSource("syncOrganizationMemberTags");
const contentLinkSyncSource = functionSource("syncOrganizationContentLinks");
const getSource = handlerSource("GET");
const patchSource = handlerSource("PATCH");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.15 my organizations BOLA negative cluster", () => {
  it("denies anonymous GET, PATCH, and DELETE before privileged reads or writes", () => {
    for (const source of [getSource, patchSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(getSource, 'error: "Unauthorized"', "getActiveGrant(");
    expectBefore(getSource, 'error: "Unauthorized"', "createServiceRoleClient()");

    expectBefore(patchSource, 'error: "Unauthorized"', "getActiveGrant(");
    expectBefore(patchSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(patchSource, 'error: "Unauthorized"', "createServiceRoleClient()");
    expectBefore(patchSource, 'error: "Unauthorized"', "syncOrganizationMemberTags(");
    expectBefore(patchSource, 'error: "Unauthorized"', "syncOrganizationContentLinks(");
    expectBefore(patchSource, 'error: "Unauthorized"', ".update(updates)");

    expectBefore(deleteSource, 'error: "Unauthorized"', "getActiveGrant(");
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
  });

  it("scopes active manager grants by path organization, session user, and non-revoked state", () => {
    expect(activeGrantSource).toContain('.from("organization_managers")');
    expect(activeGrantSource).toContain('.select("id, role")');
    expect(activeGrantSource).toContain('.eq("organization_id", organizationId)');
    expect(activeGrantSource).toContain('.eq("user_id", userId)');
    expect(activeGrantSource).toContain('.is("revoked_at", null)');
    expect(activeGrantSource).toContain(".maybeSingle()");

    for (const source of [getSource, patchSource, deleteSource]) {
      expect(source).toContain("const { id: organizationId } = await params;");
      expect(source).toContain("getActiveGrant(supabase, organizationId, user.id)");
    }

    expect(getSource).toContain("if (!grant && !isAdmin)");
    expect(patchSource).toContain("if (!grant && !isAdmin)");
    expect(deleteSource).toContain("if (!grant)");
  });

  it("keeps service-role reads and relation sync behind route-local grant/admin checks", () => {
    expectBefore(getSource, "if (!grant && !isAdmin)", "createServiceRoleClient()");
    expectBefore(getSource, "if (!grant && !isAdmin)", "fetchOrganizationWithRelations(");
    expectBefore(getSource, "if (!grant && !isAdmin)", "listMemberOptions(");
    expectBefore(getSource, "if (!grant && !isAdmin)", "listContentOptionsForProfiles(");

    expectBefore(patchSource, "if (!grant && !isAdmin)", "request.json()");
    expectBefore(patchSource, "if (!grant && !isAdmin)", "createServiceRoleClient()");
    expectBefore(patchSource, "if (!grant && !isAdmin)", "listExistingProfileIds(");
    expectBefore(patchSource, "if (!grant && !isAdmin)", "syncOrganizationMemberTags(");
    expectBefore(patchSource, "if (!grant && !isAdmin)", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "if (!grant && !isAdmin)", ".update(updates)");

    expect(deleteSource).not.toContain("createServiceRoleClient");
    expect(deleteSource).not.toContain("getServiceRoleClient");
    expect(deleteSource).not.toContain("auth.admin");
  });

  it("constrains PATCH writable fields through the manager allowlist and ignores body organization IDs", () => {
    expect(sanitizeSource).toContain("for (const key of MANAGER_EDITABLE_FIELDS)");
    expect(patchSource).toContain("const updates = sanitizeOrganizationPatch(body)");

    for (const writableField of [
      "name",
      "website_url",
      "city",
      "organization_type",
      "short_blurb",
      "why_it_matters",
      "tags",
      "logo_image_url",
      "cover_image_url",
      "gallery_image_urls",
      "fun_note",
    ]) {
      expect(routeSource).toContain(`"${writableField}"`);
    }

    for (const forbiddenMarker of [
      '"id"',
      '"slug"',
      '"created_at"',
      '"updated_at"',
      '"claim_status"',
      '"owner_id"',
      '"manager_ids"',
      "body.organization_id",
      "body.id",
    ]) {
      expect(sanitizeSource).not.toContain(forbiddenMarker);
    }

    expect(patchSource).not.toContain("body.organization_id");
    expect(patchSource).not.toContain("body.id");
    expect(patchSource).not.toContain("organization_id: body");
    expect(patchSource).not.toContain("id: body");

    expect(patchSource).toMatch(
      /\.from\(TABLE_NAME\)\s*\.update\(updates\)\s*\.eq\("id", organizationId\)/
    );
  });

  it("validates member tags and content links before sync, update, or email fanout", () => {
    expectBefore(patchSource, "listExistingProfileIds(", "syncOrganizationMemberTags(");
    expectBefore(patchSource, "missingProfileIds.length > 0", "syncOrganizationMemberTags(");
    expectBefore(patchSource, "collectInvalidContentLinksByExistence(", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "invalidByExistence.length > 0", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "collectInvalidManagerContentLinks(", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "invalidLinks.length > 0", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "syncOrganizationMemberTags(", "notifyTaggedMembersAdded(");

    expect(memberTagSyncSource).toContain("organization_id: organizationId");
    expect(memberTagSyncSource).toContain('.eq("organization_id", organizationId)');
    expect(contentLinkSyncSource).toContain("organization_id: organizationId");
    expect(contentLinkSyncSource).toContain('.eq("organization_id", organizationId)');
  });

  it("soft-revokes only the server-fetched active organization grant", () => {
    expect(deleteSource).not.toContain("request.json()");
    expect(deleteSource).not.toContain("body.");
    expect(deleteSource).not.toContain("grant_id");
    expect(deleteSource).not.toContain("manager_id");
    expect(deleteSource).toContain('if (grant.role === "owner")');
    expect(deleteSource).toContain('.eq("organization_id", organizationId)');
    expect(deleteSource).toContain('.eq("role", "owner")');
    expect(deleteSource).toContain('.is("revoked_at", null)');
    expect(deleteSource).toContain("if (count === 1)");
    expect(deleteSource).toContain("You are the only owner of this organization");

    expectBefore(deleteSource, "if (!grant)", ".update({");
    expectBefore(deleteSource, "if (count === 1)", ".update({");
    expect(deleteSource).toMatch(
      /\.from\("organization_managers"\)\s*\.update\(\{[\s\S]*revoked_at: new Date\(\)\.toISOString\(\),[\s\S]*revoked_by: user\.id,[\s\S]*revoked_reason: "User relinquished access",[\s\S]*\}\)\s*\.eq\("id", grant\.id\)/
    );
  });

  it("does not expose grant internals or notification-private fields in route responses", () => {
    for (const response of [
      ...jsonResponses(getSource),
      ...jsonResponses(patchSource),
      ...jsonResponses(deleteSource),
    ]) {
      for (const privateMarker of [
        "organization_managers",
        "grant.id",
        "revoked_by",
        "revoked_reason",
        "actorProfile",
        "taggedProfiles",
        "email",
        "created_by",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }

    expect(getSource).toContain("managerRole");
    expect(patchSource).toContain("updatedFields");
    expect(deleteSource).toContain("You no longer have access to this organization");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l15-my-organizations-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-MY-ORGANIZATIONS");
    expect(manifestSource).toContain("T2-SR-MY-ORGANIZATIONS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("active organization grant/admin denial");
    expect(manifestSource).toContain("GET/PATCH/DELETE /api/my-organizations/[id]");
    expect(manifestSource).toContain("full route-invocation negative harness");
  });
});
