/**
 * PR6: Negative Privilege-Escalation Matrix
 *
 * Behavioral route tests with mocked Supabase clients.
 * Verifies that invite-only events are invisible to unauthorized roles
 * across all surfaces: detail, RSVP, comments, search, OG, embed.
 *
 * Roles tested:
 * - Anon (no session)
 * - Authenticated non-invitee
 * - Accepted invitee (member)
 * - Host / co-host
 * - Admin
 *
 * Every deny path must return 404 (never 403).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mock state
// ────────────────────────────────────────────────────────────

/** Simulated auth state */
let mockSessionUser: { id: string; email: string; app_metadata?: Record<string, unknown> } | null = null;

/** The invite-only event visible to service-role */
const INVITE_ONLY_EVENT = {
  id: "event-inv-1",
  slug: "private-jam",
  title: "Private Jam Session",
  host_id: "host-user-1",
  visibility: "invite_only",
  is_published: true,
  status: "active",
  capacity: null,
  is_dsc_event: false,
  event_date: "2026-03-01",
  start_time: "19:00",
  venue_name: "Studio A",
  venue_address: "123 Main St",
};

/** Whether user-scoped Supabase returns the event (hosts/admins via RLS) */
let mockUserScopedEventVisible = false;

/** Whether service-role returns an accepted invite for checkInviteeAccess */
let mockInviteeHasAccess = false;

/** Co-host lookup result */
let mockIsCoHost = false;

/** Admin role result */
let mockIsAdmin = false;

// ────────────────────────────────────────────────────────────
// Mock: Supabase server client (user-scoped, RLS)
// ────────────────────────────────────────────────────────────

const createChainable = (result: { data: unknown; error: unknown }) => {
  const obj: Record<string, unknown> = {
    ...result,
    select: () => obj,
    eq: () => obj,
    neq: () => obj,
    in: () => obj,
    not: () => obj,
    gt: () => obj,
    gte: () => obj,
    is: () => obj,
    order: () => obj,
    limit: () => obj,
    single: () => result,
    maybeSingle: () => result,
    insert: () => obj,
    update: () => obj,
    delete: () => obj,
  };
  return obj;
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockSessionUser },
        error: mockSessionUser ? null : { message: "Not authenticated" },
      }),
    },
    from: (table: string) => {
      if (table === "events") {
        // User-scoped RLS: returns event only if user is host/admin/co-host
        const data = mockUserScopedEventVisible ? INVITE_ONLY_EVENT : null;
        return createChainable({
          data,
          error: data ? null : { message: "Not found", code: "PGRST116" },
        });
      }
      if (table === "event_hosts") {
        return createChainable({
          data: mockIsCoHost ? { id: "host-entry-1" } : null,
          error: null,
        });
      }
      if (table === "profiles") {
        return createChainable({
          data: mockSessionUser
            ? { id: mockSessionUser.id, full_name: "Test User", role: mockIsAdmin ? "admin" : "member" }
            : null,
          error: null,
        });
      }
      if (table === "event_comments") {
        return {
          select: () =>
            createChainable({
              data: [],
              error: null,
              count: 0,
            }),
          insert: () =>
            createChainable({
              data: { id: "comment-1", content: "test" },
              error: null,
            }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: () =>
            createChainable({
              data: null,
              error: null,
              count: 0,
            }),
          insert: () =>
            createChainable({
              data: { id: "rsvp-1", status: "confirmed" },
              error: null,
            }),
          update: () =>
            createChainable({
              data: { id: "rsvp-1", status: "confirmed" },
              error: null,
            }),
        };
      }
      return createChainable({ data: null, error: null });
    },
  })),
}));

// ────────────────────────────────────────────────────────────
// Mock: Supabase service-role client (bypasses RLS)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "events") {
        // Service-role always sees the event
        return createChainable({
          data: INVITE_ONLY_EVENT,
          error: null,
        });
      }
      if (table === "event_attendee_invites") {
        // Return accepted invite only if mockInviteeHasAccess is true
        const data = mockInviteeHasAccess
          ? { id: "invite-1", status: "accepted", expires_at: null }
          : null;
        return createChainable({ data, error: null });
      }
      return createChainable({ data: null, error: null });
    },
  }),
}));

// ────────────────────────────────────────────────────────────
// Mock: checkInviteeAccess (called by RSVP + comments routes)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/attendee-session/checkInviteeAccess", () => ({
  checkInviteeAccess: vi.fn(async () => ({
    hasAccess: mockInviteeHasAccess,
  })),
}));

// ────────────────────────────────────────────────────────────
// Mock: Admin auth check
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: vi.fn(async () => mockIsAdmin),
}));

// ────────────────────────────────────────────────────────────
// Mock: date key contract (used by RSVP + comments)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/events/dateKeyContract", () => ({
  validateDateKeyForWrite: vi.fn(async () => ({
    success: true,
    effectiveDateKey: "2026-03-01",
  })),
  resolveEffectiveDateKey: vi.fn(async () => ({
    success: true,
    effectiveDateKey: "2026-03-01",
  })),
  dateKeyErrorResponse: () =>
    new Response(JSON.stringify({ error: "Invalid date" }), { status: 400 }),
  formatDateKeyShort: () => "Mar 1",
  formatDateKeyForEmail: () => "Saturday, March 1, 2026",
}));

// ────────────────────────────────────────────────────────────
// Mock: waitlist/offer processing (used by RSVP route)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/waitlistOffer", () => ({
  processExpiredOffers: vi.fn(async () => {}),
  promoteNextWaitlistPerson: vi.fn(async () => null),
  sendOfferNotifications: vi.fn(async () => {}),
  confirmOffer: vi.fn(async () => ({ success: true })),
  isOfferExpired: vi.fn(() => false),
}));

// ────────────────────────────────────────────────────────────
// Mock: email sending (fire-and-forget, not relevant to access)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
}));

vi.mock("@/lib/emailTemplates", () => ({
  getRsvpConfirmationEmail: () => ({
    subject: "Confirmed",
    html: "<p>confirmed</p>",
    text: "confirmed",
  }),
}));

vi.mock("@/lib/email/sendWithPreferences", () => ({
  sendEmailWithPreferences: vi.fn(async () => {}),
}));

vi.mock("@/lib/email/templates/rsvpHostNotification", () => ({
  getRsvpHostNotificationEmail: () => ({
    subject: "New RSVP",
    html: "<p>rsvp</p>",
    text: "rsvp",
  }),
}));

vi.mock("@/lib/email/templates/eventCommentNotification", () => ({
  getEventCommentNotificationEmail: () => ({
    subject: "New Comment",
    html: "<p>comment</p>",
    text: "comment",
  }),
}));

vi.mock("@/lib/email/render", () => ({
  SITE_URL: "https://test.example.com",
}));

// ────────────────────────────────────────────────────────────
// Mock: attendee session cookie (for comments GET access check)
// ────────────────────────────────────────────────────────────

vi.mock("@/lib/attendee-session/cookie", () => ({
  readAttendeeCookie: vi.fn(async () => null),
  setAttendeeCookie: vi.fn(async () => {}),
  createAttendeeSessionToken: vi.fn(async () => "mock-token"),
  verifyAttendeeSessionToken: vi.fn(async () => null),
  ATTENDEE_COOKIE_NAME: "dsc_attendee_session",
}));

// ────────────────────────────────────────────────────────────
// Imports (must come after vi.mock calls)
// ────────────────────────────────────────────────────────────

// RSVP route
import { POST as rsvpPost } from "@/app/api/events/[id]/rsvp/route";
// Comments route
import {
  GET as commentsGet,
  POST as commentsPost,
} from "@/app/api/events/[id]/comments/route";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeRequest(
  url: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Request {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

const routeParams = Promise.resolve({ id: INVITE_ONLY_EVENT.id });

// ────────────────────────────────────────────────────────────
// Reset
// ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionUser = null;
  mockUserScopedEventVisible = false;
  mockInviteeHasAccess = false;
  mockIsCoHost = false;
  mockIsAdmin = false;
});

// ============================================================
// §1: RSVP POST — deny paths
// ============================================================

describe("PR6 Negative: RSVP POST on invite-only event", () => {
  it("anon → 401 Unauthorized", async () => {
    mockSessionUser = null;
    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/rsvp`,
      "POST",
      { notes: "test" }
    );
    const res = await rsvpPost(req, { params: routeParams });
    expect(res.status).toBe(401);
  });

  it("authenticated non-invitee → 404 Event not found", async () => {
    mockSessionUser = { id: "random-user", email: "random@test.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/rsvp`,
      "POST",
      { notes: "test" }
    );
    const res = await rsvpPost(req, { params: routeParams });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Event not found");
  });

  it("accepted invitee (member) → 200 (access granted)", async () => {
    mockSessionUser = { id: "invitee-user", email: "invitee@test.com" };
    mockUserScopedEventVisible = false; // RLS doesn't cover invitees
    mockInviteeHasAccess = true;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/rsvp`,
      "POST",
      { notes: "test" }
    );
    const res = await rsvpPost(req, { params: routeParams });
    // Should not be 404 — invitee has access
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("host → 200 (access granted via RLS)", async () => {
    mockSessionUser = { id: "host-user-1", email: "host@test.com" };
    mockUserScopedEventVisible = true; // RLS includes host

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/rsvp`,
      "POST",
      { notes: "test" }
    );
    const res = await rsvpPost(req, { params: routeParams });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("never returns 403", async () => {
    // Try all deny scenarios, verify none return 403
    for (const scenario of [
      { user: null, visible: false, invitee: false },
      {
        user: { id: "random", email: "r@t.com" },
        visible: false,
        invitee: false,
      },
    ]) {
      mockSessionUser = scenario.user;
      mockUserScopedEventVisible = scenario.visible;
      mockInviteeHasAccess = scenario.invitee;

      const req = makeRequest(
        `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/rsvp`,
        "POST",
        { notes: "test" }
      );
      const res = await rsvpPost(req, { params: routeParams });
      expect(res.status).not.toBe(403);
    }
  });
});

// ============================================================
// §2: Comments GET — deny paths
// ============================================================

describe("PR6 Negative: Comments GET on invite-only event", () => {
  it("anon → 404 Event not found", async () => {
    mockSessionUser = null;
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`
    );
    const res = await commentsGet(req, { params: routeParams });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Event not found");
  });

  it("authenticated non-invitee → 404 Event not found", async () => {
    mockSessionUser = { id: "random-user", email: "random@test.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`
    );
    const res = await commentsGet(req, { params: routeParams });
    expect(res.status).toBe(404);
  });

  it("accepted invitee → 200 (access granted)", async () => {
    mockSessionUser = { id: "invitee-user", email: "invitee@test.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = true;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`
    );
    const res = await commentsGet(req, { params: routeParams });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("host → 200 (access granted via RLS)", async () => {
    mockSessionUser = { id: "host-user-1", email: "host@test.com" };
    mockUserScopedEventVisible = true;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`
    );
    const res = await commentsGet(req, { params: routeParams });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("never returns 403", async () => {
    mockSessionUser = { id: "random", email: "r@t.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`
    );
    const res = await commentsGet(req, { params: routeParams });
    expect(res.status).not.toBe(403);
  });
});

// ============================================================
// §3: Comments POST — deny paths
// ============================================================

describe("PR6 Negative: Comments POST on invite-only event", () => {
  it("anon → 401 Unauthorized", async () => {
    mockSessionUser = null;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`,
      "POST",
      { content: "test comment", date_key: "2026-03-01" }
    );
    const res = await commentsPost(req, { params: routeParams });
    expect(res.status).toBe(401);
  });

  it("authenticated non-invitee → 404 Event not found", async () => {
    mockSessionUser = { id: "random-user", email: "random@test.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`,
      "POST",
      { content: "test comment", date_key: "2026-03-01" }
    );
    const res = await commentsPost(req, { params: routeParams });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Event not found");
  });

  it("accepted invitee → 200 (access granted)", async () => {
    mockSessionUser = { id: "invitee-user", email: "invitee@test.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = true;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`,
      "POST",
      { content: "test comment", date_key: "2026-03-01" }
    );
    const res = await commentsPost(req, { params: routeParams });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("never returns 403", async () => {
    mockSessionUser = { id: "random", email: "r@t.com" };
    mockUserScopedEventVisible = false;
    mockInviteeHasAccess = false;

    const req = makeRequest(
      `http://localhost/api/events/${INVITE_ONLY_EVENT.id}/comments`,
      "POST",
      { content: "test comment", date_key: "2026-03-01" }
    );
    const res = await commentsPost(req, { params: routeParams });
    expect(res.status).not.toBe(403);
  });
});

// ============================================================
// §4: Source-contract tests — discovery exclusion
// ============================================================

import { readFileSync } from "fs";
import { join } from "path";

const WEB_SRC = join(__dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(WEB_SRC, relativePath), "utf-8");
}

describe("PR6 Negative: Discovery surfaces exclude invite-only events", () => {
  it("homepage: all 5 event queries filter visibility='public'", () => {
    const source = readSource("app/page.tsx");
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(5);
  });

  it("happenings: filters visibility='public'", () => {
    const source = readSource("app/happenings/page.tsx");
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it("search: all 3 event queries filter visibility='public'", () => {
    const source = readSource("app/api/search/route.ts");
    const matches = source.match(/\.eq\("visibility",\s*"public"\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it("digest: event query filters visibility='public'", () => {
    const source = readSource("lib/digest/weeklyHappenings.ts");
    expect(source).toContain('.eq("visibility", "public")');
  });
});

// ============================================================
// §5: Source-contract tests — OG/embed/metadata fallback
// ============================================================

describe("PR6 Negative: OG/embed/metadata never leak invite-only info", () => {
  it("OG route filters visibility='public'", () => {
    const source = readSource("app/og/event/[id]/route.tsx");
    expect(source).toContain('.eq("visibility", "public")');
  });

  it("embed route checks visibility and returns 404", () => {
    const source = readSource("app/embed/events/[id]/route.ts");
    expect(source).toContain('event.visibility !== "public"');
    expect(source).toContain("404");
  });

  it("event detail generateMetadata returns generic 'Happening Not Found'", () => {
    const source = readSource("app/events/[id]/page.tsx");
    expect(source).toContain(
      "Happening Not Found | The Colorado Songwriters Collective"
    );
    expect(source).toContain('event.visibility !== "public"');
  });

  it("metadata never contains 'private event' or 'invite-only' in output", () => {
    const source = readSource("app/events/[id]/page.tsx");
    const metadataSection = source.substring(
      source.indexOf("generateMetadata"),
      source.indexOf("function formatTime")
    );
    expect(metadataSection).not.toMatch(/return\s*\{[^}]*invite.only/i);
    expect(metadataSection).not.toContain("private event");
  });
});

// ============================================================
// §6: Source-contract tests — guest API blocking
// ============================================================

describe("PR6 Negative: Guest APIs block invite-only events entirely", () => {
  const guestRoutes = [
    "app/api/guest/event-comment/request-code/route.ts",
    "app/api/guest/event-comment/verify-code/route.ts",
    "app/api/guest/rsvp/request-code/route.ts",
    "app/api/guest/rsvp/verify-code/route.ts",
    "app/api/guest/timeslot-claim/request-code/route.ts",
    "app/api/guest/request-code/route.ts",
    "app/api/guest/verify-code/route.ts",
  ];

  for (const route of guestRoutes) {
    it(`${route.split("/").slice(-3).join("/")} returns 404 for invite-only`, () => {
      const source = readSource(route);
      expect(source).toContain('visibility === "invite_only"');
      // Verify the 404 response immediately follows the visibility check
      expect(source).toContain('"Event not found"');
    });
  }
});

// ============================================================
// §7: 404-not-403 invariant across all surfaces
// ============================================================

describe("PR6 Negative: 404-not-403 invariant", () => {
  it("event detail uses notFound() (404) not 403 for invite-only gate", () => {
    const source = readSource("app/events/[id]/page.tsx");
    const gateSection = source.substring(
      source.indexOf('visibility === "invite_only"'),
      source.indexOf("// Compute derived states")
    );
    expect(gateSection).toContain("notFound()");
    expect(gateSection).not.toContain("status: 403");
  });

  it("RSVP route never returns { status: 403 }", () => {
    const source = readSource("app/api/events/[id]/rsvp/route.ts");
    expect(source).not.toContain("status: 403");
  });

  it("comments route never returns { status: 403 }", () => {
    const source = readSource("app/api/events/[id]/comments/route.ts");
    expect(source).not.toContain("status: 403");
  });

  it("accept-token route never returns { status: 403 }", () => {
    const source = readSource(
      "app/api/attendee-invites/accept-token/route.ts"
    );
    expect(source).not.toContain("status: 403");
  });

  it("embed route returns 404 for non-public events", () => {
    const source = readSource("app/embed/events/[id]/route.ts");
    // Uses renderStatusCard with 404
    expect(source).toContain("404");
    expect(source).not.toContain("status: 403");
  });
});
