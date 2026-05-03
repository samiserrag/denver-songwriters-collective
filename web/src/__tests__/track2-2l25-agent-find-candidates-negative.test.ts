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
const FIND_CANDIDATES_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/events/agent/find-candidates/route.ts",
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

describe("Track 2 2L.25 agent find-candidates BOLA planned gate", () => {
  it("keeps the future find-candidates route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(FIND_CANDIDATES_ROUTE_PATH),
      "Implementing find-candidates requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future cross-event candidate search", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-FIND-CANDIDATES");

    expect(row).toContain(
      "web/src/app/api/events/agent/find-candidates/route.ts",
    );
    expect(row).toContain("body free text");
    expect(row).toContain("derived candidate event IDs");
    expect(row).toContain("Search must return only events the actor can manage or view");
    expect(row).toContain("LLM/derived IDs are untrusted");
    expect(row).toContain("no service-role/admin-client usage in v1");
    expect(row).toContain(
      "web/src/__tests__/track2-2l25-agent-find-candidates-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the planned route can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-FIND-CANDIDATES");

    for (const expected of [
      "anonymous/non-auth denial",
      "Host A cannot receive Host B candidates",
      "stale cohost denied",
      "admin behavior explicit",
      "body/LLM-derived IDs treated as untrusted",
      "no fanout/privileged side effect",
      "private fields absent",
      "route-level negative tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as no privileged client usage by default", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-FIND-CANDIDATES");

    expect(row).toContain(
      "web/src/app/api/events/agent/find-candidates/route.ts",
    );
    expect(row).toContain("No service-role or auth-admin usage planned for v1");
    expect(row).toContain("user-scoped event search/read");
    expect(row).toContain("Caller must be authenticated");
    expect(row).toContain("actor-visible/manageable events");
    expect(row).toContain("LLM/derived IDs ignored for authorization");
    expect(row).toContain(
      "web/src/__tests__/track2-2l25-agent-find-candidates-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client or runtime implementation drift", () => {
    expect(manifestSource).toContain("T2-SR-FUTURE-AGENT-FIND-CANDIDATES");
    expect(matrixSource).toContain("T2-BOLA-AGENT-FIND-CANDIDATES");

    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-FIND-CANDIDATES");
    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
