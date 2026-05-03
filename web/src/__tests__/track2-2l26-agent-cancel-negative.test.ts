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
const CANCEL_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/my-events/[id]/cancel/route.ts",
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

describe("Track 2 2L.26 agent cancel BOLA planned gate", () => {
  it("keeps the future cancel route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(CANCEL_ROUTE_PATH),
      "Implementing agent cancel requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future event and occurrence cancel", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-CANCEL");

    expect(row).toContain("web/src/app/api/my-events/[id]/cancel/route.ts");
    expect(row).toContain("path `id`");
    expect(row).toContain("body dateKey/scope/confirmation token");
    expect(row).toContain("Exact event/occurrence context first");
    expect(row).toContain("two-stage confirmation");
    expect(row).toContain("no hard delete");
    expect(row).toContain("audit and rollback affordance");
    expect(row).toContain("LLM/body IDs untrusted");
    expect(row).toContain(
      "web/src/__tests__/track2-2l26-agent-cancel-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the planned route can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-CANCEL");

    for (const expected of [
      "anonymous/non-auth denial",
      "wrong host denied",
      "stale/pending cohost denied",
      "event A cannot cancel event B",
      "dateKey mismatch denied",
      "no confirmation no-op",
      "RSVP notification choice tested",
      "no service-role/notification/audit mutation before auth/scope/confirmation",
      "private fields absent",
      "route-level negative tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture for future cancel mutations", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-CANCEL");

    expect(row).toContain("web/src/app/api/my-events/[id]/cancel/route.ts");
    expect(row).toContain("Authenticated primary host/accepted cohost/admin");
    expect(row).toContain("confirmation required before privileged work");
    expect(row).toContain("Path event ID and occurrence date key");
    expect(row).toContain("LLM output and body IDs are untrusted");
    expect(row).toContain("Future: `events`, `occurrence_overrides`, notifications, audit log");
    expect(row).toContain("server-decided writable fields only");
    expect(row).toContain("no hard delete");
    expect(row).toContain("audit row with actor, scope, risk tier, confirmation");
    expect(row).toContain("kill switch state after authorized mutation");
    expect(row).toContain(
      "web/src/__tests__/track2-2l26-agent-cancel-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("keeps future privileged work behind route-local authorization and confirmation", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-CANCEL");

    for (const expected of [
      "anonymous/non-auth denial",
      "wrong-host denial",
      "stale/pending cohost denial",
      "event A/event B denial",
      "dateKey mismatch denial",
      "no-confirmation no-op",
      "privileged side-effect ordering tests",
    ]) {
      expect(row).toContain(expected);
    }
  });
});
