import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/events/[id]/claim/route.ts");
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

function handlerSource(handlerName: "POST"): string {
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

const postSource = handlerSource("POST");

describe("Track 2 2L.7 public event claim BOLA negative cluster", () => {
  it("denies anonymous claim submission before body, event, claim, or fanout access", () => {
    expectBefore(postSource, "supabase.auth.getUser()", 'error: "Unauthorized"');
    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', '.from("events")');
    expectBefore(postSource, 'error: "Unauthorized"', '.from("event_claims")');
    expectBefore(postSource, 'error: "Unauthorized"', "notifications.hostClaim(");
    expectBefore(postSource, 'error: "Unauthorized"', "getServiceRoleClient()");
    expect(postSource).toContain("{ status: 401 }");
  });

  it("fails closed for malformed, missing, private, draft, or invite-only event IDs before mutation", () => {
    expect(postSource).toContain("const { id: eventId } = await params;");
    expect(postSource).toMatch(
      /\.from\("events"\)\s*\.select\("id, slug, title, host_id"\)\s*\.eq\("id", eventId\)\s*\.single\(\)/
    );
    expect(postSource).not.toContain("body.event_id");

    expectBefore(postSource, '.eq("id", eventId)', 'error: "Happening not found"');
    expectBefore(postSource, 'error: "Happening not found"', ".insert({");
    expectBefore(postSource, 'error: "Happening not found"', "notifications.hostClaim(");
    expectBefore(postSource, 'error: "Happening not found"', "getServiceRoleClient()");
    expect(postSource).toContain("{ status: 404 }");
  });

  it("denies existing hosts before claim insert or admin email fanout", () => {
    expect(postSource).toContain("if (event.host_id)");
    expect(postSource).toContain('error: "This happening already has a host."');
    expect(postSource).toContain("{ status: 409 }");

    expectBefore(postSource, "if (event.host_id)", ".insert({");
    expectBefore(postSource, 'error: "This happening already has a host."', ".insert({");
    expectBefore(
      postSource,
      'error: "This happening already has a host."',
      "getServiceRoleClient()"
    );
  });

  it("denies duplicate pending or approved claimants before insert or service-role fanout", () => {
    expect(postSource).toContain('.from("event_claims")');
    expect(postSource).toContain('.eq("event_id", event.id)');
    expect(postSource).toContain('.eq("requester_id", sessionUser.id)');
    expect(postSource).toContain('.in("status", ["pending", "approved"])');
    expect(postSource).toContain('error: "You already have a claim for this happening."');

    expectBefore(postSource, ".maybeSingle()", "if (existingClaim)");
    expectBefore(postSource, "if (existingClaim)", ".insert({");
    expectBefore(
      postSource,
      'error: "You already have a claim for this happening."',
      "getServiceRoleClient()"
    );
  });

  it("uses the server-fetched path event for claim insert scope", () => {
    expectBefore(postSource, '.eq("id", eventId)', ".insert({");
    expect(postSource).toContain("event_id: event.id");
    expect(postSource).toContain("requester_id: sessionUser.id");
    expect(postSource).not.toContain("event_id: eventId");
    expect(postSource).not.toContain("requester_id: body");
  });

  it("runs notification and admin email fanout only after an authorized claim insert", () => {
    expectBefore(postSource, ".insert({", "notifications.hostClaim(");
    expectBefore(postSource, "if (claimError || !claim)", "notifications.hostClaim(");
    expectBefore(postSource, ".insert({", "getServiceRoleClient()");
    expectBefore(postSource, "if (claimError || !claim)", "getServiceRoleClient()");
    expectBefore(postSource, "getServiceRoleClient()", "resolveAdminRecipients(serviceRole)");
    expectBefore(
      postSource,
      "resolveAdminRecipients(serviceRole)",
      "sendAdminEmailWithPreferences("
    );
  });

  it("keeps claim error and success responses from exposing private event fields", () => {
    const jsonResponses = [...postSource.matchAll(/NextResponse\.json\(([\s\S]*?)\);/g)].map(
      (match) => match[1]
    );

    expect(jsonResponses.length).toBeGreaterThan(0);
    for (const response of jsonResponses) {
      expect(response).not.toContain("event.title");
      expect(response).not.toContain("event.slug");
      expect(response).not.toContain("event.host_id");
      expect(response).not.toContain("requesterProfile");
    }

    expect(postSource).toContain("claimId: claim.id");
  });

  it("records this negative-test cluster in the 2L matrix and manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l7-public-event-claim-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PUBLIC-EVENT-CLAIM");
    expect(manifestSource).toContain("T2-SR-PUBLIC-EVENT-CLAIM");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("pending/approved duplicate claimant");
    expect(manifestSource).toContain("admin email fanout after insert");
  });
});
