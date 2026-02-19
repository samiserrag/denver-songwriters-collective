/**
 * PR5: Invitee Access — Member + Non-Member Token Path
 *
 * Source-code contract tests that verify:
 * 1. Attendee session cookie uses dedicated secret (not service-role key fallback)
 * 2. Server-side invite status re-check on every read (no stale 24h window)
 * 3. Member accept uses invite_id (not token flow)
 * 4. Non-member token accept has rate limiting and 404-not-403
 * 5. Event detail gate includes invitee access (member + cookie)
 * 6. RSVP and comments APIs gate invite-only events
 * 7. Guest APIs block invite-only events
 * 8. No new migrations or RLS changes
 *
 * @see PR4 tests for read-surface hardening contracts
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const WEB_SRC = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(WEB_SRC, relativePath), "utf-8");
}

// ============================================================
// §1: Attendee session cookie — dedicated secret, no fallback
// ============================================================

describe("PR5: Attendee session cookie uses dedicated secret", () => {
  const source = readSource("lib/attendee-session/cookie.ts");

  it("requires ATTENDEE_INVITE_COOKIE_SECRET env var", () => {
    expect(source).toContain("ATTENDEE_INVITE_COOKIE_SECRET");
  });

  it("does NOT fall back to SUPABASE_SERVICE_ROLE_KEY in executable code", () => {
    // Strip single-line comments and block comments, then verify no reference
    const codeOnly = source
      .replace(/\/\/.*$/gm, "")          // strip // comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // strip /* */ comments
    expect(codeOnly).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("throws if dedicated secret is missing", () => {
    expect(source).toContain("Missing ATTENDEE_INVITE_COOKIE_SECRET");
  });

  it("sets HttpOnly cookie", () => {
    expect(source).toContain("httpOnly: true");
  });

  it("sets Secure cookie unconditionally", () => {
    expect(source).toContain("secure: true");
  });

  it("sets SameSite=Lax", () => {
    expect(source).toContain('sameSite: "lax"');
  });

  it("uses jose JWT library for signing", () => {
    expect(source).toContain("SignJWT");
    expect(source).toContain("jwtVerify");
  });

  it("cookie name is dsc_attendee_session", () => {
    expect(source).toContain("dsc_attendee_session");
  });
});

// ============================================================
// §2: Server-side invite status re-check on every read
// ============================================================

describe("PR5: checkInviteeAccess re-checks invite status on every call", () => {
  const source = readSource("lib/attendee-session/checkInviteeAccess.ts");

  it("uses service-role client for invite lookup", () => {
    expect(source).toContain("createServiceRoleClient");
  });

  it("checks invite status='accepted'", () => {
    expect(source).toContain('"status", "accepted"');
  });

  it("checks expires_at for expired invites", () => {
    expect(source).toContain("isExpired");
    expect(source).toContain("expires_at");
  });

  it("member path checks by user_id", () => {
    expect(source).toContain('"user_id", userId');
  });

  it("non-member path reads attendee cookie", () => {
    expect(source).toContain("readAttendeeCookie");
  });

  it("non-member path re-checks invite_id in DB (no stale cookie trust)", () => {
    // The cookie payload's invite_id is used to re-query the DB
    expect(source).toContain("cookiePayload.invite_id");
    // Must query event_attendee_invites by invite_id
    expect(source).toContain('"id", cookiePayload.invite_id');
  });

  it("does NOT cache or store access results", () => {
    // No Map, Set, or cache references — every call goes to DB
    expect(source).not.toContain("new Map");
    expect(source).not.toContain("new Set");
    expect(source).not.toContain("cache");
  });
});

// ============================================================
// §3: Member accept flow uses invite_id (not token)
// ============================================================

describe("PR5: Member accept API uses invite_id-based flow", () => {
  const source = readSource("app/api/attendee-invites/accept/route.ts");

  it("accepts invite_id from request body", () => {
    expect(source).toContain("invite_id");
  });

  it("authenticates user from session (user-scoped)", () => {
    expect(source).toContain("supabase.auth.getUser");
  });

  it("returns 401 for unauthenticated requests", () => {
    expect(source).toContain("401");
  });

  it("verifies user_id matches the invite's user_id", () => {
    // Should check that the invite belongs to the authenticated user
    expect(source).toContain("user_id");
    expect(source).toContain("sessionUser.id");
  });

  it("does NOT process tokens in member flow", () => {
    // Member accept should use invite_id, not token/token_hash
    expect(source).not.toContain("token_hash");
    expect(source).not.toContain("sha256");
  });

  it("updates invite status to accepted", () => {
    expect(source).toContain('"accepted"');
  });

  it("returns event info on success", () => {
    expect(source).toContain("success: true");
    expect(source).toContain("event");
  });
});

// ============================================================
// §4: Non-member token accept has rate limiting and 404-not-403
// ============================================================

describe("PR5: Non-member token accept with rate limiting", () => {
  const source = readSource("app/api/attendee-invites/accept-token/route.ts");

  it("has in-memory rate limiting", () => {
    expect(source).toContain("rateLimitMap");
    expect(source).toContain("checkRateLimit");
  });

  it("rate limit is 10 attempts per 15 minutes", () => {
    expect(source).toContain("RATE_LIMIT_MAX");
    // 15 * 60 * 1000 = 900000
    expect(source).toContain("15 * 60 * 1000");
  });

  it("returns 429 when rate limited", () => {
    expect(source).toContain("429");
  });

  it("hashes token with SHA-256", () => {
    expect(source).toContain("sha256");
    expect(source).toContain("token_hash");
  });

  it("sets attendee session cookie on success", () => {
    expect(source).toContain("setAttendeeCookie");
  });

  it("returns 404 (not 403) for invalid/expired/revoked token deny paths", () => {
    // Extract all NextResponse.json status codes from the source
    const statusMatches = source.match(/\{\s*status:\s*(\d+)\s*\}/g) || [];
    // Every status must be one of: 404, 429, 401, 500 — never 403
    for (const match of statusMatches) {
      const code = match.match(/status:\s*(\d+)/)![1];
      expect(["404", "429", "401", "500"]).toContain(code);
    }
    // Must have at least one 404 response
    expect(source).toContain("status: 404");
    // No "Forbidden" error messages
    const codeOnly = source
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(codeOnly).not.toContain("Forbidden");
  });

  it("blocks revoked invites", () => {
    expect(source).toContain("revoked");
  });

  it("blocks expired invites", () => {
    expect(source).toContain("expired");
    expect(source).toContain("isExpired");
  });

  it("has periodic rate limit cleanup to prevent memory leak", () => {
    expect(source).toContain("setInterval");
    expect(source).toContain("rateLimitMap.delete");
  });

  it("if authenticated user presents token, links user_id to invite", () => {
    // Should check for session user and link user_id
    expect(source).toContain("sessionUser");
    expect(source).toContain("user_id: sessionUser.id");
  });
});

// ============================================================
// §5: Event detail gate includes invitee access
// ============================================================

describe("PR5: Event detail invite-only gate includes invitee access", () => {
  const source = readSource("app/events/[id]/page.tsx");

  it("imports checkInviteeAccess", () => {
    expect(source).toContain('import { checkInviteeAccess }');
  });

  it("calls checkInviteeAccess for invite-only events", () => {
    const gateSection = source.substring(
      source.indexOf('visibility === "invite_only"'),
      source.indexOf("// Compute derived states")
    );
    expect(gateSection).toContain("checkInviteeAccess");
  });

  it("checks invitee access only after host/co-host/admin checks fail", () => {
    const gateSection = source.substring(
      source.indexOf('visibility === "invite_only"'),
      source.indexOf("// Compute derived states")
    );
    // checkInviteeAccess should appear after checkAdminRole and event_hosts checks
    const adminPos = gateSection.indexOf("checkAdminRole");
    const inviteePos = gateSection.indexOf("checkInviteeAccess");
    expect(adminPos).toBeLessThan(inviteePos);
  });

  it("still returns 404 (not 403) for denied users", () => {
    const gateSection = source.substring(
      source.indexOf('visibility === "invite_only"'),
      source.indexOf("// Compute derived states")
    );
    expect(gateSection).toContain("notFound()");
    expect(gateSection).not.toContain("403");
  });
});

// ============================================================
// §6: Attendee invite accept page
// ============================================================

describe("PR5: Attendee invite accept page", () => {
  const source = readSource("app/attendee-invite/page.tsx");

  it("supports invite_id param for member flow", () => {
    expect(source).toContain("invite_id");
  });

  it("supports token param for non-member flow", () => {
    expect(source).toContain("token");
  });

  it("calls member accept API with invite_id", () => {
    expect(source).toContain("/api/attendee-invites/accept");
  });

  it("calls token accept API with token", () => {
    expect(source).toContain("/api/attendee-invites/accept-token");
  });

  it("handles 401 (requires login) state", () => {
    expect(source).toContain("requiresLogin");
  });

  it("preserves redirect URL for login flow", () => {
    expect(source).toContain("redirectTo");
    expect(source).toContain("setPendingRedirect");
  });

  it("shows success state with event link", () => {
    expect(source).toContain("View Event");
  });

  it("wraps in Suspense for useSearchParams", () => {
    expect(source).toContain("Suspense");
  });
});

// ============================================================
// §7: RSVP API gates invite-only events for invitees
// ============================================================

describe("PR5: RSVP API invitee access gate", () => {
  const source = readSource("app/api/events/[id]/rsvp/route.ts");

  it("imports checkInviteeAccess", () => {
    expect(source).toContain('import { checkInviteeAccess }');
  });

  it("imports service-role client for invite-only fallback", () => {
    expect(source).toContain("createServiceRoleClient");
  });

  it("falls back to service-role for invite-only events when user-scoped fetch fails", () => {
    // Should query service client with visibility='invite_only'
    expect(source).toContain('"visibility", "invite_only"');
  });

  it("checks invitee access before allowing RSVP", () => {
    expect(source).toContain("checkInviteeAccess");
  });

  it("returns 404 (not 403) when access denied", () => {
    expect(source).toContain('"Event not found"');
  });
});

// ============================================================
// §8: Comments API gates invite-only events
// ============================================================

describe("PR5: Comments API invitee access gate", () => {
  const source = readSource("app/api/events/[id]/comments/route.ts");

  it("imports checkInviteeAccess", () => {
    expect(source).toContain('import { checkInviteeAccess }');
  });

  it("imports service-role client", () => {
    expect(source).toContain("createServiceRoleClient");
  });

  it("GET handler checks event access before returning comments", () => {
    expect(source).toContain("checkEventAccess");
  });

  it("POST handler uses service-role fallback for invite-only events", () => {
    expect(source).toContain('"visibility", "invite_only"');
  });

  it("returns 404 (not 403) when access denied", () => {
    expect(source).toContain('"Event not found"');
  });
});

// ============================================================
// §9: Guest APIs block invite-only events
// ============================================================

describe("PR5: Guest comment request-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/event-comment/request-code/route.ts");

  it("fetches event visibility", () => {
    expect(source).toContain("visibility");
  });

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest comment verify-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/event-comment/verify-code/route.ts");

  it("fetches event visibility", () => {
    expect(source).toContain("visibility");
  });

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest RSVP request-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/rsvp/request-code/route.ts");

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest RSVP verify-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/rsvp/verify-code/route.ts");

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest timeslot-claim request-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/timeslot-claim/request-code/route.ts");

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest general request-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/request-code/route.ts");

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

describe("PR5: Guest general verify-code blocks invite-only events", () => {
  const source = readSource("app/api/guest/verify-code/route.ts");

  it("returns 404 for invite-only events", () => {
    expect(source).toContain('visibility === "invite_only"');
  });
});

// ============================================================
// §10: No new migrations or RLS changes
// ============================================================

describe("PR5: No new migrations or RLS policy changes", () => {
  it("no new .sql migration files were added in PR5", () => {
    const migrationsDir = join(__dirname, "..", "..", "..", "supabase/migrations");
    const migrations = readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql") && !f.startsWith("_"))
      .sort();
    const latest = migrations[migrations.length - 1];
    // PR5 should NOT add any new migration after PR4's latest
    expect(latest).toBe("20260218040000_fix_event_images_host_storage_policy.sql");
  });

  it("PR5 files contain no CREATE/ALTER/DROP POLICY statements", () => {
    const pr5Files = [
      "lib/attendee-session/cookie.ts",
      "lib/attendee-session/checkInviteeAccess.ts",
      "app/api/attendee-invites/accept/route.ts",
      "app/api/attendee-invites/accept-token/route.ts",
      "app/attendee-invite/page.tsx",
      "app/events/[id]/page.tsx",
      "app/api/events/[id]/rsvp/route.ts",
      "app/api/events/[id]/comments/route.ts",
    ];
    for (const file of pr5Files) {
      const content = readSource(file);
      expect(content).not.toContain("CREATE POLICY");
      expect(content).not.toContain("ALTER POLICY");
      expect(content).not.toContain("DROP POLICY");
    }
  });
});

// ============================================================
// §11: Recursion safety — no bidirectional RLS dependencies
// ============================================================

describe("PR5: Recursion safety — app-layer only, no RLS changes", () => {
  it("RLS policy body still does NOT reference event_attendee_invites", () => {
    const recursionFixPath = join(
      __dirname, "..", "..", "..",
      "supabase/migrations/20260218032000_fix_private_events_rls_recursion.sql"
    );
    const recursionFixSQL = readFileSync(recursionFixPath, "utf-8");
    const policyBody = recursionFixSQL.substring(
      recursionFixSQL.indexOf("CREATE POLICY")
    );
    expect(policyBody).not.toContain("event_attendee_invites");
  });

  it("checkInviteeAccess uses service-role (bypasses RLS, no recursion)", () => {
    const source = readSource("lib/attendee-session/checkInviteeAccess.ts");
    expect(source).toContain("createServiceRoleClient");
    // Service-role bypasses all RLS — no policy evaluation, no recursion risk
  });

  it("accept APIs use service-role for invite lookup only (minimal blast radius)", () => {
    const memberAccept = readSource("app/api/attendee-invites/accept/route.ts");
    const tokenAccept = readSource("app/api/attendee-invites/accept-token/route.ts");
    // Both should use service-role for invite operations
    expect(memberAccept).toContain("createServiceRoleClient");
    expect(tokenAccept).toContain("createServiceRoleClient");
  });
});

// ============================================================
// §12: Service-role blast radius minimization
// ============================================================

describe("PR5: Minimize service-role blast radius", () => {
  it("member accept uses user-scoped auth for identity, service-role only for invite lookup", () => {
    const source = readSource("app/api/attendee-invites/accept/route.ts");
    // User identity from user-scoped auth
    expect(source).toContain("createSupabaseServerClient");
    expect(source).toContain("supabase.auth.getUser");
    // Service-role only for invite operations
    expect(source).toContain("createServiceRoleClient");
  });

  it("checkInviteeAccess uses service-role only for invite status query", () => {
    const source = readSource("lib/attendee-session/checkInviteeAccess.ts");
    // Service-role for invite lookup
    expect(source).toContain("createServiceRoleClient");
    // Does NOT use service-role for auth — user identity from param
    expect(source).not.toContain("supabase.auth");
  });
});
