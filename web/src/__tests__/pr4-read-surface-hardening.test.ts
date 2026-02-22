/**
 * PR4: Read-Surface Hardening for Invite-Only Events
 *
 * Source-code contract tests that verify all public read surfaces
 * include explicit visibility='public' filters (defense-in-depth)
 * and that invite-only events return 404, not 403.
 *
 * Current access reality (PR4):
 * - Invitee access is NOT enabled (RLS removed invitee reads in recursion hotfix)
 * - Only host/co-host/admin can view invite-only events on detail page
 * - All discovery/metadata/OG/embed surfaces filter visibility='public'
 * - Invitee read access deferred to PR5
 *
 * @see docs/investigation/private-invite-only-events-stopgate.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const WEB_SRC = join(__dirname, "..");

// ============================================================
// Helper: read source file
// ============================================================
function readSource(relativePath: string): string {
  return readFileSync(join(WEB_SRC, relativePath), "utf-8");
}

// ============================================================
// §1: Discovery surfaces include visibility='public' filter
// ============================================================

describe("PR4: Homepage discovery queries filter visibility='public'", () => {
  const source = readSource("app/page.tsx");

  it("upcoming CSC events query includes visibility filter", () => {
    // The upcoming events query chain: is_dsc_event → is_published → visibility → status
    expect(source).toContain('.eq("visibility", "public")');
  });

  it("all 5 homepage event queries include visibility filter", () => {
    // Count occurrences of visibility filter in page.tsx
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    // Homepage has 5 event queries: upcoming CSC, tonight's, spotlight happenings,
    // spotlight open mics (directory), spotlight open mic events
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });
});

describe("PR4: Happenings discovery filters visibility='public'", () => {
  const source = readSource("app/happenings/page.tsx");

  it("base discovery query includes visibility filter", () => {
    expect(source).toContain('.eq("visibility", "public")');
  });

  it("min-date query for past events also filters visibility", () => {
    // There should be at least 2 visibility filters: base query + min-date query
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

describe("PR4: Search API filters visibility='public'", () => {
  const source = readSource("app/api/search/route.ts");

  it("open mics search includes visibility filter", () => {
    expect(source).toContain('.eq("visibility", "public")');
  });

  it("all 3 event search queries include visibility filter", () => {
    // open mics direct, events non-open-mic, venue-matched open mics
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("PR4: Weekly digest filters visibility='public'", () => {
  const source = readSource("lib/digest/weeklyHappenings.ts");

  it("digest event query includes visibility filter", () => {
    expect(source).toContain('.eq("visibility", "public")');
  });
});

// ============================================================
// §2: Metadata surfaces return generic fallback for invite-only
// ============================================================

describe("PR4: Event detail generateMetadata handles invite-only", () => {
  const source = readSource("app/events/[id]/page.tsx");

  it("generateMetadata includes visibility in select", () => {
    // The metadata query should select the visibility column
    expect(source).toContain("visibility");
  });

  it("generateMetadata returns generic fallback for non-public events", () => {
    // Should check visibility !== 'public' and return "not found" metadata
    expect(source).toContain('event.visibility !== "public"');
  });

  it("returns 'Happening Not Found' title for invite-only events", () => {
    expect(source).toContain("Happening Not Found | The Colorado Songwriters Collective");
  });
});

describe("PR4: Open mics slug generateMetadata handles invite-only", () => {
  const source = readSource("app/open-mics/[slug]/page.tsx");

  it("returns generic fallback for non-public events", () => {
    expect(source).toContain('event.visibility !== "public"');
  });
});

// ============================================================
// §3: OG image route filters visibility='public'
// ============================================================

describe("PR4: OG image route filters invite-only events", () => {
  const source = readSource("app/og/event/[id]/route.tsx");

  it("select includes visibility column", () => {
    expect(source).toContain("visibility");
  });

  it("query filters by visibility='public'", () => {
    expect(source).toContain('.eq("visibility", "public")');
  });

  it("returns generic fallback OG card for non-public events", () => {
    // The existing fallback path returns a generic "Happening" card
    expect(source).toContain('title: "Happening"');
  });
});

// ============================================================
// §4: Embed route blocks invite-only events
// ============================================================

describe("PR4: Embed route blocks invite-only events", () => {
  const source = readSource("app/embed/events/[id]/route.ts");

  it("select includes visibility column", () => {
    expect(source).toContain("visibility");
  });

  it("checks visibility before rendering embed", () => {
    expect(source).toContain('event.visibility !== "public"');
  });

  it("returns 404 status card for invite-only events (not 403)", () => {
    // Should use renderStatusCard with "Event not found" message
    expect(source).toContain("Event not found");
  });
});

// ============================================================
// §5: Event detail page body has invite-only gate
// ============================================================

describe("PR4: Event detail page invite-only gate", () => {
  const source = readSource("app/events/[id]/page.tsx");

  it("event select query includes visibility", () => {
    expect(source).toContain("slug, visibility,");
  });

  it("checks for invite_only visibility", () => {
    expect(source).toContain('visibility === "invite_only"');
  });

  it("calls notFound() for unauthorized users on invite-only events (404, not 403)", () => {
    // The invite-only gate should use notFound() not redirect
    expect(source).toContain("notFound()");
  });

  it("allows host_id match for invite-only events", () => {
    expect(source).toContain("event.host_id === sessionUser.id");
  });

  it("allows co-hosts (event_hosts with accepted status) for invite-only events", () => {
    // Should check event_hosts table for co-host access
    expect(source).toContain('invitation_status", "accepted"');
  });

  it("checks admin role for invite-only events", () => {
    expect(source).toContain("checkAdminRole");
  });
});

// ============================================================
// §6: Access matrix reflects current invitee reality
// ============================================================

describe("PR4: Access matrix - current state (invitee access is PR5+)", () => {
  const eventDetailSource = readSource("app/events/[id]/page.tsx");
  const recursionFixPath = join(
    __dirname, "..", "..", "..",
    "supabase/migrations/20260218032000_fix_private_events_rls_recursion.sql"
  );
  const recursionFixSQL = readFileSync(recursionFixPath, "utf-8");

  it("RLS policy body does NOT reference event_attendee_invites (recursion fix still active)", () => {
    // The recursion fix removed the invitee check from events SELECT policy.
    // SQL comments mention event_attendee_invites for historical context, but the
    // actual CREATE POLICY body must NOT reference the table.
    const policyBody = recursionFixSQL.substring(
      recursionFixSQL.indexOf("CREATE POLICY")
    );
    expect(policyBody).not.toContain("event_attendee_invites");
  });

  it("event detail invite-only gate does NOT check event_attendee_invites", () => {
    // PR4 only allows host/co-host/admin — invitee access is PR5
    // The invite-only gate should NOT query event_attendee_invites
    const inviteOnlyGateSection = eventDetailSource.substring(
      eventDetailSource.indexOf('visibility === "invite_only"'),
      eventDetailSource.indexOf("// Compute derived states")
    );
    expect(inviteOnlyGateSection).not.toContain("event_attendee_invites");
  });

  it("invite-only gate only checks: admin, host_id, event_hosts (co-hosts)", () => {
    const inviteOnlyGateSection = eventDetailSource.substring(
      eventDetailSource.indexOf('visibility === "invite_only"'),
      eventDetailSource.indexOf("// Compute derived states")
    );
    // Should check these three access paths
    expect(inviteOnlyGateSection).toContain("checkAdminRole");
    expect(inviteOnlyGateSection).toContain("host_id");
    expect(inviteOnlyGateSection).toContain("event_hosts");
    // Should NOT check attendee invites (that's PR5)
    expect(inviteOnlyGateSection).not.toContain("attendee_invite");
  });
});

// ============================================================
// §7: No migration or policy changes in PR4
// ============================================================

describe("PR4: No migration or policy changes", () => {
  it("PR3 baseline migration still exists (PR4 introduced none)", () => {
    // PR4 did not add a migration. Later features may add migrations, so this
    // assertion verifies the PR3 baseline file remains present instead of
    // pinning the latest migration filename forever.
    const migrationsDir = join(__dirname, "..", "..", "..", "supabase/migrations");
    const migrations = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql") && !f.startsWith("_"))
      .sort();
    expect(migrations).toContain("20260218040000_fix_event_images_host_storage_policy.sql");
  });

  it("PR4 changed files contain no CREATE POLICY statements", () => {
    // Read all PR4-modified TypeScript files and verify no policy SQL
    const pr4Files = [
      "app/page.tsx",
      "app/happenings/page.tsx",
      "app/api/search/route.ts",
      "lib/digest/weeklyHappenings.ts",
      "app/events/[id]/page.tsx",
      "app/open-mics/[slug]/page.tsx",
      "app/og/event/[id]/route.tsx",
      "app/embed/events/[id]/route.ts",
    ];
    for (const file of pr4Files) {
      const content = readSource(file);
      expect(content).not.toContain("CREATE POLICY");
      expect(content).not.toContain("ALTER POLICY");
      expect(content).not.toContain("DROP POLICY");
    }
  });
});

// ============================================================
// §8: 404-not-403 behavior contract
// ============================================================

describe("PR4: 404-not-403 behavior for invite-only events", () => {
  it("event detail uses notFound() not 403 response for invite-only gate", () => {
    const source = readSource("app/events/[id]/page.tsx");
    const inviteOnlyGateSection = source.substring(
      source.indexOf('visibility === "invite_only"'),
      source.indexOf("// Compute derived states")
    );
    expect(inviteOnlyGateSection).toContain("notFound()");
    expect(inviteOnlyGateSection).not.toContain("403");
    expect(inviteOnlyGateSection).not.toContain("Forbidden");
  });

  it("embed route returns 404 status for invite-only events", () => {
    const source = readSource("app/embed/events/[id]/route.ts");
    // The visibility check should result in a 404 status card
    expect(source).toContain("404");
  });

  it("OG route returns generic fallback (200) for invite-only events, not 403", () => {
    const source = readSource("app/og/event/[id]/route.tsx");
    // OG route returns 200 with generic card for non-public events
    // (query returns null → falls into existing fallback path)
    expect(source).not.toContain("403");
  });

  it("generateMetadata returns generic 'not found' metadata, not error metadata", () => {
    const source = readSource("app/events/[id]/page.tsx");
    // The metadata fallback should say "not found", not "private" or "invite-only"
    // (to avoid leaking that the event exists but is private)
    expect(source).not.toContain("private event");
    // The metadata fallback text should not say "invite-only" — check rendered strings only
    // (code comments may mention "invite-only" for documentation purposes)
    const metadataSection = source.substring(
      source.indexOf("generateMetadata"),
      source.indexOf("function formatTime")
    );
    // The returned metadata title/description must not leak "invite-only"
    expect(metadataSection).not.toMatch(/return\s*\{[^}]*invite.only/i);
    expect(source).toContain("Happening Not Found");
  });
});
