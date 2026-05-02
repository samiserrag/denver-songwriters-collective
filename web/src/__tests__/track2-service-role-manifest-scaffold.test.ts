import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const MANIFEST_PATH = path.join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const manifest = fs.readFileSync(MANIFEST_PATH, "utf-8");

const guardedRouteRoots = [
  "web/src/app/api/my-events",
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
  "web/src/app/events/[id]/page.tsx",
  "web/src/app/embed/events/[id]/route.ts",
  "web/src/app/og/event/[id]/route.tsx",
  "web/src/app/api/event-update-suggestions/route.ts",
  "web/src/lib/supabase/serviceRoleClient.ts",
  "web/src/lib/attendee-session/checkInviteeAccess.ts",
  "web/src/lib/eventUpdateSuggestions/server.ts",
  "web/src/lib/waitlistOffer.ts",
  "web/src/lib/email/adminEventAlerts.ts",
  "web/src/lib/audit/opsAudit.ts",
  "web/src/lib/audit/venueAudit.ts",
];

const plannedPrivilegedSentinels = [
  "web/src/app/api/my-events/[id]/cancel/route.ts",
  "web/src/app/api/events/agent/url-extract/route.ts",
  "web/src/app/api/cron/reverify-sources/route.ts",
  "web/src/lib/reverification/worker.ts",
  "web/src/app/api/import-runs/route.ts",
  "web/src/app/api/import-runs/[id]/route.ts",
  "web/src/app/api/import-runs/[id]/candidates/[candidateId]/route.ts",
  "web/src/app/api/source-records/[id]/route.ts",
  "web/src/app/api/analytics/events/route.ts",
  "web/src/app/api/analytics/dashboard/route.ts",
  "web/src/app/events.json/route.ts",
  "web/src/app/api/events.json/route.ts",
  "web/src/app/api/events/upcoming/route.ts",
  "web/src/app/api/events/tonight/route.ts",
  "web/src/app/api/events/this-weekend/route.ts",
];

const privilegedUsagePattern =
  /\b(createServiceRoleClient|getServiceRoleClient)\s*\(|\bauth\.admin\b|\bSUPABASE_SERVICE_ROLE_KEY\b/;

function repoPath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function isSourceFile(entryName: string): boolean {
  return (
    (entryName.endsWith(".ts") || entryName.endsWith(".tsx")) &&
    !entryName.endsWith(".test.ts") &&
    !entryName.endsWith(".test.tsx")
  );
}

function collectSourceFiles(rootRelativePath: string): string[] {
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

      if (entry.isFile() && isSourceFile(entry.name)) {
        results.push(repoPath(absolute));
      }
    }
  };

  visit(root);
  return results.sort();
}

const guardedExistingFiles = Array.from(
  new Set([
    ...guardedRouteRoots.flatMap(collectSourceFiles),
    ...explicitCurrentFiles.filter((relativePath) =>
      fs.existsSync(path.join(REPO_ROOT, relativePath))
    ),
  ])
).sort();

const privilegedExistingFiles = guardedExistingFiles.filter((relativePath) => {
  const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
  return privilegedUsagePattern.test(source);
});

describe("Track 2 2L.3 service-role/admin-client manifest scaffold", () => {
  it("documents the scaffold as no-runtime-behavior-change Track 2 work", () => {
    expect(manifest).toContain("Runtime behavior changed: No");
    expect(manifest).toContain("Status: Scaffold/gate");
    expect(manifest).toContain("T2-SR");
  });

  it("keeps the required manifest fields visible", () => {
    for (const heading of [
      "File",
      "Route/helper",
      "Resource family",
      "Actor check",
      "Object/resource check",
      "Tables/auth touched",
      "Read/write purpose",
      "Audit/logging expectation",
      "Negative tests present/missing",
      "Status",
    ]) {
      expect(manifest).toContain(heading);
    }
  });

  it("covers every privileged Supabase usage in guarded Track 2 roots", () => {
    expect(privilegedExistingFiles.length).toBeGreaterThan(20);

    for (const relativePath of privilegedExistingFiles) {
      expect(
        manifest,
        `Missing Track 2 service-role/admin-client manifest entry for ${relativePath}`
      ).toContain(relativePath);
    }
  });

  it("pre-registers planned Track 2 privileged route and worker families", () => {
    for (const sentinel of plannedPrivilegedSentinels) {
      expect(
        manifest,
        `Missing planned Track 2 service-role/admin-client sentinel for ${sentinel}`
      ).toContain(sentinel);
    }

    expect(manifest).toContain("planned-gated");
  });

  it("keeps manifest IDs unique", () => {
    const ids = Array.from(manifest.matchAll(/\|\s*(T2-SR-[A-Z0-9-]+)\s*\|/g)).map(
      (match) => match[1]
    );
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
