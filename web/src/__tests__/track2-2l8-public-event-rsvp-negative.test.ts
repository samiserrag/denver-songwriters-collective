import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/events/[id]/rsvp/route.ts");
const INVITEE_HELPER_PATH = join(
  WEB_SRC,
  "lib/attendee-session/checkInviteeAccess.ts"
);
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const routeSource = readFileSync(ROUTE_PATH, "utf-8");
const inviteeHelperSource = readFileSync(INVITEE_HELPER_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function handlerSource(handlerName: "GET" | "POST" | "DELETE" | "PATCH"): string {
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

function jsonResponseArguments(source: string): string[] {
  const matches = [...source.matchAll(/NextResponse\.json\(([\s\S]*?)\);/g)];
  expect(matches.length).toBeGreaterThan(0);
  return matches.map((match) => match[1]);
}

const getSource = handlerSource("GET");
const postSource = handlerSource("POST");
const deleteSource = handlerSource("DELETE");
const patchSource = handlerSource("PATCH");

describe("Track 2 2L.8 public event RSVP BOLA negative cluster", () => {
  it("denies anonymous writes before body parsing, mutation, service-role fallback, or fanout", () => {
    for (const source of [postSource, deleteSource, patchSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
    }

    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', "validateDateKeyForWrite(");
    expectBefore(postSource, 'error: "Unauthorized"', '.from("event_rsvps")');
    expectBefore(postSource, 'error: "Unauthorized"', "createServiceRoleClient()");
    expectBefore(postSource, 'error: "Unauthorized"', ".insert({");
    expectBefore(postSource, 'error: "Unauthorized"', "notifyHostsOfRsvp(");

    expectBefore(deleteSource, 'error: "Unauthorized"', "new URL(request.url)");
    expectBefore(deleteSource, 'error: "Unauthorized"', '.from("event_rsvps")');
    expectBefore(deleteSource, 'error: "Unauthorized"', ".update({");
    expectBefore(deleteSource, 'error: "Unauthorized"', "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, 'error: "Unauthorized"', "sendOfferNotifications(");

    expectBefore(patchSource, 'error: "Unauthorized"', "new URL(request.url)");
    expectBefore(patchSource, 'error: "Unauthorized"', "processExpiredOffers(");
    expectBefore(patchSource, 'error: "Unauthorized"', "confirmOffer(");
  });

  it("denies unrelated private or invite-only event writers before RSVP mutation or fanout", () => {
    expect(postSource).toContain("const { data: userScopedEvent } = await supabase");
    expect(postSource).toContain('.from("events")');
    expect(postSource).toContain('.eq("id", eventId)');
    expect(postSource).toContain('.eq("visibility", "invite_only")');
    expect(postSource).toContain("checkInviteeAccess(eventId, sessionUser.id)");
    expect(postSource).toContain('return NextResponse.json({ error: "Event not found" }, { status: 404 });');

    expectBefore(postSource, "const { data: userScopedEvent }", "createServiceRoleClient()");
    expectBefore(postSource, "checkInviteeAccess(eventId, sessionUser.id)", "event = serviceEvent;");
    expectBefore(postSource, 'error: "Event not found"', ".insert({");
    expectBefore(postSource, 'error: "Event not found"', ".update({");
    expectBefore(postSource, 'error: "Event not found"', "sendEmail({");
    expectBefore(postSource, 'error: "Event not found"', "notifyHostsOfRsvp(");
  });

  it("allows the accepted invitee path only after event-scoped invite access is rechecked", () => {
    expectBefore(postSource, "createServiceRoleClient()", "checkInviteeAccess(eventId, sessionUser.id)");
    expectBefore(postSource, "checkInviteeAccess(eventId, sessionUser.id)", "if (inviteeResult.hasAccess)");
    expectBefore(postSource, "if (inviteeResult.hasAccess)", "event = serviceEvent;");
    expectBefore(postSource, "event = serviceEvent;", ".insert({");

    expect(inviteeHelperSource).toContain('createServiceRoleClient');
    expect(inviteeHelperSource).toContain('.eq("event_id", eventId)');
    expect(inviteeHelperSource).toContain('.eq("user_id", userId)');
    expect(inviteeHelperSource).toContain('.eq("id", cookiePayload.invite_id)');
    expect(inviteeHelperSource).toContain('.eq("status", "accepted")');
    expect(inviteeHelperSource).toContain("!isExpired(invite.expires_at)");
  });

  it("validates date_key against the path event before public RSVP writes", () => {
    expect(postSource).toContain("const providedDateKey = body.date_key || null;");
    expect(postSource).toContain("validateDateKeyForWrite(eventId, providedDateKey)");
    expect(postSource).toContain("dateKeyErrorResponse(dateKeyResult.error)");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", '.from("event_rsvps")');
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", ".insert({");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", ".update({");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", "notifyHostsOfRsvp(");

    for (const source of [deleteSource, patchSource]) {
      expect(source).toContain("resolveEffectiveDateKey(eventId, providedDateKey)");
      expectBefore(source, "resolveEffectiveDateKey(eventId, providedDateKey)", '.from("event_rsvps")');
    }
  });

  it("uses the path event ID and server-derived date/user scope for RSVP insert, reactivation, and cancellation", () => {
    expect(postSource).not.toContain("body.event_id");
    expect(postSource).toContain("event_id: eventId");
    expect(postSource).toContain("user_id: sessionUser.id");
    expect(postSource).toContain("date_key: effectiveDateKey");
    expect(postSource).toContain('.eq("event_id", eventId)');
    expect(postSource).toContain('.eq("date_key", effectiveDateKey)');
    expect(postSource).toContain('.eq("user_id", sessionUser.id)');

    expect(postSource).toMatch(
      /\.from\("event_rsvps"\)\s*\.update\(\{[\s\S]*?\}\)\s*\.eq\("id", existing\.id\)\s*\.eq\("event_id", eventId\)\s*\.eq\("date_key", effectiveDateKey\)\s*\.eq\("user_id", sessionUser\.id\)/
    );

    expect(deleteSource).toMatch(
      /\.from\("event_rsvps"\)\s*\.update\(\{[\s\S]*?\}\)\s*\.eq\("id", currentRsvp\.id\)\s*\.eq\("event_id", eventId\)\s*\.eq\("date_key", effectiveDateKey\)\s*\.eq\("user_id", sessionUser\.id\)/
    );
  });

  it("keeps service-role fallback and notification fanout behind route-local access checks", () => {
    expectBefore(postSource, 'error: "Unauthorized"', "createServiceRoleClient()");
    expectBefore(postSource, "const { data: userScopedEvent }", "createServiceRoleClient()");
    expectBefore(postSource, "checkInviteeAccess(eventId, sessionUser.id)", "event = serviceEvent;");
    expectBefore(postSource, 'error: "Event not found"', ".insert({");
    expectBefore(postSource, "if (rsvpError)", "sendEmail({");
    expectBefore(postSource, "if (rsvpError)", "notifyHostsOfRsvp(");

    expectBefore(deleteSource, '"No RSVP found for this occurrence"', ".update({");
    expectBefore(deleteSource, '"No RSVP found for this occurrence"', "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, ".update({", "promoteNextWaitlistPerson(");
    expectBefore(deleteSource, "promoteNextWaitlistPerson(", "sendOfferNotifications(");
  });

  it("denies revoked or expired invites through the accepted-status and expiry helper checks", () => {
    expect(inviteeHelperSource).toContain('.eq("status", "accepted")');
    expect(inviteeHelperSource).toContain("expires_at");
    expect(inviteeHelperSource).toContain("isExpired");
    expect(inviteeHelperSource).toContain("return { hasAccess: false };");
  });

  it("does not leak private event fields through RSVP JSON responses", () => {
    const responseBodies = [
      ...jsonResponseArguments(getSource),
      ...jsonResponseArguments(postSource),
      ...jsonResponseArguments(deleteSource),
      ...jsonResponseArguments(patchSource),
    ];

    for (const responseBody of responseBodies) {
      expect(responseBody).not.toContain("event.title");
      expect(responseBody).not.toContain("event.slug");
      expect(responseBody).not.toContain("event.venue_name");
      expect(responseBody).not.toContain("event.venue_address");
      expect(responseBody).not.toContain("serviceEvent");
      expect(responseBody).not.toContain("userScopedEvent");
    }

    expect(postSource).toContain('return NextResponse.json({ error: "Event not found" }, { status: 404 });');
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l8-public-event-rsvp-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PUBLIC-EVENT-RSVP");
    expect(manifestSource).toContain("T2-SR-PUBLIC-EVENT-RSVP");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("revoked/expired invite denial");
    expect(matrixSource).toContain("path-scoped RSVP reactivation/cancellation");
    expect(manifestSource).toContain("route-local access checks before service-role fallback");
    expect(manifestSource).toContain("path-scoped reactivation/cancellation predicates");
  });
});
