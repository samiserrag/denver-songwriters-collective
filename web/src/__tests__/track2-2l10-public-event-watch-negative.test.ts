import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/events/[id]/watch/route.ts");
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

function handlerSource(handlerName: "GET" | "POST" | "DELETE"): string {
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
const postSource = handlerSource("POST");
const deleteSource = handlerSource("DELETE");

describe("Track 2 2L.10 public event watch BOLA negative cluster", () => {
  it("keeps unauthenticated behavior explicit before watcher rows are queried or changed", () => {
    expectBefore(getSource, "supabase.auth.getUser()", "return NextResponse.json({ watching: false });");
    expectBefore(getSource, "return NextResponse.json({ watching: false });", '.from("event_watchers")');

    for (const source of [postSource, deleteSource]) {
      expectBefore(source, "supabase.auth.getUser()", 'error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
      expectBefore(source, 'error: "Unauthorized"', '.from("events")');
      expectBefore(source, 'error: "Unauthorized"', '.from("event_watchers")');
    }
  });

  it("requires admin and a user-visible path event before creating a watcher row", () => {
    expect(postSource).toContain("checkAdminRole(supabase, sessionUser.id)");
    expect(postSource).toContain('return NextResponse.json({ error: "Admin only" }, { status: 403 });');
    expectBefore(postSource, "checkAdminRole(supabase, sessionUser.id)", '.from("events")');
    expectBefore(postSource, 'error: "Admin only"', '.from("events")');
    expectBefore(postSource, 'error: "Event not found"', ".insert({");

    expect(postSource).toMatch(
      /\.from\("events"\)\s*\.select\("id"\)\s*\.eq\("id", eventId\)\s*\.single\(\)/
    );
    expect(postSource).toMatch(
      /\.from\("event_watchers"\)\s*\.insert\(\{ event_id: eventId, user_id: sessionUser\.id \}\)/
    );
  });

  it("does not reveal watcher state for an inaccessible path event", () => {
    expect(getSource).toMatch(
      /\.from\("events"\)\s*\.select\("id"\)\s*\.eq\("id", eventId\)\s*\.single\(\)/
    );
    expect(getSource).toContain("if (!event)");
    expectBefore(getSource, "if (!event)", '.from("event_watchers")');
    expectBefore(getSource, "if (!event)", "return NextResponse.json({ watching: !!data });");
  });

  it("requires a user-visible path event before removing a watcher row", () => {
    expect(deleteSource).toMatch(
      /\.from\("events"\)\s*\.select\("id"\)\s*\.eq\("id", eventId\)\s*\.single\(\)/
    );
    expect(deleteSource).toContain('return NextResponse.json({ error: "Event not found" }, { status: 404 });');
    expectBefore(deleteSource, 'error: "Event not found"', ".delete()");
    expectBefore(deleteSource, 'error: "Event not found"', "return NextResponse.json({ success: true, watching: false });");
  });

  it("scopes watcher insert and delete to the path event and authenticated user only", () => {
    expect(routeSource).not.toContain("request.json()");
    expect(routeSource).not.toContain("body.event_id");
    expect(routeSource).not.toContain("watcher_id");

    expect(postSource).toContain("event_id: eventId");
    expect(postSource).toContain("user_id: sessionUser.id");
    expect(deleteSource).toMatch(
      /\.from\("event_watchers"\)\s*\.delete\(\)\s*\.eq\("event_id", eventId\)\s*\.eq\("user_id", sessionUser\.id\)/
    );
  });

  it("does not add privileged client usage or notification fanout to the watch route", () => {
    expect(routeSource).not.toContain("createServiceRoleClient");
    expect(routeSource).not.toContain("getServiceRoleClient");
    expect(routeSource).not.toContain("auth.admin");
    expect(routeSource).not.toContain("sendEmail");
    expect(routeSource).not.toContain("notify");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l10-public-event-watch-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PUBLIC-EVENT-WATCH");
    expect(manifestSource).toContain("T2-SR-PUBLIC-EVENT-WATCH");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("event-access check before watch status/insert/delete");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
  });
});
