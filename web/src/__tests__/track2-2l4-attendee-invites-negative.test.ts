import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(
  WEB_SRC,
  "app/api/my-events/[id]/attendee-invites/route.ts"
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
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function sliceBetween(startNeedle: string, endNeedle: string): string {
  const start = routeSource.indexOf(startNeedle);
  expect(start, `Missing start marker ${startNeedle}`).toBeGreaterThanOrEqual(0);

  const end = routeSource.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `Missing end marker ${endNeedle}`).toBeGreaterThan(start);

  return routeSource.slice(start, end);
}

function handlerSource(handlerName: "POST" | "GET" | "PATCH"): string {
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

const authHelperSource = sliceBetween(
  "async function checkAttendeeInviteAuth(",
  "async function resolveMemberEmail("
);
const postSource = handlerSource("POST");
const getSource = handlerSource("GET");
const patchSource = handlerSource("PATCH");

describe("Track 2 2L.4 attendee invite BOLA negative cluster", () => {
  it("keeps cohosts and unrelated users out of attendee invite management", () => {
    expect(routeSource).toContain("Co-hosts are NOT allowed");
    expect(authHelperSource).toContain("checkAdminRole(supabase, userId)");
    expect(authHelperSource).toContain('.from("events")');
    expect(authHelperSource).toContain('.eq("id", eventId)');
    expect(authHelperSource).toContain("event.host_id === userId");
    expect(authHelperSource).toContain("return { authorized: false, event };");
    expect(authHelperSource).not.toContain("event_hosts");
  });

  it("denies unauthenticated access before any attendee invite service-role use", () => {
    for (const source of [postSource, getSource, patchSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', "checkAttendeeInviteAuth(");
      expectBefore(source, 'error: "Unauthorized"', "createServiceRoleClient()");
      expect(source).toContain("{ status: 401 }");
    }
  });

  it("authorizes the path event before list, create, or revoke service-role access", () => {
    for (const source of [postSource, getSource, patchSource]) {
      expect(source).toContain("const { id: eventId } = await params;");
      expect(source).toContain("checkAttendeeInviteAuth(");
      expect(source).toContain("eventId,");
      expect(source).toContain("sessionUser.id");
      expectBefore(source, "checkAttendeeInviteAuth(", "createServiceRoleClient()");
      expectBefore(source, "if (!authorized)", "createServiceRoleClient()");
      expect(source).not.toContain("body.event_id");
    }
  });

  it("returns method-specific 403s for cohost or unrelated-user management attempts", () => {
    expect(postSource).toContain(
      "Only admins or the primary host can manage attendee invites"
    );
    expect(getSource).toContain(
      "Only admins or the primary host can view attendee invites"
    );
    expect(patchSource).toContain(
      "Only admins or the primary host can revoke attendee invites"
    );

    for (const source of [postSource, getSource, patchSource]) {
      expect(source).toContain("{ status: 403 }");
      expectBefore(source, "{ status: 403 }", "createServiceRoleClient()");
    }
  });

  it("prevents an event A host from managing event B attendee invites", () => {
    expect(authHelperSource).toContain('.eq("id", eventId)');
    expect(authHelperSource).toContain("event.host_id === userId");

    expect(postSource).toContain(".eq(\"event_id\", eventId)");
    expect(getSource).toContain(".eq(\"event_id\", eventId)");
    expect(patchSource).toContain(".eq(\"event_id\", eventId)");

    expectBefore(postSource, "checkAttendeeInviteAuth(", ".insert({");
    expectBefore(getSource, "checkAttendeeInviteAuth(", ".select(\"id, event_id");
    expectBefore(patchSource, "checkAttendeeInviteAuth(", ".update({");
  });

  it("denies invite_id/path event mismatches before service-role mutation", () => {
    expect(patchSource).toContain("const inviteId = body.invite_id?.trim();");
    expect(patchSource).toContain('"invite_id is required"');
    expectBefore(patchSource, '.eq("id", inviteId)', '.eq("event_id", eventId)');
    expectBefore(patchSource, '.eq("event_id", eventId)', ".update({");
    expectBefore(patchSource, '"Invite not found"', ".update({");
    expect(patchSource).toContain("{ status: 404 }");
  });

  it("records this first negative-test cluster in the 2L matrix and manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l4-attendee-invites-negative.test.ts";

    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("Cohost denial");
    expect(manifestSource).toContain("cross-event host denial");
  });
});
