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
const SAFE_FETCH_PATHS = [
  join(WEB_SRC, "lib/safeFetch.ts"),
  join(WEB_SRC, "lib/url/safeFetch.ts"),
];

const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function rowFor(source: string, id: string): string {
  const row = source
    .split("\n")
    .find((line) => line.startsWith(`| ${id} |`));

  expect(row, `Missing row ${id}`).toBeDefined();
  return row ?? "";
}

describe("Track 2 2L.31 safeFetch BOLA planned gate", () => {
  it("keeps the future safeFetch helpers absent until helper-level BOLA tests replace this sentinel", () => {
    for (const helperPath of SAFE_FETCH_PATHS) {
      expect(
        existsSync(helperPath),
        "Implementing safeFetch requires replacing this planned-gate source-contract test with helper-level SSRF and URL-boundary tests",
      ).toBe(false);
    }
  });

  it("documents the matrix boundary for the future central URL fetch helper", () => {
    const row = rowFor(matrixSource, "T2-BOLA-SAFE-FETCH");

    expect(row).toContain("web/src/lib/safeFetch.ts");
    expect(row).toContain("web/src/lib/url/safeFetch.ts");
    expect(row).toContain("URL, redirect targets, host/IP/DNS observations");
    expect(row).toContain("Single URL-fetch boundary");
    expect(row).toContain("SSRF defense");
    expect(row).toContain("private/reserved IP blocking");
    expect(row).toContain("DNS rebinding protection");
    expect(row).toContain("redirect revalidation");
    expect(row).toContain("timeout/response-size/content-type caps");
    expect(row).toContain("no credential forwarding");
    expect(row).toContain("no JS/headless browser execution");
    expect(row).toContain("robots/rate policy");
    expect(row).toContain("sanitized logging");
    expect(row).toContain("no service-role/admin-client usage in v1");
    expect(row).toContain(
      "web/src/__tests__/track2-2l31-safe-fetch-negative.test.ts",
    );
  });

  it("pins the required future negative cases before safeFetch can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-SAFE-FETCH");

    for (const expected of [
      "private/reserved IP denial",
      "DNS rebinding denial",
      "redirect-to-private/unsupported-scheme/loop denial",
      "timeout and response-size caps",
      "content-type allowlist",
      "credential/header stripping",
      "no JS/headless browser execution",
      "robots/rate-limit decisions before fetch",
      "sanitized audit/log outcomes without secrets or bodies",
      "no write/fanout/privileged side effect",
      "route-level safeFetch tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as no privileged client or credential forwarding", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-SAFE-FETCH");

    expect(row).toContain("web/src/lib/safeFetch.ts");
    expect(row).toContain("web/src/lib/url/safeFetch.ts");
    expect(row).toContain("Caller must establish actor/service-worker authority");
    expect(row).toContain("helper itself must not create authorization");
    expect(row).toContain("URL, redirect target, DNS answer");
    expect(row).toContain("No service-role, auth-admin, Supabase credentials");
    expect(row).toContain("cookies, authorization headers, client IP forwarding");
    expect(row).toContain("no secrets or response bodies");
    expect(row).toContain(
      "web/src/__tests__/track2-2l31-safe-fetch-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client or runtime implementation drift", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-SAFE-FETCH");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
