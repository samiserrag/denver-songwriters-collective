import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/events/[id]/comments/route.ts");
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

function handlerSource(handlerName: "GET" | "POST"): string {
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

describe("Track 2 2L.9 public event comments BOLA negative cluster", () => {
  it("denies anonymous member-comment POST before body-derived writes, service-role fallback, or fanout", () => {
    expectBefore(postSource, "supabase.auth.getUser()", 'error: "Unauthorized"');
    expect(postSource).toContain("{ status: 401 }");

    expectBefore(postSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(postSource, 'error: "Unauthorized"', "validateDateKeyForWrite(");
    expectBefore(postSource, 'error: "Unauthorized"', "createServiceRoleClient()");
    expectBefore(postSource, 'error: "Unauthorized"', ".insert({");
    expectBefore(postSource, 'error: "Unauthorized"', "notifyParentCommentAuthor(");
    expectBefore(postSource, 'error: "Unauthorized"', "notifyEventHosts(");
  });

  it("denies unrelated private or invite-only event writers before comment insert or notification fanout", () => {
    expect(postSource).toContain("const { data: userScopedEvent } = await supabase");
    expect(postSource).toContain('.from("events")');
    expect(postSource).toContain('.eq("id", eventId)');
    expect(postSource).toContain('.eq("visibility", "invite_only")');
    expect(postSource).toContain("checkInviteeAccess(eventId, sessionUser.id)");
    expect(postSource).toContain('return NextResponse.json({ error: "Event not found" }, { status: 404 });');

    expectBefore(postSource, "const { data: userScopedEvent }", "createServiceRoleClient()");
    expectBefore(postSource, "checkInviteeAccess(eventId, sessionUser.id)", "event = serviceEvent;");
    expectBefore(postSource, 'error: "Event not found"', ".insert({");
    expectBefore(postSource, 'error: "Event not found"', "notifyParentCommentAuthor(");
    expectBefore(postSource, 'error: "Event not found"', "notifyEventHosts(");
  });

  it("rechecks accepted invitee access before using the service-role event fallback", () => {
    expectBefore(postSource, "createServiceRoleClient()", "checkInviteeAccess(eventId, sessionUser.id)");
    expectBefore(postSource, "checkInviteeAccess(eventId, sessionUser.id)", "if (inviteeResult.hasAccess)");
    expectBefore(postSource, "if (inviteeResult.hasAccess)", "event = serviceEvent;");
    expectBefore(postSource, "event = serviceEvent;", ".insert({");

    expect(inviteeHelperSource).toContain("createServiceRoleClient");
    expect(inviteeHelperSource).toContain('.eq("event_id", eventId)');
    expect(inviteeHelperSource).toContain('.eq("user_id", userId)');
    expect(inviteeHelperSource).toContain('.eq("id", cookiePayload.invite_id)');
    expect(inviteeHelperSource).toContain('.eq("status", "accepted")');
    expect(inviteeHelperSource).toContain("!isExpired(invite.expires_at)");
  });

  it("validates date_key against the path event before comment insert or fanout", () => {
    expect(postSource).toContain("date_key: providedDateKey");
    expect(postSource).toContain("validateDateKeyForWrite(eventId, providedDateKey)");
    expect(postSource).toContain("dateKeyErrorResponse(dateKeyResult.error)");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", ".insert({");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", "notifyParentCommentAuthor(");
    expectBefore(postSource, "validateDateKeyForWrite(eventId, providedDateKey)", "notifyEventHosts(");

    expect(getSource).toContain("resolveEffectiveDateKey(eventId, providedDateKey)");
    expectBefore(getSource, "checkEventAccess(supabase, eventId)", '.from("event_comments")');
  });

  it("uses the path event ID, server session user, and effective date for comment insert", () => {
    expect(postSource).not.toContain("body.event_id");
    expect(postSource).toContain("event_id: eventId");
    expect(postSource).toContain("user_id: sessionUser.id");
    expect(postSource).toContain("date_key: effectiveDateKey");
    expectBefore(postSource, "const { effectiveDateKey } = dateKeyResult;", ".insert({");
  });

  it("requires parent replies to belong to the same path event and occurrence before insert or fanout", () => {
    expect(postSource).toMatch(
      /if \(parent_id\) \{\s*const \{ data: parentComment \} = await supabase\s*\.from\("event_comments"\)\s*\.select\("id"\)\s*\.eq\("id", parent_id\)\s*\.eq\("event_id", eventId\)\s*\.eq\("date_key", effectiveDateKey\)\s*\.eq\("is_hidden", false\)\s*\.eq\("is_deleted", false\)\s*\.maybeSingle\(\);/
    );
    expect(postSource).toContain('return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });');
    expectBefore(postSource, '"Parent comment not found"', ".insert({");
    expectBefore(postSource, '"Parent comment not found"', "notifyParentCommentAuthor(");
    expectBefore(postSource, '"Parent comment not found"', "notifyEventHosts(");
  });

  it("keeps parent notification lookup behind successful authorized insert", () => {
    expectBefore(postSource, "if (parent_id)", ".insert({");
    expectBefore(postSource, ".insert({", "notifyParentCommentAuthor(");
    expectBefore(postSource, "if (error)", "notifyParentCommentAuthor(");
    expectBefore(postSource, "if (error)", "notifyEventHosts(");
  });

  it("does not leak private event fields or service-event payloads in JSON responses", () => {
    const responseBodies = [
      ...jsonResponseArguments(getSource),
      ...jsonResponseArguments(postSource),
    ];

    for (const responseBody of responseBodies) {
      expect(responseBody).not.toContain("event.title");
      expect(responseBody).not.toContain("event.slug");
      expect(responseBody).not.toContain("event.visibility");
      expect(responseBody).not.toContain("serviceEvent");
      expect(responseBody).not.toContain("userScopedEvent");
    }

    expect(postSource).toContain('return NextResponse.json({ error: "Event not found" }, { status: 404 });');
    expect(postSource).toContain('return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });');
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l9-public-event-comments-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PUBLIC-EVENT-COMMENTS");
    expect(manifestSource).toContain("T2-SR-PUBLIC-EVENT-COMMENTS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("parent comment same-event/date denial");
    expect(manifestSource).toContain("parent-comment event/date scope check");
    expect(manifestSource).toContain("parent notification after authorized insert");
  });
});
