/**
 * HOST-ROLE-01 — Host Role Invariants source assertions.
 *
 * Verifies:
 * 1. Claims-only host ownership: direct host invites are blocked.
 * 2. Claims-only host ownership: host invite acceptance is blocked.
 * 3. Claims-only host ownership: cohost invites on orphaned events are blocked.
 * 4. Admin ghost-role fix: nullable currentUserRole on detail page.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, relPath), "utf-8");

const tokenInviteRoute = readSrc("../app/api/my-events/[id]/invite/route.ts");
const tokenAcceptRoute = readSrc("../app/api/event-invites/accept/route.ts");
const invitationsAcceptRoute = readSrc("../app/api/invitations/[id]/route.ts");
const cohostsRoute = readSrc("../app/api/my-events/[id]/cohosts/route.ts");
const editPage = readSrc(
  "../app/(protected)/dashboard/my-events/[id]/page.tsx"
);

// ---------------------------------------------------------------------------
// A) Token-invite enforcement
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Token-invite claims-only enforcement", () => {
  it("blocks invites when event has no primary host", () => {
    expect(tokenInviteRoute).toContain("This event has no primary host yet");
    expect(tokenInviteRoute).toContain("Submit a host claim");
  });

  it("blocks direct host invites", () => {
    expect(tokenInviteRoute).toContain("Direct host invites are disabled");
    expect(tokenInviteRoute).toContain("host claim approval workflow");
  });
});

// ---------------------------------------------------------------------------
// B) Host invite acceptance blocked
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Host invite acceptance blocked", () => {
  it("token accept route blocks host ownership via invite", () => {
    expect(tokenAcceptRoute).toContain("Host ownership must be approved via the host claim workflow");
  });

  it("legacy invitations accept route blocks host ownership via invitation", () => {
    expect(invitationsAcceptRoute).toContain("Host ownership must be approved via the host claim workflow");
  });
});

// ---------------------------------------------------------------------------
// C) Cohost route orphan guard
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Cohost route orphan guard", () => {
  it("blocks cohost invitations for orphaned events", () => {
    expect(cohostsRoute).toContain("This event has no primary host yet");
    expect(cohostsRoute).toContain("before inviting co-hosts");
  });

  it("cohost route no longer auto-promotes invitees to host", () => {
    expect(cohostsRoute).not.toContain('assignedRole = "host"');
    expect(cohostsRoute).toContain('const assignedRole = "cohost" as const');
  });
});

// ---------------------------------------------------------------------------
// D) Admin ghost-role fix (nullable currentUserRole)
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Admin ghost-role fix", () => {
  it("currentUserRole is nullable (host | cohost | null)", () => {
    expect(editPage).toContain('"host" | "cohost" | null');
  });

  it("returns null when user has no event_hosts row", () => {
    // The pattern: userHost ? (...) : null
    expect(editPage).toContain(": null;");
  });
});
