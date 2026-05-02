import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/my-events/[id]/cohosts/route.ts");
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

const postSource = handlerSource("POST");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.5 cohost management BOLA negative cluster", () => {
  it("denies anonymous cohost invite and removal before admin or service-role access", () => {
    for (const source of [postSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expectBefore(source, 'error: "Unauthorized"', "checkAdminRole(");
      expectBefore(source, 'error: "Unauthorized"', "createServiceRoleClient()");
      expect(source).toContain("{ status: 401 }");
    }
  });

  it("requires accepted event-scoped host/cohost status before invite service-role access", () => {
    expect(postSource).toContain("const { id: eventId } = await params;");
    expect(postSource).toContain('.from("event_hosts")');
    expect(postSource).toContain('.eq("event_id", eventId)');
    expect(postSource).toContain('.eq("user_id", sessionUser.id)');
    expect(postSource).toContain('.eq("invitation_status", "accepted")');
    expect(postSource).toContain("Only hosts can invite co-hosts");
    expect(postSource).toContain("{ status: 403 }");

    expectBefore(postSource, '.eq("invitation_status", "accepted")', "if (!hostEntry)");
    expectBefore(postSource, "if (!hostEntry)", "createServiceRoleClient()");
    expectBefore(postSource, "checkAdminRole(", ".insert({");
    expectBefore(postSource, "if (!hostEntry)", ".insert({");
    expect(postSource).not.toContain("body.event_id");
    expect(postSource).toContain("event_id: eventId");
  });

  it("keeps event A actors from mutating event B cohost rows", () => {
    expect(deleteSource).toContain("const { id: eventId } = await params;");
    expect(deleteSource).toContain('.eq("event_id", eventId)');
    expect(deleteSource).toContain('.eq("user_id", user_id)');
    expect(deleteSource).toContain('.eq("user_id", sessionUser.id)');

    expectBefore(deleteSource, '.eq("event_id", eventId)', ".delete()");
    expectBefore(deleteSource, "if (!targetHostEntry)", ".delete()");
    expectBefore(deleteSource, "if (!callerHostEntry)", ".delete()");
    expect(deleteSource).not.toContain("body.event_id");
  });

  it("denies pending, rejected, or stale cohosts from invite and remove-other management", () => {
    expect(postSource).toContain('.eq("invitation_status", "accepted")');
    expectBefore(postSource, '.eq("invitation_status", "accepted")', "createServiceRoleClient()");

    expect(deleteSource).toContain("if (!isAdmin && !isSelfRemoval)");
    expect(deleteSource).toContain('.eq("invitation_status", "accepted")');
    expect(deleteSource).toContain('.eq("role", "host")');
    expect(deleteSource).toContain("Only primary hosts can remove co-hosts");
    expectBefore(deleteSource, '.eq("invitation_status", "accepted")', ".delete()");
    expectBefore(deleteSource, '.eq("role", "host")', ".delete()");
  });

  it("prevents a cohost from removing another cohost or primary host", () => {
    expect(deleteSource).toContain("if (!isAdmin && !isSelfRemoval)");
    expect(deleteSource).toContain('.eq("role", "host")');
    expect(deleteSource).toContain("Only primary hosts can remove co-hosts");
    expect(deleteSource).toContain('if (targetRole === "host")');
    expect(deleteSource).toContain(
      "Primary hosts cannot remove other primary hosts"
    );

    expectBefore(deleteSource, "if (!callerHostEntry)", ".delete()");
    expectBefore(deleteSource, 'if (targetRole === "host")', ".delete()");
  });

  it("denies path event ID and target row mismatches before service-role mutation", () => {
    expectBefore(deleteSource, '.eq("event_id", eventId)', '.eq("user_id", user_id)');
    expectBefore(deleteSource, '.eq("user_id", user_id)', "if (!targetHostEntry)");
    expectBefore(deleteSource, '"Host entry not found"', ".delete()");
    expect(deleteSource).toContain("{ status: 404 }");

    expect(deleteSource).toMatch(
      /\.from\("event_hosts"\)\s*\.delete\(\)\s*\.eq\("event_id", eventId\)\s*\.eq\("user_id", user_id\)/
    );
  });

  it("keeps service-role writes behind route-local actor and object checks", () => {
    expectBefore(postSource, 'error: "Unauthorized"', ".insert({");
    expectBefore(postSource, "checkAdminRole(", ".insert({");
    expectBefore(postSource, "if (!hostEntry)", ".insert({");
    expectBefore(postSource, '.eq("event_id", eventId)', ".insert({");

    expectBefore(deleteSource, 'error: "Unauthorized"', ".delete()");
    expectBefore(deleteSource, "checkAdminRole(", ".delete()");
    expectBefore(deleteSource, "if (!targetHostEntry)", ".delete()");
    expectBefore(deleteSource, "if (!callerHostEntry)", ".delete()");
    expectBefore(deleteSource, "if (!selfHostEntry)", ".delete()");
  });

  it("records this negative-test cluster in the 2L matrix and manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l5-cohost-management-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-MY-EVENTS-COHOSTS");
    expect(manifestSource).toContain("T2-SR-EVENT-COHOSTS");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("pending/rejected/stale cohost");
    expect(manifestSource).toContain("target row/path mismatch");
  });
});
