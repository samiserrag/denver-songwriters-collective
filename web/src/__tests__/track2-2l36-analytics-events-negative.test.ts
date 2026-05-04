import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md",
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md",
);
const ANALYTICS_EVENTS_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/analytics/events/route.ts",
);

const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function rowFor(source: string, id: string): string {
  const row = source
    .split("\n")
    .find((line) => line.startsWith(`| ${id} |`));

  expect(row, `Missing row ${id}`).toBeDefined();
  return row ?? "";
}

describe("Track 2 2L.36 analytics events BOLA planned gate", () => {
  it("keeps the future analytics-events route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(ANALYTICS_EVENTS_ROUTE_PATH),
      "Implementing analytics events requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future analytics event intake", () => {
    const row = rowFor(matrixSource, "T2-BOLA-ANALYTICS-EVENTS");

    expect(row).toContain("web/src/app/api/analytics/events/route.ts");
    expect(row).toContain("analytics event IDs, event IDs, session/visitor IDs");
    expect(row).toContain("Event registry with allowlisted event_name/property schema");
    expect(row).toContain("write-time redaction before persistence/logging");
    expect(row).toContain("GPC opt-out stops non-essential client analytics");
    expect(row).toContain("no raw IP storage");
    expect(row).toContain("no long-term user-agent storage");
    expect(row).toContain("no free-form payloads");
    expect(row).toContain("bot/internal/AI-crawler paths separated from human metrics");
    expect(row).toContain("no service-role/admin-client usage in v1 without approved manifest update");
    expect(row).toContain(
      "web/src/__tests__/track2-2l36-analytics-events-negative.test.ts",
    );
  });

  it("pins required future negative cases before analytics event intake can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-ANALYTICS-EVENTS");

    for (const expected of [
      "malformed payload rejection before privileged work",
      "unknown event_name/property rejection",
      "PII/email/phone/token/query-secret/long-free-text redaction",
      "GPC no-op",
      "no raw IP or durable user-agent storage",
      "bot/internal/AI-crawler events filtered from human metrics",
      "event/resource context treated as correlation-only unless authorized",
      "no body/session/visitor ID trust for authorization",
      "no free-form analytics payloads",
      "no fanout/email/audit/privileged side effect before validation",
      "no service-role/auth-admin creep",
      "route-level analytics-event tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as unprivileged and registry-gated", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-ANALYTICS-EVENTS");

    expect(row).toContain("web/src/app/api/analytics/events/route.ts");
    expect(row).toContain("Client analytics honors GPC opt-out before parsing or persistence");
    expect(row).toContain("server/internal/AI crawler paths separated from human metrics");
    expect(row).toContain("no privileged actor identity, service-role, or auth-admin expected in v1");
    expect(row).toContain("Event names and properties must match the registry");
    expect(row).toContain("no free-form payloads or raw identifiers");
    expect(row).toContain("event/resource context is correlation-only unless a future route explicitly authorizes mutation");
    expect(row).toContain("body/session/visitor IDs are untrusted for authorization");
    expect(row).toContain("analytics raw events and aggregate tables only");
    expect(row).toContain("no service-role usage without approved manifest update");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("write-time redaction");
    expect(row).toContain("no data sale, retargeting, demographic profiling, individual behavior dashboard");
    expect(row).toContain("without PII, tokens, raw IPs, long-term user-agent storage");
    expect(row).toContain("query secrets, long free text, raw bodies, or private rows");
    expect(row).toContain(
      "web/src/__tests__/track2-2l36-analytics-events-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client implementation drift in the manifest row", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-ANALYTICS-EVENTS");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
