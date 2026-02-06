import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";

const adminUserId = "admin-user-1";
const weekKey = "2026-W06";
const introNote = "Hello from editorial";
const spotlightUrl = "https://denversongwriterscollective.org/songwriters/pony-lee";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: adminUserId } },
      }),
    },
  }),
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: async () => true,
}));

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { email: "admin@example.com", full_name: "Admin User" },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock("@/lib/digest/weeklyHappenings", () => ({
  getUpcomingHappenings: async () => ({
    byDate: {},
    totalCount: 0,
    venueCount: 0,
  }),
  getDigestRecipients: async () => [],
}));

vi.mock("@/lib/digest/digestEditorial", () => ({
  getEditorial: async (_client: unknown, requestedWeekKey: string, digestType: string) => {
    if (requestedWeekKey === weekKey && digestType === "weekly_happenings") {
      return {
        id: "editorial-1",
        week_key: requestedWeekKey,
        digest_type: digestType,
        subject_override: null,
        intro_note: introNote,
        featured_happening_ids: null,
        member_spotlight_id: null,
        venue_spotlight_id: null,
        blog_feature_slug: null,
        gallery_feature_slug: null,
        featured_happenings_refs: null,
        member_spotlight_ref: spotlightUrl,
        venue_spotlight_ref: null,
        blog_feature_ref: null,
        gallery_feature_ref: null,
        created_at: "2026-02-06T00:00:00.000Z",
        updated_at: "2026-02-06T00:00:00.000Z",
        updated_by: null,
      };
    }
    return null;
  },
  resolveEditorial: async () => ({
    introNote,
    memberSpotlight: {
      name: "Pony Lee",
      url: spotlightUrl,
    },
  }),
  resolveEditorialWithDiagnostics: async (_client: unknown, editorial: { intro_note: string | null }) => ({
    resolved: {
      introNote: editorial.intro_note || undefined,
      memberSpotlight: {
        name: "Pony Lee",
        url: spotlightUrl,
      },
    },
    unresolved: [],
  }),
}));

vi.mock("@/lib/email/mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe("POST /api/admin/digest/send (test)", () => {
  it("renders editorial for provided weekKey", async () => {
    const req = new Request("http://localhost/api/admin/digest/send", {
      method: "POST",
      body: JSON.stringify({
        digestType: "weekly_happenings",
        mode: "test",
        weekKey,
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.weekKey).toBe(weekKey);
    expect(json.previewHtml).toContain(introNote);
    expect(json.previewHtml).toContain(spotlightUrl);
  });
});
