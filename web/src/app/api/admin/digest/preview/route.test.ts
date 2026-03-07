import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const state = vi.hoisted(() => {
  const personalizeDigestRecipients = vi.fn();
  return {
    personalizeDigestRecipients,
    profilesById: {} as Record<string, { id: string; email: string | null; full_name: string | null }>,
    prefsByUserId: {} as Record<string, { email_enabled: boolean; email_digests: boolean }>,
    savedFiltersByUserId: {} as Record<string, Record<string, unknown>>,
    recipients: [] as Array<{ userId: string; email: string; firstName: string | null }>,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-user-1" } },
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
            eq: (_field: string, userId: string) => ({
              maybeSingle: async () => ({
                data: state.profilesById[userId] || null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "notification_preferences") {
        return {
          select: () => ({
            eq: (_field: string, userId: string) => ({
              maybeSingle: async () => ({
                data: state.prefsByUserId[userId] || null,
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table in preview route test: ${table}`);
    },
  }),
}));

vi.mock("@/lib/featureFlags", () => ({
  isDigestPersonalizationEnabled: () => false,
}));

vi.mock("@/lib/digest/weeklyHappenings", () => ({
  getUpcomingHappenings: async () => ({
    byDate: new Map(),
    totalCount: 3,
    venueCount: 2,
    dateRange: { start: "2026-03-01", end: "2026-03-07" },
  }),
  getDigestRecipients: async () => state.recipients,
  personalizeDigestRecipients: state.personalizeDigestRecipients,
}));

vi.mock("@/lib/digest/weeklyOpenMics", () => ({
  getUpcomingOpenMics: async () => ({
    byDate: new Map(),
    totalCount: 0,
    venueCount: 0,
  }),
  getDigestRecipients: async () => [],
}));

vi.mock("@/lib/happenings/savedFilters", () => ({
  getSavedHappeningsFiltersForUsers: async (_client: unknown, userIds: string[]) => {
    const map = new Map<string, { autoApply: boolean; filters: Record<string, unknown> }>();
    for (const userId of userIds) {
      const filters = state.savedFiltersByUserId[userId];
      if (filters) {
        map.set(userId, { autoApply: true, filters });
      }
    }
    return map;
  },
  toDigestApplicableFilters: (filters: Record<string, unknown>) => ({
    ...(filters.type ? { type: filters.type } : {}),
    ...(Array.isArray(filters.days) && filters.days.length > 0
      ? { days: filters.days }
      : {}),
    ...(filters.cost ? { cost: filters.cost } : {}),
    ...(filters.zip ? { zip: filters.zip } : filters.city ? { city: filters.city } : {}),
    ...(filters.zip || filters.city ? { radius: filters.radius || "10" } : {}),
  }),
  hasDigestApplicableFilters: (filters: Record<string, unknown>) =>
    Boolean(
      filters.type ||
        filters.cost ||
        filters.city ||
        filters.zip ||
        (Array.isArray(filters.days) && filters.days.length > 0)
    ),
}));

vi.mock("@/lib/digest/digestEditorial", () => ({
  getEditorial: async () => null,
  resolveEditorialWithDiagnostics: async () => ({ resolved: undefined, unresolved: [] }),
}));

vi.mock("@/lib/digest/sendDigest", () => ({
  sendDigestEmails: async () => ({
    sent: 0,
    failed: 0,
    total: 1,
    previewSubject: "preview subject",
    previewHtml: "<p>preview html</p>",
  }),
}));

vi.mock("@/lib/email/templates/weeklyHappeningsDigest", () => ({
  getWeeklyHappeningsDigestEmail: ({ userId }: { userId: string }) => ({
    subject: `subject:${userId}`,
    html: `<p>html:${userId}</p>`,
    text: `text:${userId}`,
  }),
}));

vi.mock("@/lib/email/templates/weeklyOpenMicsDigest", () => ({
  getWeeklyOpenMicsDigestEmail: () => ({
    subject: "open mics",
    html: "<p>open mics</p>",
    text: "open mics",
  }),
}));

describe("GET /api/admin/digest/preview", () => {
  beforeEach(() => {
    state.personalizeDigestRecipients.mockReset();
    state.recipients = [
      { userId: "u-default", email: "default@example.com", firstName: "Default" },
    ];
    state.profilesById = {
      "u-target": {
        id: "u-target",
        email: "target@example.com",
        full_name: "Target User",
      },
    };
    state.prefsByUserId = {};
    state.savedFiltersByUserId = {};
    state.personalizeDigestRecipients.mockImplementation(
      async (
        _client: unknown,
        recipients: Array<{ userId: string; email: string; firstName: string | null }>
      ) => ({
        recipients,
        digestByUserId: new Map(),
        personalizedCount: 0,
        skippedCount: 0,
      })
    );
  });

  it("forces personalization for targeted user preview even when feature flag is off", async () => {
    state.savedFiltersByUserId["u-target"] = { type: "open_mic", csc: true };
    state.personalizeDigestRecipients.mockImplementationOnce(async () => ({
      recipients: [{ userId: "u-target", email: "target@example.com", firstName: "Target" }],
      digestByUserId: new Map([
        [
          "u-target",
          {
            byDate: new Map(),
            totalCount: 1,
            venueCount: 1,
            dateRange: { start: "2026-03-01", end: "2026-03-07" },
          },
        ],
      ]),
      personalizedCount: 1,
      skippedCount: 0,
    }));

    const req = new NextRequest(
      "http://localhost/api/admin/digest/preview?type=weekly_happenings&user_id=u-target"
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.personalizationFlagState).toBe(false);
    expect(json.personalizationAppliedInPreview).toBe(true);
    expect(json.appliedFilterKeys).toEqual(["type"]);
    expect(json.wouldBeExcludedFromSend).toBe(false);
    expect(json.subject).toBe("subject:u-target");
    expect(state.personalizeDigestRecipients).toHaveBeenCalledTimes(1);
    expect(state.personalizeDigestRecipients.mock.calls[0]?.[3]?.enabled).toBe(true);
  });

  it("returns preference gate diagnostics in targeted preview", async () => {
    state.prefsByUserId["u-target"] = { email_enabled: false, email_digests: true };

    const req = new NextRequest(
      "http://localhost/api/admin/digest/preview?type=weekly_happenings&user_id=u-target"
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.wouldBeExcludedFromSend).toBe(true);
    expect(json.reasonCodes).toContain("gated_out_by_preferences");
    expect(json.reasonCodes).toContain("no_saved_filters");
    expect(json.noMatchesForUser).toBe(false);
  });

  it("returns zero-match reason when personalization removes all results", async () => {
    state.savedFiltersByUserId["u-target"] = { type: "workshop" };
    state.personalizeDigestRecipients.mockImplementationOnce(async () => ({
      recipients: [],
      digestByUserId: new Map(),
      personalizedCount: 0,
      skippedCount: 1,
    }));

    const req = new NextRequest(
      "http://localhost/api/admin/digest/preview?type=weekly_happenings&user_id=u-target"
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.noMatchesForUser).toBe(true);
    expect(json.reasonCodes).toContain("zero_matches_after_filters");
    expect(json.totalHappenings).toBe(0);
  });

  it("keeps non-target preview behavior flag-driven", async () => {
    const req = new NextRequest("http://localhost/api/admin/digest/preview?type=weekly_happenings");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.personalizationEnabled).toBe(false);
    expect(state.personalizeDigestRecipients).toHaveBeenCalledTimes(1);
    expect(state.personalizeDigestRecipients.mock.calls[0]?.[3]?.enabled).toBe(false);
  });
});
