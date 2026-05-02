import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const MATRIX_PATH = path.join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);

const matrix = fs.readFileSync(MATRIX_PATH, "utf-8");

const guardedRouteRoots = [
  "web/src/app/api/my-events/[id]",
  "web/src/app/api/events/[id]",
  "web/src/app/api/events/agent",
  "web/src/app/api/my-organizations/[id]",
  "web/src/app/api/my-venues/[id]",
  "web/src/app/api/venues/[id]",
  "web/src/app/api/organizations/[id]",
  "web/src/app/api/admin/ops/events",
  "web/src/app/api/admin/ops/overrides",
  "web/src/app/api/admin/ops/venues",
  "web/src/app/api/admin/venues/[id]",
  "web/src/app/api/admin/organizations/[id]",
];

const explicitCurrentFiles = [
  "web/src/app/api/events/interpret/route.ts",
  "web/src/app/api/events/telemetry/edit-turn/route.ts",
  "web/src/app/api/events/telemetry/route.ts",
  "web/src/app/events/[id]/page.tsx",
  "web/src/app/embed/events/[id]/route.ts",
  "web/src/app/og/event/[id]/route.tsx",
  "web/src/lib/events/eventManageAuth.ts",
  "web/src/lib/venue/managerAuth.ts",
  "web/src/lib/attendee-session/checkInviteeAccess.ts",
  "web/src/lib/eventUpdateSuggestions/server.ts",
  "web/src/lib/email/adminEventAlerts.ts",
  "web/src/lib/audit/opsAudit.ts",
  "web/src/lib/audit/venueAudit.ts",
];

const plannedRouteSentinels = [
  "web/src/app/api/events/agent/find-candidates/route.ts",
  "web/src/app/api/my-events/[id]/cancel/route.ts",
  "web/src/app/api/events/agent/url-extract/route.ts",
  "web/src/app/api/events/agent/answer/route.ts",
  "web/src/app/events.json/route.ts",
  "web/src/app/api/events.json/route.ts",
  "web/src/app/api/events/tonight/route.ts",
  "web/src/app/api/events/this-weekend/route.ts",
  "web/src/app/api/events/upcoming/route.ts",
  "web/src/lib/safeFetch.ts",
  "web/src/lib/url/safeFetch.ts",
  "web/src/app/api/cron/reverify-sources/route.ts",
  "web/src/lib/reverification/worker.ts",
  "web/src/app/api/import-runs/[id]/route.ts",
  "web/src/app/api/import-runs/route.ts",
  "web/src/app/api/import-runs/[id]/candidates/[candidateId]/route.ts",
  "web/src/app/api/source-records/[id]/route.ts",
  "web/src/app/api/analytics/events/route.ts",
  "web/src/app/api/analytics/dashboard/route.ts",
  "web/src/app/api/festivals/[id]/route.ts",
  "web/src/app/api/admin/festivals/[id]/route.ts",
  "web/src/app/api/performers/[id]/route.ts",
  "web/src/app/api/admin/performers/[id]/route.ts",
  "web/src/app/api/series/[id]/route.ts",
  "web/src/app/api/event-series/[id]/route.ts",
  "web/src/app/api/categories/[id]/route.ts",
  "web/src/app/api/admin/categories/[id]/route.ts",
];

function repoPath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function collectRouteFiles(rootRelativePath: string): string[] {
  const root = path.join(REPO_ROOT, rootRelativePath);

  if (!fs.existsSync(root)) {
    return [];
  }

  const results: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
        continue;
      }

      if (entry.isFile() && (entry.name === "route.ts" || entry.name === "route.tsx")) {
        results.push(repoPath(absolute));
      }
    }
  };

  visit(root);
  return results.sort();
}

const guardedExistingFiles = Array.from(
  new Set([
    ...guardedRouteRoots.flatMap(collectRouteFiles),
    ...explicitCurrentFiles.filter((relativePath) =>
      fs.existsSync(path.join(REPO_ROOT, relativePath))
    ),
  ])
).sort();

describe("Track 2 2L.2 BOLA route/resource matrix scaffold", () => {
  it("documents the scaffold as no-runtime-behavior-change Track 2 work", () => {
    expect(matrix).toContain("Runtime behavior changed: No");
    expect(matrix).toContain("Status: Scaffold/gate");
    expect(matrix).toContain("T2-BOLA");
  });

  it("covers every current route/helper file in the guarded Track 2 roots", () => {
    expect(guardedExistingFiles.length).toBeGreaterThan(20);

    for (const relativePath of guardedExistingFiles) {
      expect(matrix, `Missing Track 2 BOLA matrix entry for ${relativePath}`).toContain(
        relativePath
      );
    }
  });

  it("pre-registers planned Track 2 ID-bearing route families", () => {
    for (const sentinel of plannedRouteSentinels) {
      expect(matrix, `Missing planned Track 2 BOLA route sentinel for ${sentinel}`).toContain(
        sentinel
      );
    }
  });

  it("keeps matrix IDs unique", () => {
    const ids = Array.from(matrix.matchAll(/\|\s*(T2-BOLA-[A-Z0-9-]+)\s*\|/g)).map(
      (match) => match[1]
    );
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
