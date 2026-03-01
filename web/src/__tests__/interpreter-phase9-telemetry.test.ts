/**
 * Phase 9A — Interpreter telemetry + trace_id correlation tests.
 *
 * Source-code assertion tests verifying:
 * 1. Contract has trace_id field.
 * 2. Interpret route extracts and logs traceId.
 * 3. Telemetry endpoint exists with allowlist, rate limit, no userId logging.
 * 4. UI generates traceId, sends impression/fallback telemetry, passes trace_id in payloads.
 * 5. /api/my-events sanitizes and logs traceId for create outcome correlation.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const CONTRACT_PATH = path.resolve(
  __dirname,
  "../lib/events/interpretEventContract.ts"
);
const contractSource = fs.readFileSync(CONTRACT_PATH, "utf-8");

const INTERPRET_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const interpretRouteSource = fs.readFileSync(INTERPRET_ROUTE_PATH, "utf-8");

const TELEMETRY_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/telemetry/route.ts"
);
const telemetryRouteSource = fs.readFileSync(TELEMETRY_ROUTE_PATH, "utf-8");

const MY_EVENTS_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/my-events/route.ts"
);
const myEventsRouteSource = fs.readFileSync(MY_EVENTS_ROUTE_PATH, "utf-8");

const LAB_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const labSource = fs.readFileSync(LAB_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) Contract — trace_id field
// ---------------------------------------------------------------------------
describe("Phase 9A — contract trace_id", () => {
  it("InterpretEventRequestBody includes trace_id optional string", () => {
    expect(contractSource).toContain("trace_id?: string");
  });
});

// ---------------------------------------------------------------------------
// B) Interpret route — traceId extraction + logging
// ---------------------------------------------------------------------------
describe("Phase 9A — interpret route traceId", () => {
  it("extracts trace_id from body with length validation", () => {
    expect(interpretRouteSource).toContain("body.trace_id");
    expect(interpretRouteSource).toContain(".length <= 64");
  });

  it("logs traceId in all console.info calls", () => {
    // All 5 structured log calls should include traceId
    const infoMatches = interpretRouteSource.match(/console\.info\(\s*"\[events\/interpret\]/g);
    expect(infoMatches).toBeTruthy();
    expect(infoMatches!.length).toBeGreaterThanOrEqual(5);

    // Each console.info block should reference traceId
    const traceIdInLogs = interpretRouteSource.match(/traceId,?\n/g) ||
      interpretRouteSource.match(/traceId[,\s]/g);
    expect(traceIdInLogs).toBeTruthy();
    expect(traceIdInLogs!.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// C) Telemetry endpoint
// ---------------------------------------------------------------------------
describe("Phase 9A — telemetry endpoint", () => {
  it("validates event_name against allowlist", () => {
    expect(telemetryRouteSource).toContain("ALLOWED_EVENTS");
    expect(telemetryRouteSource).toContain("interpreter_impression");
    expect(telemetryRouteSource).toContain("fallback_click");
  });

  it("does NOT log userId (PII-minimal)", () => {
    // The console.info call should not include userId or sessionUser.id
    const logLine = telemetryRouteSource.match(
      /console\.info\([^)]+\)/s
    );
    expect(logLine).toBeTruthy();
    expect(logLine![0]).not.toContain("userId");
    expect(logLine![0]).not.toContain("sessionUser.id");
  });

  it("has rate limiting with serverless caveat comment", () => {
    expect(telemetryRouteSource).toContain("RATE_LIMIT");
    // Must document serverless limitation
    expect(telemetryRouteSource).toMatch(/[Ss]erverless/);
  });

  it("requires authentication", () => {
    expect(telemetryRouteSource).toContain("getUser");
    expect(telemetryRouteSource).toContain("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// D) ConversationalCreateUI — telemetry integration
// ---------------------------------------------------------------------------
describe("Phase 9A — UI telemetry", () => {
  it("generates crypto.randomUUID for traceId", () => {
    expect(labSource).toContain("crypto.randomUUID()");
  });

  it("has useRef one-shot guard for impression dedup (impressionSent)", () => {
    expect(labSource).toContain("impressionSent");
    expect(labSource).toMatch(/useRef\(false\)/);
  });

  it("has sendTelemetry helper", () => {
    expect(labSource).toContain("sendTelemetry");
    expect(labSource).toContain("/api/events/telemetry");
  });

  it("sends interpreter_impression on mount with dedup guard", () => {
    expect(labSource).toContain('sendTelemetry("interpreter_impression")');
    // Dedup guard: check impressionSent.current before sending
    expect(labSource).toContain("impressionSent.current");
  });

  it("sends fallback_click on fallback link click", () => {
    expect(labSource).toContain('sendTelemetry("fallback_click")');
  });

  it("passes trace_id in interpret payload", () => {
    // The payload sent to /api/events/interpret should include trace_id
    expect(labSource).toMatch(/trace_id:\s*traceId/);
  });

  it("passes trace_id in createBody to /api/my-events", () => {
    // createBody should include trace_id for server-side outcome correlation
    const createBodySection = labSource.slice(
      labSource.indexOf("createBody"),
      labSource.indexOf("createBody") + 500
    );
    expect(createBodySection).toContain("trace_id");
  });
});

// ---------------------------------------------------------------------------
// E) /api/my-events — traceId sanitization + logging
// ---------------------------------------------------------------------------
describe("Phase 9A — my-events traceId correlation", () => {
  it("sanitizes traceId with UUID pattern + max 64 chars", () => {
    expect(myEventsRouteSource).toContain("trace_id");
    // UUID hex pattern validation
    expect(myEventsRouteSource).toMatch(/\[a-f0-9-\]\{1,64\}/i);
  });

  it("logs traceId in create success log", () => {
    expect(myEventsRouteSource).toContain("traceId");
    expect(myEventsRouteSource).toMatch(/Event created.*traceId|traceId.*Event created/);
  });

  it("logs traceId in create error log", () => {
    expect(myEventsRouteSource).toMatch(/creation error.*traceId|traceId.*creation error/i);
  });
});
