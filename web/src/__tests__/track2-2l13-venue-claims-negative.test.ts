import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/venues/[id]/claim/route.ts");
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

describe("Track 2 2L.13 venue claim BOLA negative cluster", () => {
  it("denies anonymous POST and DELETE before body, claim, manager, or mutation access", () => {
    for (const source of [postSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', '.from("venue_claims")');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', '.from("venue_managers")');
    expectBefore(postSource, 'error: "Unauthorized"', ".insert({");
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
  });

  it("uses the path venue ID for the public-safe venue existence check before claim insert", () => {
    expect(postSource).toContain("const { id: venueId } = await params;");
    expect(postSource).toMatch(
      /\.from\("venues"\)\s*\.select\("id, name"\)\s*\.eq\("id", venueId\)\s*\.single\(\)/
    );
    expect(postSource).not.toContain("body.venue_id");
    expect(postSource).not.toContain("body.id");

    expectBefore(postSource, '.eq("id", venueId)', 'error: "Venue not found"');
    expectBefore(postSource, 'error: "Venue not found"', '.from("venue_claims")');
    expectBefore(postSource, 'error: "Venue not found"', ".insert({");
    expect(postSource).toContain("{ status: 404 }");
  });

  it("denies duplicate pending venue claimants before insert", () => {
    expect(postSource).toContain('.from("venue_claims")');
    expect(postSource).toContain('.eq("venue_id", venueId)');
    expect(postSource).toContain('.eq("requester_id", sessionUser.id)');
    expect(postSource).toContain('.eq("status", "pending")');
    expect(postSource).toContain(
      'error: "You already have a pending claim for this venue"'
    );
    expect(postSource).toContain("{ status: 409 }");

    expectBefore(postSource, "if (existingClaim)", ".insert({");
    expectBefore(
      postSource,
      'error: "You already have a pending claim for this venue"',
      ".insert({"
    );
  });

  it("denies active venue managers while revoked manager grants do not satisfy the manager check", () => {
    expect(postSource).toContain('.from("venue_managers")');
    expect(postSource).toContain('.eq("venue_id", venueId)');
    expect(postSource).toContain('.eq("user_id", sessionUser.id)');
    expect(postSource).toContain('.is("revoked_at", null)');
    expect(postSource).toContain('error: "You already manage this venue"');
    expect(postSource).toContain("{ status: 409 }");

    expectBefore(postSource, "if (existingManager)", ".insert({");
    expectBefore(postSource, 'error: "You already manage this venue"', ".insert({");
  });

  it("inserts claims with the path venue ID and server session user only", () => {
    expectBefore(postSource, '.eq("id", venueId)', ".insert({");
    expect(postSource).toContain("venue_id: venueId");
    expect(postSource).toContain("requester_id: sessionUser.id");
    expect(postSource).not.toContain("venue_id: body");
    expect(postSource).not.toContain("requester_id: body");
  });

  it("cancels only the authenticated user's pending claim for the path venue", () => {
    expect(deleteSource).toContain("const { id: venueId } = await params;");
    expect(deleteSource).toContain('.from("venue_claims")');
    expect(deleteSource).toContain('.eq("venue_id", venueId)');
    expect(deleteSource).toContain('.eq("requester_id", sessionUser.id)');
    expect(deleteSource).toContain('.eq("status", "pending")');
    expect(deleteSource).toContain('error: "No pending claim found to cancel"');
    expect(deleteSource).toContain("{ status: 404 }");
    expect(deleteSource).not.toContain("body.claim");
    expect(deleteSource).not.toContain("body.venue");

    expectBefore(deleteSource, '.eq("venue_id", venueId)', ".update({");
    expectBefore(deleteSource, '.eq("requester_id", sessionUser.id)', ".update({");
    expectBefore(deleteSource, '.eq("status", "pending")', ".update({");
    expect(deleteSource).toMatch(/\.update\(\{[\s\S]*status: "cancelled"[\s\S]*\}\)\s*\.eq\("id", claim\.id\)/);
  });

  it("does not use service-role, admin-client fanout, or private fields in responses", () => {
    expect(routeSource).not.toContain("createServiceRoleClient");
    expect(routeSource).not.toContain("getServiceRoleClient");
    expect(routeSource).not.toContain("auth.admin");
    expect(routeSource).not.toContain("sendAdminEmail");
    expect(routeSource).not.toContain("notify");

    for (const response of [...jsonResponses(postSource), ...jsonResponses(deleteSource)]) {
      for (const privateMarker of [
        "venue.name",
        "venue_managers",
        "requester_id",
        "reviewed_by",
        "rejection_reason",
        "revoked_at",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }

    expect(postSource).toContain("claimId: claim.id");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath = "web/src/__tests__/track2-2l13-venue-claims-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-VENUE-CLAIMS");
    expect(manifestSource).toContain("T2-SR-VENUE-CLAIMS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("own pending path-scoped cancellation");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
  });
});
