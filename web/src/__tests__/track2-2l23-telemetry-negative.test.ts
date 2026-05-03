import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const TELEMETRY_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/events/telemetry/route.ts",
);
const EDIT_TURN_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/events/telemetry/edit-turn/route.ts",
);
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md",
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md",
);

const telemetrySource = readFileSync(TELEMETRY_ROUTE_PATH, "utf-8");
const editTurnSource = readFileSync(EDIT_TURN_ROUTE_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function expectBefore(source: string, before: string, after: string): void {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  expect(beforeIndex, `Missing before marker ${before}`).toBeGreaterThanOrEqual(0);
  expect(afterIndex, `Missing after marker ${after}`).toBeGreaterThanOrEqual(0);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(
    afterIndex,
  );
}

function jsonResponses(source: string): string[] {
  return [...source.matchAll(/NextResponse\.json\(([\s\S]*?)\);/g)].map(
    (match) => match[1],
  );
}

function consoleInfoBlocks(source: string): string[] {
  return [...source.matchAll(/console\.info\(([\s\S]*?)\);/g)].map(
    (match) => match[1],
  );
}

describe("Track 2 2L.23 telemetry BOLA negative cluster", () => {
  it("denies anonymous actors before body parsing or telemetry side effects", () => {
    for (const source of [telemetrySource, editTurnSource]) {
      expect(source).toContain("createSupabaseServerClient()");
      expect(source).toContain("supabase.auth.getUser()");
      expect(source).toContain('error: "Unauthorized"');
      expect(source).toContain("{ status: 401 }");
      expectBefore(source, "supabase.auth.getUser()", "request.json()");
      expectBefore(source, 'error: "Unauthorized"', "request.json()");
    }

    expectBefore(telemetrySource, 'error: "Unauthorized"', "console.info(");
    expectBefore(editTurnSource, 'error: "Unauthorized"', "emitEditTurnOutcome(");
  });

  it("validates telemetry registry fields before console emission", () => {
    expect(telemetrySource).toContain("ALLOWED_EVENTS");
    expect(telemetrySource).toContain("interpreter_impression");
    expect(telemetrySource).toContain("fallback_click");
    expect(telemetrySource).toContain("trace_id");
    expect(telemetrySource).toContain("event_name");
    expect(telemetrySource).toContain("timestamp");

    expectBefore(telemetrySource, "checkRateLimit(sessionUser.id)", "request.json()");
    expectBefore(telemetrySource, "if (!traceId || !eventName || !timestamp)", "console.info(");
    expectBefore(telemetrySource, "if (!ALLOWED_EVENTS.has(eventName))", "console.info(");

    for (const block of consoleInfoBlocks(telemetrySource)) {
      expect(block).not.toContain("userId");
      expect(block).not.toContain("sessionUser.id");
      expect(block).not.toContain("email");
      expect(block).not.toContain("token");
    }
  });

  it("validates edit-turn correlation fields and ignores client-supplied timestamps before emit", () => {
    expect(editTurnSource).toContain("UUID_V4_RE");
    expect(editTurnSource).toContain("isDefinitiveOutcome(userOutcome)");
    expect(editTurnSource).toContain('value === "accepted"');
    expect(editTurnSource).toContain('value === "rejected"');
    expect(editTurnSource).toContain("const { turnId, userOutcome } = b");
    expect(editTurnSource).not.toContain("b.occurredAt");

    expectBefore(editTurnSource, "if (typeof turnId !== \"string\"", "emitEditTurnOutcome(");
    expectBefore(editTurnSource, "if (!isDefinitiveOutcome(userOutcome))", "emitEditTurnOutcome(");
    expect(editTurnSource).toContain(
      "emitEditTurnOutcome(buildEditTurnOutcomeEvent({ turnId, userOutcome }))",
    );
  });

  it("keeps telemetry routes free of privileged clients, durable writes, and pre-auth fanout", () => {
    for (const source of [telemetrySource, editTurnSource]) {
      for (const forbiddenMarker of [
        "createServiceRoleClient",
        "getServiceRoleClient",
        "auth.admin",
        "SUPABASE_SERVICE_ROLE_KEY",
        ".from(",
        "sendEmail(",
        "fetch(",
        "opsAudit",
        "venueAudit",
      ]) {
        expect(source).not.toContain(forbiddenMarker);
      }
    }

    expectBefore(telemetrySource, "if (!ALLOWED_EVENTS.has(eventName))", "console.info(");
    expectBefore(editTurnSource, "if (!isDefinitiveOutcome(userOutcome))", "emitEditTurnOutcome(");
  });

  it("keeps responses minimal and free of private identifiers or tokens", () => {
    for (const response of [
      ...jsonResponses(telemetrySource),
      ...jsonResponses(editTurnSource),
    ]) {
      for (const privateMarker of [
        "sessionUser",
        "userId",
        "email",
        "token",
        "access_token",
        "refresh_token",
        "service_role",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]) {
        expect(response).not.toContain(privateMarker);
      }
    }
  });

  it("records this source-contract cluster in the 2L matrix and manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l23-telemetry-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-TELEMETRY");
    expect(manifestSource).toContain("T2-SR-TELEMETRY");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("auth-before-parse");
    expect(manifestSource).toContain("No service-role or auth-admin usage");
    expect(manifestSource).toContain("full telemetry route-invocation coverage");
  });
});
