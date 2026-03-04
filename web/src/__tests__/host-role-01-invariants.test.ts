/**
 * HOST-ROLE-01 — Host Role Invariants source assertions.
 *
 * Verifies:
 * 1. Token-invite route auto-detects role for orphaned events.
 * 2. Token-accept route uses atomic CAS for host_id claim.
 * 3. Both accept routes sync approved_hosts on host invite acceptance.
 * 4. Invitations accept route uses atomic CAS (pre-existing, preserved).
 * 5. Admin ghost-role fix: nullable currentUserRole on detail page.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, relPath), "utf-8");

const tokenInviteRoute = readSrc("../app/api/my-events/[id]/invite/route.ts");
const tokenAcceptRoute = readSrc("../app/api/event-invites/accept/route.ts");
const invitationsAcceptRoute = readSrc("../app/api/invitations/[id]/route.ts");
const editPage = readSrc(
  "../app/(protected)/dashboard/my-events/[id]/page.tsx"
);

// ---------------------------------------------------------------------------
// A) Token-invite auto-role detection
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Token-invite auto-role detection", () => {
  it("checks event.host_id for orphaned event detection", () => {
    expect(tokenInviteRoute).toContain("!event!.host_id");
  });

  it("queries event_hosts for existing host row before upgrading", () => {
    expect(tokenInviteRoute).toContain('.eq("role", "host")');
  });

  it("auto-upgrades cohost to host when event is orphaned", () => {
    expect(tokenInviteRoute).toContain('roleToGrant = "host"');
    expect(tokenInviteRoute).toContain("Auto-upgraded role");
  });
});

// ---------------------------------------------------------------------------
// B) Token-accept atomic CAS
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Token-accept atomic CAS", () => {
  it("uses .is('host_id', null) for atomic conditional update", () => {
    expect(tokenAcceptRoute).toContain('.is("host_id", null)');
  });

  it("checks claimed result for race condition detection", () => {
    expect(tokenAcceptRoute).toContain("if (!claimed)");
  });

  it("uses .select().maybeSingle() pattern for CAS", () => {
    expect(tokenAcceptRoute).toContain(".maybeSingle()");
  });

  it("no longer uses read-then-write pattern", () => {
    // Old pattern: if (event.host_id !== null) — should not be the gate
    expect(tokenAcceptRoute).not.toContain("event.host_id !== null");
  });
});

// ---------------------------------------------------------------------------
// C) approved_hosts sync on host invite acceptance
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — approved_hosts sync on acceptance", () => {
  it("token-accept route syncs approved_hosts for host role", () => {
    expect(tokenAcceptRoute).toContain("approved_hosts");
    expect(tokenAcceptRoute).toContain(
      'status: "active"'
    );
  });

  it("token-accept route syncs profiles.is_host", () => {
    expect(tokenAcceptRoute).toContain("is_host: true");
  });

  it("invitations accept route syncs approved_hosts for host role", () => {
    expect(invitationsAcceptRoute).toContain("approved_hosts");
    expect(invitationsAcceptRoute).toContain(
      'status: "active"'
    );
  });

  it("invitations accept route syncs profiles.is_host", () => {
    expect(invitationsAcceptRoute).toContain("is_host: true");
  });
});

// ---------------------------------------------------------------------------
// D) Invitations accept route preserves atomic CAS
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Invitations accept route CAS preserved", () => {
  it("uses .is('host_id', null) for atomic conditional update", () => {
    expect(invitationsAcceptRoute).toContain('.is("host_id", null)');
  });

  it("rolls back host_id on event_hosts update failure", () => {
    expect(invitationsAcceptRoute).toContain("host_id: null");
  });
});

// ---------------------------------------------------------------------------
// E) Admin ghost-role fix (nullable currentUserRole)
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

// ---------------------------------------------------------------------------
// F) Token-accept rollback logic preserved
// ---------------------------------------------------------------------------
describe("HOST-ROLE-01 — Rollback logic preserved", () => {
  it("token-accept rolls back host_id on event_hosts insert failure", () => {
    expect(tokenAcceptRoute).toContain("Rollback host_id");
    expect(tokenAcceptRoute).toContain("host_id: null");
  });
});
