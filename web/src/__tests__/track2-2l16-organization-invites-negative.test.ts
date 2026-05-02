import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const INVITE_ROUTE_PATH = join(WEB_SRC, "app/api/my-organizations/[id]/invite/route.ts");
const REVOKE_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/my-organizations/[id]/invite/[inviteId]/route.ts"
);
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const inviteRouteSource = readFileSync(INVITE_ROUTE_PATH, "utf-8");
const revokeRouteSource = readFileSync(REVOKE_ROUTE_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function handlerSource(source: string, handlerName: "GET" | "POST" | "DELETE"): string {
  const startNeedle = `export async function ${handlerName}(`;
  const start = source.indexOf(startNeedle);
  expect(start, `Missing ${handlerName} handler`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf(
    "export async function",
    start + startNeedle.length
  );

  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

function functionSource(source: string, functionName: string): string {
  const startNeedle = `function ${functionName}(`;
  const asyncStartNeedle = `async function ${functionName}(`;
  const start = source.indexOf(startNeedle);
  const asyncStart = source.indexOf(asyncStartNeedle);
  const sourceStart = start === -1 ? asyncStart : start;

  expect(sourceStart, `Missing ${functionName} function`).toBeGreaterThanOrEqual(0);

  const nextFunction = source.indexOf("\nfunction ", sourceStart + 1);
  const nextAsyncFunction = source.indexOf("\nasync function ", sourceStart + 1);
  const nextExport = source.indexOf("\nexport async function ", sourceStart + 1);
  const nextMarkers = [nextFunction, nextAsyncFunction, nextExport].filter(
    (index) => index >= 0
  );
  const end = nextMarkers.length > 0 ? Math.min(...nextMarkers) : source.length;

  return source.slice(sourceStart, end);
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

const inviteAuthSource = functionSource(inviteRouteSource, "checkInviteAuthorization");
const revokeAccessSource = functionSource(revokeRouteSource, "getAccess");
const postSource = handlerSource(inviteRouteSource, "POST");
const getSource = handlerSource(inviteRouteSource, "GET");
const deleteSource = handlerSource(revokeRouteSource, "DELETE");

describe("Track 2 2L.16 organization invite BOLA negative cluster", () => {
  it("denies anonymous create, list, and revoke before body, invite rows, mutation, or fanout", () => {
    for (const source of [postSource, getSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(postSource, 'error: "Unauthorized"', "checkInviteAuthorization(");
    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', '.from("organization_invites")');
    expectBefore(postSource, 'error: "Unauthorized"', "sendEmail({");

    expectBefore(getSource, 'error: "Unauthorized"', "checkInviteAuthorization(");
    expectBefore(getSource, 'error: "Unauthorized"', '.from("organization_invites")');

    expectBefore(deleteSource, 'error: "Unauthorized"', "getAccess(");
    expectBefore(deleteSource, 'error: "Unauthorized"', '.from("organization_invites")');
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
  });

  it("requires active path-organization manager access or admin before invite operations", () => {
    expect(inviteAuthSource).toContain("checkAdminRole(supabase, userId)");
    expect(inviteAuthSource).toContain('.from("organizations")');
    expect(inviteAuthSource).toContain('.select("id, name, slug")');
    expect(inviteAuthSource).toContain('.eq("id", organizationId)');
    expect(inviteAuthSource).toContain('.from("organization_managers")');
    expect(inviteAuthSource).toContain('.select("id, role")');
    expect(inviteAuthSource).toContain('.eq("organization_id", organizationId)');
    expect(inviteAuthSource).toContain('.eq("user_id", userId)');
    expect(inviteAuthSource).toContain('.is("revoked_at", null)');

    expect(revokeAccessSource).toContain("checkAdminRole(supabase, userId)");
    expect(revokeAccessSource).toContain('.from("organization_managers")');
    expect(revokeAccessSource).toContain('.eq("organization_id", organizationId)');
    expect(revokeAccessSource).toContain('.eq("user_id", userId)');
    expect(revokeAccessSource).toContain('.is("revoked_at", null)');

    for (const source of [postSource, getSource]) {
      expect(source).toContain("const { id: organizationId } = await params;");
      expect(source).toContain("checkInviteAuthorization(");
      expect(source).toContain("organizationId");
      expect(source).toContain("sessionUser.id");
      expect(source).toContain("if (!organization)");
      expect(source).toContain("if (!authorized)");
    }

    expect(deleteSource).toContain(
      "const { id: organizationId, inviteId } = await params;"
    );
    expect(deleteSource).toContain("getAccess(");
    expect(deleteSource).toContain("organizationId");
    expect(deleteSource).toContain("sessionUser.id");
    expect(deleteSource).toContain("if (!isAdmin && !managerRole)");
  });

  it("uses the path organization and session user for invite create without trusting body IDs", () => {
    expectBefore(postSource, "if (!authorized)", "request.json()");
    expectBefore(postSource, "if (!authorized)", ".insert({");
    expect(postSource).toContain("organization_id: organizationId");
    expect(postSource).toContain("created_by: sessionUser.id");
    expect(postSource).not.toContain("body.organization_id");
    expect(postSource).not.toContain("body.created_by");
    expect(postSource).not.toContain("organization_id: body");
    expect(postSource).not.toContain("created_by: body");

    expect(postSource).toContain("normalizeInviteRole(body.role_to_grant)");
    expect(inviteRouteSource).toContain('value === "owner" ? "owner" : "manager"');
    expect(postSource).toContain("if (!isAdmin && managerRole !== \"owner\" && roleToGrant === \"owner\")");
    expectBefore(postSource, "roleToGrant === \"owner\"", ".insert({");
  });

  it("sends invite email only after authorized path-scoped insert succeeds", () => {
    expectBefore(postSource, "if (!authorized)", "sendEmail({");
    expectBefore(postSource, ".insert({", "sendEmail({");
    expectBefore(postSource, "if (insertError || !invite)", "sendEmail({");
    expect(postSource).toContain("organization.name");
    expect(postSource).toContain("sessionUser.id");
    expect(postSource).toContain("emailRestriction");
  });

  it("lists invites only after authz and scopes the list to the path organization", () => {
    expectBefore(getSource, "if (!authorized)", '.from("organization_invites")');
    expect(getSource).toContain(
      '"id, role_to_grant, email_restriction, expires_at, created_at, created_by, accepted_at, accepted_by, revoked_at"'
    );
    expect(getSource).toContain('.eq("organization_id", organizationId)');
    expect(getSource).toContain('status = "revoked"');
    expect(getSource).toContain('status = "expired"');
    expect(getSource).not.toContain("token_hash");
    expect(getSource).not.toContain("tokenHash");
  });

  it("denies invite/organization mismatch and stale invite states before revoke mutation", () => {
    expectBefore(deleteSource, "if (!isAdmin && !managerRole)", '.from("organization_invites")');
    expect(deleteSource).toContain('.eq("id", inviteId)');
    expect(deleteSource).toContain('.eq("organization_id", organizationId)');
    expect(deleteSource).toContain("if (inviteError || !invite)");
    expect(deleteSource).toContain('error: "Invite not found"');
    expect(deleteSource).toContain("{ status: 404 }");

    expectBefore(deleteSource, '.eq("organization_id", organizationId)', ".update({");
    expectBefore(deleteSource, "if (inviteError || !invite)", ".update({");
    expectBefore(deleteSource, "if (invite.accepted_at)", ".update({");
    expectBefore(deleteSource, "if (invite.revoked_at)", ".update({");
    expect(deleteSource).toContain('error: "Cannot revoke an accepted invite"');
    expect(deleteSource).toContain('error: "Invite is already revoked"');
  });

  it("allows only owners or admins to revoke owner invites and avoids body ID trust", () => {
    expect(deleteSource).toContain(
      'if (!isAdmin && managerRole !== "owner" && invite.role_to_grant === "owner")'
    );
    expectBefore(deleteSource, 'invite.role_to_grant === "owner"', ".update({");
    expect(deleteSource).not.toContain("body.organization_id");
    expect(deleteSource).not.toContain("body.invite_id");
    expect(deleteSource).not.toContain("body.id");
    expect(deleteSource).not.toContain("organization_id: body");
    expect(deleteSource).not.toContain("invite_id: body");
    expect(deleteSource).toContain("reason = typeof body.reason");
    expect(deleteSource).toMatch(
      /\.from\("organization_invites"\)\s*\.update\(\{[\s\S]*revoked_at: new Date\(\)\.toISOString\(\),[\s\S]*revoked_by: sessionUser\.id,[\s\S]*revoked_reason: reason,[\s\S]*\}\)\s*\.eq\("id", inviteId\)/
    );
  });

  it("does not expose token hashes, service-role clients, or auth-admin fanout in invite responses", () => {
    for (const source of [inviteRouteSource, revokeRouteSource]) {
      expect(source).not.toContain("createServiceRoleClient");
      expect(source).not.toContain("getServiceRoleClient");
      expect(source).not.toContain("auth.admin");
    }

    for (const response of [
      ...jsonResponses(postSource),
      ...jsonResponses(getSource),
      ...jsonResponses(deleteSource),
    ]) {
      for (const privateMarker of [
        "token_hash",
        "tokenHash",
        "organization_managers",
        "managerRole",
        "sessionUser.id",
        "revoked_by",
        "revoked_reason",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }

    expect(postSource).toContain("inviteUrl");
    expect(deleteSource).toContain("Invite revoked");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l16-organization-invites-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-MY-ORGANIZATIONS");
    expect(manifestSource).toContain("T2-SR-MY-ORGANIZATION-INVITES");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("invite/org mismatch denial");
    expect(manifestSource).toContain("POST/GET/DELETE organization invite subroutes");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
    expect(manifestSource).toContain("full route-invocation negative harness");
  });
});
