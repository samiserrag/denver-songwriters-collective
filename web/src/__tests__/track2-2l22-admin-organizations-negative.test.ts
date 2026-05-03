import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/admin/organizations/[id]/route.ts");
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
  const functionNeedles = [
    `function ${functionName}(`,
    `async function ${functionName}(`,
  ];
  const starts = functionNeedles
    .map((needle) => routeSource.indexOf(needle))
    .filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : -1;

  expect(start, `Missing ${functionName} function`).toBeGreaterThanOrEqual(0);

  const nextFunction = routeSource.indexOf("\nfunction ", start + 1);
  const nextAsyncFunction = routeSource.indexOf("\nasync function ", start + 1);
  const nextExport = routeSource.indexOf("\nexport async function ", start + 1);
  const nextMarkers = [nextFunction, nextAsyncFunction, nextExport].filter(
    (index) => index >= 0
  );
  const end = nextMarkers.length > 0 ? Math.min(...nextMarkers) : routeSource.length;

  return routeSource.slice(start, end);
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

const requireAdminSource = functionSource("requireAdmin");
const memberTagSyncSource = functionSource("syncOrganizationMemberTags");
const contentLinkSyncSource = functionSource("syncOrganizationContentLinks");
const notifySource = functionSource("notifyTaggedMembersAdded");
const getSource = handlerSource("GET");
const patchSource = handlerSource("PATCH");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.22 admin organization BOLA negative cluster", () => {
  it("denies anonymous and non-admin actors before parsing or privileged service-role access", () => {
    expect(requireAdminSource).toContain("createSupabaseServerClient()");
    expect(requireAdminSource).toContain("supabase.auth.getUser()");
    expect(requireAdminSource).toContain('error: "Unauthorized"');
    expect(requireAdminSource).toContain("{ status: 401 }");
    expect(requireAdminSource).toContain("checkAdminRole(supabase, user.id)");
    expect(requireAdminSource).toContain('error: "Forbidden"');
    expect(requireAdminSource).toContain("{ status: 403 }");
    expectBefore(requireAdminSource, "supabase.auth.getUser()", 'error: "Unauthorized"');
    expectBefore(requireAdminSource, 'error: "Unauthorized"', "checkAdminRole(supabase, user.id)");
    expectBefore(requireAdminSource, "checkAdminRole(supabase, user.id)", 'error: "Forbidden"');

    for (const source of [getSource, patchSource, deleteSource]) {
      expectBefore(source, "requireAdmin()", "const { id } = await params");
      expectBefore(source, "if (\"error\" in auth) return auth.error", "createServiceRoleClient()");
    }

    expectBefore(patchSource, "if (\"error\" in auth) return auth.error", "request.json()");
    expectBefore(patchSource, "if (\"error\" in auth) return auth.error", ".update(updates)");
    expectBefore(deleteSource, "if (\"error\" in auth) return auth.error", ".delete()");
  });

  it("uses the path organization ID for reads, updates, deletes, relation sync, and response refetch", () => {
    for (const source of [getSource, patchSource, deleteSource]) {
      expect(source).toContain("const { id } = await params");
    }

    expect(getSource).toContain("fetchOrganizationWithRelations(serviceClient, id)");
    expect(patchSource).toMatch(
      /\.from\(TABLE_NAME\)\.update\(updates\)\.eq\("id", id\)/
    );
    expect(patchSource).toContain("syncOrganizationMemberTags(serviceClient, id, memberTags, auth.user.id)");
    expect(patchSource).toContain("syncOrganizationContentLinks(serviceClient, id, contentLinks, auth.user.id)");
    expect(patchSource).toContain("fetchOrganizationWithRelations(serviceClient, id)");
    expect(deleteSource).toMatch(
      /\.from\(TABLE_NAME\)\.delete\(\)\.eq\("id", id\)/
    );

    for (const source of [getSource, patchSource, deleteSource]) {
      expect(source).not.toContain("body.id");
      expect(source).not.toContain("body.organization_id");
      expect(source).not.toContain("body.organizationId");
    }
  });

  it("constrains PATCH writes to explicit admin fields and avoids grant/body-ID trust", () => {
    const writableMarkers = [
      "body.slug",
      "body.name",
      "body.website_url",
      "body.city",
      "body.organization_type",
      "body.short_blurb",
      "body.why_it_matters",
      "body.tags",
      "body.featured",
      "body.is_active",
      "body.visibility",
      "body.logo_image_url",
      "body.cover_image_url",
      "body.gallery_image_urls",
      "body.fun_note",
      "body.sort_order",
    ];

    for (const marker of writableMarkers) {
      expect(patchSource).toContain(marker);
    }

    for (const forbiddenMarker of [
      "body.owner_id",
      "body.manager_ids",
      "body.claim_status",
      "body.created_at",
      "body.updated_at",
      "body.revoked_at",
      "body.token",
      "organization_managers",
      "getActiveGrant(",
    ]) {
      expect(patchSource).not.toContain(forbiddenMarker);
    }
  });

  it("validates member tags and content links before relation sync, update, or email fanout", () => {
    expectBefore(patchSource, "listExistingProfileIds(", "syncOrganizationMemberTags(");
    expectBefore(patchSource, "missingProfileIds.length > 0", "syncOrganizationMemberTags(");
    expectBefore(patchSource, "collectInvalidContentLinksByExistence(", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "invalidLinks.length > 0", "syncOrganizationContentLinks(");
    expectBefore(patchSource, "syncOrganizationMemberTags(", "notifyTaggedMembersAdded(");
    expectBefore(patchSource, "syncOrganizationMemberTags(", "syncOrganizationContentLinks(");

    expect(memberTagSyncSource).toContain("organization_id: organizationId");
    expect(memberTagSyncSource).toContain('.eq("organization_id", organizationId)');
    expect(memberTagSyncSource).toContain("created_by: actorUserId");
    expect(contentLinkSyncSource).toContain("organization_id: organizationId");
    expect(contentLinkSyncSource).toContain('.eq("organization_id", organizationId)');
    expect(contentLinkSyncSource).toContain("created_by: actorUserId");

    expect(notifySource).toContain('.eq("id", organizationId)');
    expect(notifySource).toContain(".in(\"id\", addedProfileIds)");
    expect(notifySource).toContain("sendEmail({");
  });

  it("keeps service-role usage and private notification fields behind admin authorization", () => {
    for (const source of [getSource, patchSource, deleteSource]) {
      expectBefore(source, "if (\"error\" in auth) return auth.error", "createServiceRoleClient()");
      expect(source).not.toContain("auth.admin");
      expect(source).not.toContain("getServiceRoleClient");
    }

    expectBefore(patchSource, "if (\"error\" in auth) return auth.error", "notifyTaggedMembersAdded(");
    expect(notifySource).toContain('.select("full_name, email")');
    expect(notifySource).toContain('.select("id, full_name, email")');

    for (const response of [
      ...jsonResponses(getSource),
      ...jsonResponses(patchSource),
      ...jsonResponses(deleteSource),
    ]) {
      for (const privateMarker of [
        "actorProfile",
        "taggedProfiles",
        "emailContent",
        "token",
        "token_hash",
        "organization_managers",
        "revoked_by",
        "revoked_reason",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }
  });

  it("records this source-contract cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l22-admin-organizations-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ADMIN-ORGANIZATIONS");
    expect(manifestSource).toContain("T2-SR-ADMIN-ORGANIZATIONS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("path organization/member/content-link scoping");
    expect(manifestSource).toContain("full route-invocation mismatch tests");
  });
});
