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
const REVERIFY_WORKER_PATHS = [
  join(WEB_SRC, "app/api/cron/reverify-sources/route.ts"),
  join(WEB_SRC, "lib/reverification/worker.ts"),
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

describe("Track 2 2L.32 reverification worker BOLA planned gate", () => {
  it("keeps the future reverification route and worker absent until route-level tests replace this sentinel", () => {
    for (const workerPath of REVERIFY_WORKER_PATHS) {
      expect(
        existsSync(workerPath),
        "Implementing reverification requires replacing this planned-gate source-contract test with route/helper-level BOLA tests",
      ).toBe(false);
    }
  });

  it("documents the matrix boundary for future known-source reverification", () => {
    const row = rowFor(matrixSource, "T2-BOLA-REVERIFY-WORKER");

    expect(row).toContain("web/src/app/api/cron/reverify-sources/route.ts");
    expect(row).toContain("web/src/lib/reverification/worker.ts");
    expect(row).toContain("event IDs, venue IDs, sourceRecord IDs");
    expect(row).toContain("Service worker identity only");
    expect(row).toContain("`safeFetch()` only");
    expect(row).toContain("approved known-source URLs only");
    expect(row).toContain("source/resource ownership checks before reads or writes");
    expect(row).toContain("non-JSON-LD/manual-review queued outcomes");
    expect(row).toContain("review queue for content deltas");
    expect(row).toContain("low-risk metadata auto-update only");
    expect(row).toContain("no broad autonomous crawling or LLM auto-extraction in v1");
    expect(row).toContain(
      "web/src/__tests__/track2-2l32-reverify-worker-negative.test.ts",
    );
  });

  it("pins the required future negative cases before the worker can merge", () => {
    const row = rowFor(matrixSource, "T2-BOLA-REVERIFY-WORKER");

    for (const expected of [
      "anonymous/public/end-user denial",
      "invalid service-secret denial",
      "source for Event A cannot read or mutate Event B",
      "source record must belong to the path/queued event/venue/org scope",
      "non-JSON-LD queued without LLM auto-extraction",
      "no broad discovery crawl",
      "no event content mutation before review/approved gate",
      "low-risk metadata-only no-change updates",
      "`safeFetch()` required with no ad hoc fetch",
      "sanitized audit/log outcomes",
      "route-level worker tests before merge",
    ]) {
      expect(row).toContain(expected);
    }
  });

  it("records the companion service-role posture as worker-gated and source-scoped", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-REVERIFY-WORKER");

    expect(row).toContain("web/src/app/api/cron/reverify-sources/route.ts");
    expect(row).toContain("web/src/lib/reverification/worker.ts");
    expect(row).toContain("Service worker identity only");
    expect(row).toContain("no end-user or public caller can invoke");
    expect(row).toContain("checked before request parsing, source reads, or worker fanout");
    expect(row).toContain("Source records must belong to target event/venue/org");
    expect(row).toContain("`safeFetch()` only");
    expect(row).toContain("no broad crawling or LLM auto-extraction in v1");
    expect(row).toContain("service-role usage, if needed, only after worker identity");
    expect(row).toContain("no auth-admin usage");
    expect(row).toContain("auto-update only low-risk metadata");
    expect(row).toContain("no raw bodies, secrets, or private rows");
    expect(row).toContain(
      "web/src/__tests__/track2-2l32-reverify-worker-negative.test.ts",
    );
    expect(row).toContain("planned-gated");
  });

  it("does not introduce privileged-client or runtime implementation drift", () => {
    const row = rowFor(manifestSource, "T2-SR-FUTURE-REVERIFY-WORKER");

    expect(row).not.toContain("createServiceRoleClient()");
    expect(row).not.toContain("getServiceRoleClient()");
    expect(row).not.toContain("auth.admin");
    expect(row).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
