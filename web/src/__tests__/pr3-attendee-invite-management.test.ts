/**
 * PR3: Attendee Invite Management Contract Tests
 *
 * Source-code contract tests that verify:
 * 1. API route handles authorization (admin/host only, co-hosts excluded)
 * 2. API route enforces 200 invite cap
 * 3. API route handles all CRUD + revoke operations
 * 4. UI component structure (invite modes, status badges, revoke)
 * 5. Integration wiring (Private & Invites tab renders AttendeeInviteManager)
 * 6. No changes to RLS policy graph (explicit safety check)
 *
 * @see docs/investigation/private-invite-only-events-stopgate.md
 * @see docs/postmortems/2026-02-18-private-events-rls-recursion.md
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

// ============================================================================
// API Route Contract Tests
// ============================================================================

const API_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/my-events/[id]/attendee-invites/route.ts"
);
const apiRouteSource = readFileSync(API_ROUTE_PATH, "utf-8");

describe("PR3: Attendee Invite API — Authorization", () => {
  it("exports POST, GET, and PATCH handlers", () => {
    expect(apiRouteSource).toContain("export async function POST(");
    expect(apiRouteSource).toContain("export async function GET(");
    expect(apiRouteSource).toContain("export async function PATCH(");
  });

  it("checks admin role via checkAdminRole", () => {
    expect(apiRouteSource).toContain("import { checkAdminRole }");
    expect(apiRouteSource).toContain("checkAdminRole(supabase, userId)");
  });

  it("checks primary host (host_id) not co-host (event_hosts)", () => {
    // Authorization must check events.host_id, NOT event_hosts table
    expect(apiRouteSource).toContain("event.host_id === userId");
    // Must NOT reference event_hosts for authorization
    expect(apiRouteSource).not.toContain("event_hosts");
  });

  it("returns 401 for unauthenticated users", () => {
    expect(apiRouteSource).toContain(
      'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
    );
  });

  it("returns 403 for non-admin, non-host users", () => {
    expect(apiRouteSource).toContain("{ status: 403 }");
    expect(apiRouteSource).toContain(
      "Only admins or the primary host can manage attendee invites"
    );
  });

  it("returns 404 for event not found", () => {
    expect(apiRouteSource).toContain(
      'NextResponse.json({ error: "Event not found" }, { status: 404 })'
    );
  });

  it("uses service role client after auth check", () => {
    expect(apiRouteSource).toContain(
      "import { createServiceRoleClient }"
    );
    expect(apiRouteSource).toContain("createServiceRoleClient()");
  });
});

describe("PR3: Attendee Invite API — Cap Enforcement", () => {
  it("defines MAX_INVITES_PER_EVENT = 200", () => {
    expect(apiRouteSource).toContain(
      "const MAX_INVITES_PER_EVENT = 200"
    );
  });

  it("counts active invites (pending + accepted) before insert", () => {
    expect(apiRouteSource).toContain(
      "const isActiveInvite ="
    );
    expect(apiRouteSource).toContain("activeInviteCount");
    expect(apiRouteSource).toContain("invite.status === \"accepted\"");
    expect(apiRouteSource).toContain("invite.status === \"pending\"");
  });

  it("rejects invite when cap is reached", () => {
    expect(apiRouteSource).toContain(
      `Maximum of \${MAX_INVITES_PER_EVENT} attendee invites per event reached`
    );
  });

  it("returns cap in GET response", () => {
    expect(apiRouteSource).toContain("cap: MAX_INVITES_PER_EVENT");
  });
});

describe("PR3: Attendee Invite API — Member Invites", () => {
  it("accepts user_id in POST body", () => {
    expect(apiRouteSource).toContain("body.user_id");
    expect(apiRouteSource).toContain("user_id: userId");
  });

  it("verifies user exists in profiles before inviting", () => {
    expect(apiRouteSource).toContain(
      '.from("profiles")'
    );
    expect(apiRouteSource).toContain(
      '.eq("id", userId)'
    );
    expect(apiRouteSource).toContain('"User not found"');
    expect(apiRouteSource).toContain("{ status: 404 }");
  });

  it("handles duplicate invite constraint (23505)", () => {
    expect(apiRouteSource).toContain('insertError.code === "23505"');
    expect(apiRouteSource).toContain(
      "This person has already been invited to this event"
    );
    expect(apiRouteSource).toContain("{ status: 409 }");
  });

  it("reactivates inactive invites instead of blocking re-invite", () => {
    expect(apiRouteSource).toContain("matchingInvite");
    expect(apiRouteSource).toContain("wasReactivated = true");
    expect(apiRouteSource).toContain("status: memberInviteStatus");
    expect(apiRouteSource).toContain("accepted_at: memberAcceptedAt");
    expect(apiRouteSource).toContain("revoked_at: null");
    expect(apiRouteSource).toContain("revoked_by: null");
  });

  it("auto-accepts member invites for direct RSVP flow", () => {
    expect(apiRouteSource).toContain("memberInviteStatus");
    expect(apiRouteSource).toContain("userId ? \"accepted\" : \"pending\"");
  });
});

describe("PR3: Attendee Invite API — Email Invites", () => {
  it("accepts email in POST body", () => {
    expect(apiRouteSource).toContain("body.email");
    expect(apiRouteSource).toContain("email,");
    expect(apiRouteSource).toContain("token_hash: tokenHashForStorage");
  });

  it("normalizes email to lowercase", () => {
    expect(apiRouteSource).toContain(".trim().toLowerCase()");
  });

  it("generates SHA-256 token hash for email invites", () => {
    expect(apiRouteSource).toContain('crypto.randomBytes(32)');
    expect(apiRouteSource).toContain('createHash("sha256")');
    expect(apiRouteSource).toContain("tokenHashForStorage");
  });

  it("validates that at least user_id or email is provided", () => {
    expect(apiRouteSource).toContain("!userId && !email");
    expect(apiRouteSource).toContain(
      "Must provide either user_id or email"
    );
    expect(apiRouteSource).toContain("{ status: 400 }");
  });
});

describe("PR3: Attendee Invite API — GET (List)", () => {
  it("computes effective_status with expiry check", () => {
    expect(apiRouteSource).toContain("effective_status");
    expect(apiRouteSource).toContain("new Date(invite.expires_at) < now");
    expect(apiRouteSource).toContain('effectiveStatus = "expired"');
  });

  it("enriches invites with user profile data", () => {
    expect(apiRouteSource).toContain("profileMap");
    expect(apiRouteSource).toContain("full_name");
    expect(apiRouteSource).toContain("avatar_url");
  });

  it("returns invites, total, and cap", () => {
    expect(apiRouteSource).toContain("invites: enrichedInvites");
    expect(apiRouteSource).toContain("total: enrichedInvites.length");
    expect(apiRouteSource).toContain("cap: MAX_INVITES_PER_EVENT");
  });
});

describe("PR3: Attendee Invite API — PATCH (Revoke)", () => {
  it("requires invite_id in body", () => {
    expect(apiRouteSource).toContain("body.invite_id");
    expect(apiRouteSource).toContain('"invite_id is required"');
  });

  it("verifies invite belongs to the event", () => {
    expect(apiRouteSource).toContain('.eq("id", inviteId)');
    expect(apiRouteSource).toContain('.eq("event_id", eventId)');
  });

  it("prevents revoking already-revoked invites", () => {
    expect(apiRouteSource).toContain(
      'existingInvite.status === "revoked"'
    );
    expect(apiRouteSource).toContain("Invite is already revoked");
  });

  it("sets status, revoked_at, and revoked_by on revoke", () => {
    expect(apiRouteSource).toContain('status: "revoked"');
    expect(apiRouteSource).toContain("revoked_at:");
    expect(apiRouteSource).toContain("revoked_by: sessionUser.id");
  });
});

describe("PR3+: Event visibility update guardrails", () => {
  const eventPatchRouteSource = readFileSync(
    join(WEB_SRC, "app/api/my-events/[id]/route.ts"),
    "utf-8"
  );

  it("allows visibility in PATCH allowedFields", () => {
    expect(eventPatchRouteSource).toContain('"visibility"');
  });

  it("validates visibility values to public/invite_only", () => {
    expect(eventPatchRouteSource).toContain('body.visibility !== "public"');
    expect(eventPatchRouteSource).toContain('body.visibility !== "invite_only"');
  });

  it("restricts visibility updates to admins or primary host", () => {
    expect(eventPatchRouteSource).toContain("canEditEventVisibility");
    expect(eventPatchRouteSource).toContain(
      "Only admins or the primary host can change event privacy"
    );
  });
});

// ============================================================================
// UI Component Contract Tests
// ============================================================================

const UI_COMPONENT_PATH = join(
  WEB_SRC,
  "app/(protected)/dashboard/my-events/_components/AttendeeInviteManager.tsx"
);
const uiSource = readFileSync(UI_COMPONENT_PATH, "utf-8");

describe("PR3: AttendeeInviteManager UI", () => {
  it("exports a default function component", () => {
    expect(uiSource).toContain(
      "export default function AttendeeInviteManager("
    );
  });

  it("accepts eventId, eventTitle, and isInviteOnly props", () => {
    expect(uiSource).toContain("eventId: string");
    expect(uiSource).toContain("eventTitle: string");
    expect(uiSource).toContain("isInviteOnly: boolean");
  });

  it("renders section for both public and invite-only modes", () => {
    expect(uiSource).not.toContain("if (!isInviteOnly)");
    expect(uiSource).toContain("currently public");
    expect(uiSource).toContain("invite-only");
  });

  it("supports member search and email invite modes", () => {
    expect(uiSource).toContain('"member" | "email"');
    expect(uiSource).toContain("Invite Member");
    expect(uiSource).toContain("Invite by Email");
  });

  it("displays invite cap usage", () => {
    expect(uiSource).toContain("{total}/{cap}");
    expect(uiSource).toContain("invites used");
  });

  it("has status badges for all invite statuses", () => {
    expect(uiSource).toContain("pending:");
    expect(uiSource).toContain("accepted:");
    expect(uiSource).toContain("declined:");
    expect(uiSource).toContain("revoked:");
    expect(uiSource).toContain("expired:");
  });

  it("has revoke button for active invites", () => {
    expect(uiSource).toContain("handleRevoke");
    expect(uiSource).toContain("Revoke");
  });

  it("shows active and inactive invite sections", () => {
    expect(uiSource).toContain("Active Invites");
    expect(uiSource).toContain("inactive invite");
  });

  it("calls the correct API endpoint", () => {
    expect(uiSource).toContain(
      "`/api/my-events/${eventId}/attendee-invites`"
    );
  });

  it("loads member candidates from attendee-invites GET", () => {
    expect(uiSource).toContain("include_members=true");
    expect(uiSource).toContain("member_candidates");
  });

  it("supports checkbox-based batch member invites", () => {
    expect(uiSource).toContain("selectedMemberIds");
    expect(uiSource).toContain("Invite Selected");
    expect(uiSource).toContain('type="checkbox"');
  });

  it("only marks active member invites as already invited", () => {
    expect(uiSource).toContain("invite.effective_status === \"pending\"");
    expect(uiSource).toContain("invite.effective_status === \"accepted\"");
  });

  it("validates email format before submitting", () => {
    expect(uiSource).toContain("emailRegex");
    expect(uiSource).toContain("Please enter a valid email address");
  });
});

// ============================================================================
// Integration Wiring Tests
// ============================================================================

const PRIVACY_TAB_PATH = join(
  WEB_SRC,
  "app/(protected)/dashboard/my-events/[id]/_components/PrivacyTab.tsx"
);
const privacyTabSource = readFileSync(PRIVACY_TAB_PATH, "utf-8");

const EVENT_MGMT_CLIENT_PATH = join(
  WEB_SRC,
  "app/(protected)/dashboard/my-events/[id]/_components/EventManagementClient.tsx"
);
const eventMgmtClientSource = readFileSync(EVENT_MGMT_CLIENT_PATH, "utf-8");

describe("PR3: Integration Wiring", () => {
  it("PrivacyTab imports AttendeeInviteManager", () => {
    expect(privacyTabSource).toContain(
      'import AttendeeInviteManager from "../../_components/AttendeeInviteManager"'
    );
  });

  it("PrivacyTab accepts eventVisibility prop", () => {
    expect(privacyTabSource).toContain("eventVisibility: string");
  });

  it("PrivacyTab renders AttendeeInviteManager for primary host or admin", () => {
    expect(privacyTabSource).toContain("canManageAttendeeInvites");
    expect(privacyTabSource).toContain("<AttendeeInviteManager");
  });

  it("PrivacyTab passes isInviteOnly based on selected visibility", () => {
    expect(privacyTabSource).toContain(
      'isInviteOnly={selectedVisibility === "invite_only"}'
    );
  });

  it("EventManagementClient passes eventVisibility to PrivacyTab", () => {
    expect(eventMgmtClientSource).toContain("eventVisibility: string");
    expect(eventMgmtClientSource).toContain(
      "eventVisibility={currentEventVisibility}"
    );
  });
});

describe("PR3+: Invite delivery signals", () => {
  it("creates member invite notifications and preference-aware emails", () => {
    expect(apiRouteSource).toContain("sendEmailWithPreferences");
    expect(apiRouteSource).toContain("attendee_invitation");
    expect(apiRouteSource).toContain("attendeeInvitation");
    expect(apiRouteSource).toContain("const eventLink = event.slug");
    expect(apiRouteSource).toContain('Open the event page to RSVP.');
  });
});

// ============================================================================
// RLS Safety Contract — NO changes to policy graph
// ============================================================================

describe("PR3: RLS Policy Graph Safety", () => {
  it("no new migration files created in this PR", () => {
    const migrationsDir = join(REPO_ROOT, "supabase/migrations");
    const migrations = readdirSync(migrationsDir).filter(
      (f) => f.endsWith(".sql") && !f.startsWith("_")
    );
    // Existing migrations: 20260218030000, 20260218032000, and earlier ones
    // PR3 must NOT add any new migration files
    // PR3 must NOT add any new migration files beyond what PR1/PR2 created
    // Known pre-PR3 migrations with 20260218 prefix:
    // - 20260218020000_add_site_social_share_image_url.sql
    // - 20260218030000_private_events_foundation.sql
    // - 20260218030001_private_events_foundation_rollback.sql (may still exist)
    // - 20260218032000_fix_private_events_rls_recursion.sql
    const knownPrefixes = ["020000", "030000", "030001", "032000", "040000"];
    const pr3Migrations = migrations.filter(
      (f) =>
        f.startsWith("20260218") &&
        !knownPrefixes.some((p) => f.includes(p))
    );
    expect(pr3Migrations).toEqual([]);
  });

  it("API route does not contain CREATE POLICY or ALTER POLICY", () => {
    expect(apiRouteSource).not.toContain("CREATE POLICY");
    expect(apiRouteSource).not.toContain("ALTER POLICY");
    expect(apiRouteSource).not.toContain("DROP POLICY");
  });

  it("UI component does not contain SQL statements", () => {
    expect(uiSource).not.toContain("CREATE POLICY");
    expect(uiSource).not.toContain("ALTER TABLE");
    expect(uiSource).not.toContain("DROP POLICY");
  });

  it("existing fix migration is unchanged (recursion hotfix)", () => {
    const fixMigration = readFileSync(
      join(REPO_ROOT, "supabase/migrations/20260218032000_fix_private_events_rls_recursion.sql"),
      "utf-8"
    );
    // The fix migration should still exist and contain the non-recursive policy
    expect(fixMigration).toContain("public_read_events");
    expect(fixMigration).toContain("visibility = 'public'");
    // The USING clause must NOT reference event_attendee_invites (that was the recursion source)
    // Note: the file comments mention event_attendee_invites for context, which is fine
    const usingClause = fixMigration.substring(
      fixMigration.indexOf("USING ("),
      fixMigration.lastIndexOf(");")
    );
    expect(usingClause).not.toContain("event_attendee_invites");
  });
});
