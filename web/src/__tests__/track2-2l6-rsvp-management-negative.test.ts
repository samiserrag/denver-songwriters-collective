import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/my-events/[id]/rsvps/route.ts");
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

function handlerSource(handlerName: "GET" | "DELETE"): string {
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

const getSource = handlerSource("GET");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.6 host RSVP management BOLA negative cluster", () => {
  it("denies anonymous GET and DELETE before event/date/resource data is exposed", () => {
    for (const source of [getSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', "checkAdminRole(");
      expectBefore(source, 'error: "Unauthorized"', '.from("event_rsvps")');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(getSource, 'error: "Unauthorized"', "resolveEffectiveDateKey(");
    expectBefore(deleteSource, 'error: "Unauthorized"', "request.json()");
  });

  it("requires accepted event host/cohost or admin before GET attendee list access", () => {
    expect(getSource).toContain("const { id: eventId } = await params;");
    expect(getSource).toContain("checkAdminRole(supabase, sessionUser.id)");
    expect(getSource).toContain('.from("event_hosts")');
    expect(getSource).toContain('.eq("event_id", eventId)');
    expect(getSource).toContain('.eq("user_id", sessionUser.id)');
    expect(getSource).toContain('.eq("invitation_status", "accepted")');
    expect(getSource).toContain('return NextResponse.json({ error: "Forbidden" }, { status: 403 });');

    expectBefore(getSource, "if (!hostEntry)", "resolveEffectiveDateKey(");
    expectBefore(getSource, "if (!hostEntry)", '.from("event_rsvps")');
    expectBefore(getSource, "resolveEffectiveDateKey(", '.from("event_rsvps")');
    expect(getSource).not.toContain('.eq("role", "host")');
  });

  it("authorizes before date-key resolution to avoid cross-event date leaks", () => {
    expectBefore(getSource, "checkAdminRole(", "resolveEffectiveDateKey(");
    expectBefore(getSource, '.eq("invitation_status", "accepted")', "resolveEffectiveDateKey(");
    expectBefore(getSource, "if (!hostEntry)", "resolveEffectiveDateKey(");
    expectBefore(getSource, "resolveEffectiveDateKey(eventId, providedDateKey)", "dateKeyErrorResponse(");
  });

  it("requires primary host or admin before DELETE and excludes cohosts", () => {
    expect(deleteSource).toContain("checkAdminRole(supabase, sessionUser.id)");
    expect(deleteSource).toContain('.from("event_hosts")');
    expect(deleteSource).toContain('.eq("event_id", eventId)');
    expect(deleteSource).toContain('.eq("user_id", sessionUser.id)');
    expect(deleteSource).toContain('.eq("invitation_status", "accepted")');
    expect(deleteSource).toContain('.eq("role", "host")');
    expect(deleteSource).toContain('return NextResponse.json({ error: "Forbidden" }, { status: 403 });');

    expectBefore(deleteSource, "if (!hostEntry)", "request.json()");
    expectBefore(deleteSource, "if (!hostEntry)", '.from("event_rsvps")');
    expectBefore(deleteSource, '.eq("role", "host")', "request.json()");
  });

  it("denies missing rsvp_id before RSVP lookup or mutation", () => {
    expectBefore(deleteSource, "request.json()", '.from("event_rsvps")');
    expectBefore(deleteSource, '"rsvp_id required in body"', '.from("event_rsvps")');
    expectBefore(deleteSource, '"rsvp_id required"', '.from("event_rsvps")');
    expectBefore(deleteSource, '"rsvp_id required"', ".update({");
    expect(deleteSource).toContain("{ status: 400 }");
  });

  it("requires rsvp_id to belong to the path event before cancellation/update", () => {
    expect(deleteSource).toMatch(
      /\.from\("event_rsvps"\)\s*\.select\("id, user_id, guest_name, status, date_key"\)\s*\.eq\("id", rsvpId\)\s*\.eq\("event_id", eventId\)/
    );
    expectBefore(deleteSource, '"RSVP not found"', ".update({");
    expect(deleteSource).toContain("{ status: 404 }");

    expect(deleteSource).toMatch(
      /\.from\("event_rsvps"\)\s*\.update\(\{[\s\S]*?\}\)\s*\.eq\("id", rsvpId\)\s*\.eq\("event_id", eventId\)/
    );
  });

  it("does not cancel already inactive RSVPs again", () => {
    expect(deleteSource).toContain('["confirmed", "waitlist", "offered"].includes(rsvp.status)');
    expect(deleteSource).toContain("RSVP is already");
    expect(deleteSource).toContain("{ status: 400 }");
    expectBefore(deleteSource, "RSVP is already", ".update({");
    expectBefore(deleteSource, "RSVP is already", "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, "RSVP is already", "sendOfferNotifications(");
  });

  it("runs waitlist promotion only after authorized event-scoped cancellation", () => {
    expectBefore(deleteSource, "if (!hostEntry)", "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, '"RSVP not found"', "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, ".update({", "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, '.eq("event_id", eventId)', "promoteNextWaitlistPerson(");
    expect(deleteSource).toContain(
      "promoteNextWaitlistPerson(\n        supabase, eventId, rsvp.date_key, rsvpId"
    );
    expect(deleteSource).toContain(
      "sendOfferNotifications(\n            supabase, eventId, promotedRsvp.user_id,"
    );
  });

  it("records this negative-test cluster in the 2L matrix and manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l6-rsvp-management-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-MY-EVENTS-RSVPS");
    expect(manifestSource).toContain("T2-SR-MY-EVENTS-RSVPS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("date-key resolution after authorization");
    expect(manifestSource).toContain("waitlist promotion caller coverage");
  });
});
