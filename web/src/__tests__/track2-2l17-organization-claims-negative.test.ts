import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/organizations/[id]/claim/route.ts");
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

function handlerSource(handlerName: "POST" | "DELETE"): string {
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

const postSource = handlerSource("POST");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.17 organization claim BOLA negative cluster", () => {
  it("denies anonymous POST and DELETE before body, claim lookup, manager lookup, or mutation", () => {
    for (const source of [postSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', '.from("organization_claims")');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', '.from("organizations")');
    expectBefore(postSource, 'error: "Unauthorized"', '.from("organization_managers")');
    expectBefore(postSource, 'error: "Unauthorized"', ".insert({");
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
  });

  it("uses the path organization ID for the active organization check before claim insert", () => {
    expect(postSource).toContain("const { id: organizationId } = await params;");
    expect(postSource).toMatch(
      /\.from\("organizations"\)\s*\.select\("id, name, is_active"\)\s*\.eq\("id", organizationId\)\s*\.single\(\)/
    );
    expect(postSource).toContain("!organization.is_active");
    expect(postSource).toContain('error: "Organization not found"');
    expect(postSource).toContain("{ status: 404 }");
    expect(postSource).not.toContain("body.organization_id");
    expect(postSource).not.toContain("body.id");

    expectBefore(postSource, '.eq("id", organizationId)', 'error: "Organization not found"');
    expectBefore(postSource, 'error: "Organization not found"', '.from("organization_claims")');
    expectBefore(postSource, 'error: "Organization not found"', ".insert({");
  });

  it("denies duplicate pending organization claimants before insert", () => {
    expect(postSource).toContain('.from("organization_claims")');
    expect(postSource).toContain('.eq("organization_id", organizationId)');
    expect(postSource).toContain('.eq("requester_id", sessionUser.id)');
    expect(postSource).toContain('.eq("status", "pending")');
    expect(postSource).toContain(
      'error: "You already have a pending claim for this organization"'
    );
    expect(postSource).toContain("{ status: 409 }");

    expectBefore(postSource, "if (existingClaim)", ".insert({");
    expectBefore(
      postSource,
      'error: "You already have a pending claim for this organization"',
      ".insert({"
    );
  });

  it("denies active organization managers while revoked manager grants do not satisfy the manager check", () => {
    expect(postSource).toContain('.from("organization_managers")');
    expect(postSource).toContain('.eq("organization_id", organizationId)');
    expect(postSource).toContain('.eq("user_id", sessionUser.id)');
    expect(postSource).toContain('.is("revoked_at", null)');
    expect(postSource).toContain('error: "You already manage this organization"');
    expect(postSource).toContain("{ status: 409 }");

    expectBefore(postSource, "if (existingManager)", ".insert({");
    expectBefore(
      postSource,
      'error: "You already manage this organization"',
      ".insert({"
    );
  });

  it("inserts claims with the path organization ID and server session user only", () => {
    expectBefore(postSource, '.eq("id", organizationId)', ".insert({");
    expect(postSource).toContain("organization_id: organizationId");
    expect(postSource).toContain("requester_id: sessionUser.id");
    expect(postSource).toContain("message,");
    expect(postSource).not.toContain("organization_id: body");
    expect(postSource).not.toContain("requester_id: body");
    expect(postSource).not.toContain("status: body");
  });

  it("cancels only the authenticated user's pending claim for the path organization", () => {
    expect(deleteSource).toContain("const { id: organizationId } = await params;");
    expect(deleteSource).toContain('.from("organization_claims")');
    expect(deleteSource).toContain('.eq("organization_id", organizationId)');
    expect(deleteSource).toContain('.eq("requester_id", sessionUser.id)');
    expect(deleteSource).toContain('.eq("status", "pending")');
    expect(deleteSource).toContain('error: "No pending claim found to cancel"');
    expect(deleteSource).toContain("{ status: 404 }");
    expect(deleteSource).not.toContain("request.json()");
    expect(deleteSource).not.toContain("body.claim");
    expect(deleteSource).not.toContain("body.organization");

    expectBefore(deleteSource, '.eq("organization_id", organizationId)', ".update({");
    expectBefore(deleteSource, '.eq("requester_id", sessionUser.id)', ".update({");
    expectBefore(deleteSource, '.eq("status", "pending")', ".update({");
    expect(deleteSource).toMatch(
      /\.update\(\{[\s\S]*status: "cancelled"[\s\S]*cancelled_at: new Date\(\)\.toISOString\(\),[\s\S]*\}\)\s*\.eq\("id", claim\.id\)/
    );
  });

  it("does not use service-role, auth-admin, fanout, or private fields in responses", () => {
    expect(routeSource).not.toContain("createServiceRoleClient");
    expect(routeSource).not.toContain("getServiceRoleClient");
    expect(routeSource).not.toContain("auth.admin");
    expect(routeSource).not.toContain("sendEmail");
    expect(routeSource).not.toContain("sendAdminEmail");
    expect(routeSource).not.toContain("notify");

    for (const response of [...jsonResponses(postSource), ...jsonResponses(deleteSource)]) {
      for (const privateMarker of [
        "organization.name",
        "organization.is_active",
        "organization_claims",
        "requester_id",
        "reviewed_by",
        "rejection_reason",
        "cancelled_at",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }

    expect(postSource).toContain("claimId: claim.id");
    expect(deleteSource).toContain("Claim cancelled successfully");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l17-organization-claims-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-ORGANIZATION-CLAIMS");
    expect(manifestSource).toContain("T2-SR-ORGANIZATION-CLAIMS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("inactive organization denial");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
    expect(manifestSource).toContain("full route-invocation negative harness");
  });
});
