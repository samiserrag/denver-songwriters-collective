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
const ANSWER_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/events/agent/answer/route.ts",
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

describe("Track 2 2L.28 agent answer BOLA planned gate", () => {
  it("keeps the future answer route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(ANSWER_ROUTE_PATH),
      "Implementing agent answer requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future read-only event Q&A", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-ANSWER");

    expect(row).toContain("web/src/app/api/events/agent/answer/route.ts");
    expect(row).toContain("body question");
    expect(row).toContain("derived event IDs");
    expect(row).toContain("Read-only answers scoped to actor-visible/manageable events");
    expect(row).toContain("no raw private rows");
    expect(row).toContain("LLM/body-derived IDs untrusted");
    expect(row).toContain("no service-role/admin-client usage in v1");
    expect(row).toContain(
      "web/src/__tests__/track2-2l28-agent-answer-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the planned route can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-ANSWER");

    for (const expected of [
      "anonymous/non-auth denial",
      "Host A cannot ask about Host B private events",
      "stale/pending cohost denied",
      "invite-only/draft field leak denial",
      "derived event IDs ignored for authorization",
      "no raw private row exposure",
      "no write/fanout/privileged side effect",
      "private fields absent",
      "route-level negative tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as no privileged client usage by default", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-ANSWER");

    expect(row).toContain("web/src/app/api/events/agent/answer/route.ts");
    expect(row).toContain("Planned read-only event Q&A");
    expect(row).toContain("Caller must be authenticated");
    expect(row).toContain("actor-visible/manageable events");
    expect(row).toContain("LLM/derived event IDs ignored for authorization");
    expect(row).toContain("user-scoped event search/read only");
    expect(row).toContain("No service-role or auth-admin usage planned for v1");
    expect(row).toContain("no mutation");
    expect(row).toContain("without prompt text, raw private rows, emails, tokens");
    expect(row).toContain(
      "web/src/__tests__/track2-2l28-agent-answer-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client or runtime implementation drift", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-ANSWER");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
