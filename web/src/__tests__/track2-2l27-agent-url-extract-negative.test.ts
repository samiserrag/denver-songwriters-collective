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
const URL_EXTRACT_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/events/agent/url-extract/route.ts",
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

describe("Track 2 2L.27 agent URL extract BOLA planned gate", () => {
  it("keeps the future url-extract route absent until route-level BOLA tests replace this sentinel", () => {
    expect(
      existsSync(URL_EXTRACT_ROUTE_PATH),
      "Implementing URL extract requires replacing this planned-gate source-contract test with route-level negative tests",
    ).toBe(false);
  });

  it("documents the matrix boundary for future URL extraction", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-URL-EXTRACT");

    expect(row).toContain("web/src/app/api/events/agent/url-extract/route.ts");
    expect(row).toContain("body URL");
    expect(row).toContain("derived source IDs");
    expect(row).toContain("derived candidate event IDs");
    expect(row).toContain("All URL fetching through `safeFetch()`");
    expect(row).toContain("extracted text tagged untrusted evidence");
    expect(row).toContain("known-source v1 only");
    expect(row).toContain("review required before any write");
    expect(row).toContain("no service-role write without approved manifest update");
    expect(row).toContain(
      "web/src/__tests__/track2-2l27-agent-url-extract-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the planned route can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-AGENT-URL-EXTRACT");

    for (const expected of [
      "anonymous/non-auth denial",
      "malformed URL denial",
      "URL owner/source scope denial",
      "SSRF/safeFetch private-IP/redirect/credential tests",
      "candidate event cross-user denial",
      "non-JSON-LD manual-review outcome",
      "no auto-write from LLM output",
      "no fanout/privileged side effect before validation",
      "private fields absent",
      "route-level negative tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture for future URL extraction", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-URL-EXTRACT");

    expect(row).toContain("web/src/app/api/events/agent/url-extract/route.ts");
    expect(row).toContain("Authenticated actor or approved service worker");
    expect(row).toContain("no anonymous service-role writes");
    expect(row).toContain("URL fetch must route through `safeFetch()` before extraction");
    expect(row).toContain("source/resource ownership and candidate event scope");
    expect(row).toContain("derived IDs/text are untrusted evidence");
    expect(row).toContain("known-source v1 only");
    expect(row).toContain("no service-role write without approved manifest update");
    expect(row).toContain("manual review");
    expect(row).toContain("no auto-write from LLM output");
    expect(row).toContain("without secrets");
    expect(row).toContain(
      "web/src/__tests__/track2-2l27-agent-url-extract-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("keeps future privileged work behind route-local validation and safeFetch", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-AGENT-URL-EXTRACT");

    for (const expected of [
      "anonymous/non-auth denial",
      "malformed URL denial",
      "SSRF/private IP/redirect/credential tests",
      "source owner denial",
      "candidate event cross-user denial",
      "non-JSON-LD manual-review outcome",
      "private-field response guard",
      "privileged side-effect ordering tests",
    ]) {
      expect(row).toContain(expected);
    }
  });
});
