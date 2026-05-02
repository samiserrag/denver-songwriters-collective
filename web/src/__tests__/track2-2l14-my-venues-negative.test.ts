import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/my-venues/[id]/route.ts");
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

function handlerSource(handlerName: "DELETE"): string {
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

const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.14 my venues BOLA negative cluster", () => {
  it("denies anonymous relinquish before grant lookup or mutation", () => {
    expectBefore(deleteSource, "supabase.auth.getUser()", 'error: "Unauthorized"');
    expectBefore(deleteSource, 'error: "Unauthorized"', '.from("venue_managers")');
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
    expect(deleteSource).toContain("{ status: 401 }");
  });

  it("requires an active grant for the path venue and session user", () => {
    expect(deleteSource).toContain("const { id: venueId } = await params;");
    expect(deleteSource).toContain('.from("venue_managers")');
    expect(deleteSource).toContain('.select("id, role")');
    expect(deleteSource).toContain('.eq("venue_id", venueId)');
    expect(deleteSource).toContain('.eq("user_id", sessionUser.id)');
    expect(deleteSource).toContain('.is("revoked_at", null)');
    expect(deleteSource).toContain("if (findError || !grant)");
    expect(deleteSource).toContain('error: "You don\'t have access to this venue"');
    expect(deleteSource).toContain("{ status: 404 }");

    expectBefore(deleteSource, '.eq("venue_id", venueId)', ".update({");
    expectBefore(deleteSource, '.eq("user_id", sessionUser.id)', ".update({");
    expectBefore(deleteSource, '.is("revoked_at", null)', ".update({");
    expectBefore(deleteSource, "if (findError || !grant)", ".update({");
  });

  it("does not trust request body venue IDs or grant IDs for relinquish", () => {
    expect(deleteSource).not.toContain("request.json()");
    expect(deleteSource).not.toContain("body.");
    expect(deleteSource).not.toContain("grant_id");
    expect(deleteSource).not.toContain("manager_id");
    expect(deleteSource).toContain(".eq(\"id\", grant.id)");
  });

  it("blocks sole owner removal before soft revoke", () => {
    expect(deleteSource).toContain('if (grant.role === "owner")');
    expect(deleteSource).toContain('.select("id", { count: "exact", head: true })');
    expect(deleteSource).toContain('.eq("venue_id", venueId)');
    expect(deleteSource).toContain('.eq("role", "owner")');
    expect(deleteSource).toContain('.is("revoked_at", null)');
    expect(deleteSource).toContain("if (count === 1)");
    expect(deleteSource).toContain("You are the only owner of this venue");
    expect(deleteSource).toContain("{ status: 400 }");

    expectBefore(deleteSource, 'if (grant.role === "owner")', ".update({");
    expectBefore(deleteSource, "if (count === 1)", ".update({");
    expectBefore(deleteSource, "You are the only owner of this venue", ".update({");
  });

  it("soft-revokes only the server-fetched active grant", () => {
    expect(deleteSource).toMatch(
      /\.from\("venue_managers"\)\s*\.update\(\{[\s\S]*revoked_at: new Date\(\)\.toISOString\(\),[\s\S]*revoked_by: sessionUser\.id,[\s\S]*revoked_reason: "User relinquished access",[\s\S]*\}\)\s*\.eq\("id", grant\.id\)/
    );
    expectBefore(deleteSource, "if (findError || !grant)", '.eq("id", grant.id)');
    expectBefore(deleteSource, "if (count === 1)", '.eq("id", grant.id)');
  });

  it("does not use service-role, admin-client fanout, or private fields in responses", () => {
    expect(routeSource).not.toContain("createServiceRoleClient");
    expect(routeSource).not.toContain("getServiceRoleClient");
    expect(routeSource).not.toContain("auth.admin");
    expect(routeSource).not.toContain("sendAdminEmail");
    expect(routeSource).not.toContain("notify");
    expect(routeSource).not.toContain("venueAudit");

    for (const response of jsonResponses(deleteSource)) {
      for (const privateMarker of [
        "venue_managers",
        "sessionUser.id",
        "grant.id",
        "revoked_by",
        "revoked_reason",
        "role",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }

    expect(deleteSource).toContain("success: true");
    expect(deleteSource).toContain("You no longer have access to this venue");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath = "web/src/__tests__/track2-2l14-my-venues-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-MY-VENUES");
    expect(manifestSource).toContain("T2-SR-MY-VENUES");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("sole-owner denial");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
  });
});
