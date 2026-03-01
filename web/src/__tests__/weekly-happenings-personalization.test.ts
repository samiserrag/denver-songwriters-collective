import { describe, expect, it } from "vitest";
import {
  getDigestRecipients,
  personalizeDigestRecipients,
  type DigestRecipient,
  type HappeningOccurrence,
  type HappeningsDigestData,
} from "@/lib/digest/weeklyHappenings";

function createSupabaseMock(params: {
  profiles?: Array<{ id: string; email: string | null; full_name: string | null }>;
  preferences?: Array<{ user_id: string; email_enabled: boolean; email_digests: boolean }>;
  savedFiltersRows?: Array<{ user_id: string; auto_apply: boolean; filters: unknown }>;
}) {
  const profiles = params.profiles || [];
  const preferences = params.preferences || [];
  const savedFiltersRows = params.savedFiltersRows || [];

  return {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            not: async () => ({ data: profiles, error: null }),
          }),
        };
      }

      if (table === "notification_preferences") {
        return {
          select: async () => ({ data: preferences, error: null }),
        };
      }

      if (table === "happenings_saved_filters") {
        return {
          select: () => ({
            in: async (_field: string, userIds: string[]) => ({
              data: savedFiltersRows.filter((row) => userIds.includes(row.user_id)),
              error: null,
            }),
          }),
        };
      }

      throw new Error(`Unexpected table mock: ${table}`);
    },
  } as any;
}

function buildBaseDigestData(): HappeningsDigestData {
  const openMicFreeDenver: HappeningOccurrence = {
    dateKey: "2026-03-01",
    displayDate: "SUNDAY, MARCH 1",
    event: {
      id: "event-1",
      title: "Denver Free Open Mic",
      slug: "denver-free-open-mic",
      event_type: ["open_mic"],
      start_time: "19:00:00",
      event_date: "2026-03-01",
      day_of_week: "Sunday",
      recurrence_rule: null,
      custom_dates: null,
      max_occurrences: null,
      is_free: true,
      cost_label: null,
      venue: {
        id: "venue-1",
        name: "Mercury Cafe",
        city: "Denver",
        state: "CO",
        zip: "80202",
        latitude: 39.7392,
        longitude: -104.9903,
      },
    },
  };

  const openMicPaidDenver: HappeningOccurrence = {
    dateKey: "2026-03-02",
    displayDate: "MONDAY, MARCH 2",
    event: {
      id: "event-2",
      title: "Denver Paid Open Mic",
      slug: "denver-paid-open-mic",
      event_type: ["open_mic"],
      start_time: "20:00:00",
      event_date: "2026-03-02",
      day_of_week: "Monday",
      recurrence_rule: null,
      custom_dates: null,
      max_occurrences: null,
      is_free: false,
      cost_label: "$10",
      venue: {
        id: "venue-2",
        name: "Bluebird",
        city: "Denver",
        state: "CO",
        zip: "80206",
        latitude: 39.7334,
        longitude: -104.9501,
      },
    },
  };

  const showcaseBoulder: HappeningOccurrence = {
    dateKey: "2026-03-02",
    displayDate: "MONDAY, MARCH 2",
    event: {
      id: "event-3",
      title: "Boulder Showcase",
      slug: "boulder-showcase",
      event_type: ["showcase"],
      start_time: "21:00:00",
      event_date: "2026-03-02",
      day_of_week: "Monday",
      recurrence_rule: null,
      custom_dates: null,
      max_occurrences: null,
      is_free: true,
      cost_label: null,
      venue: {
        id: "venue-3",
        name: "Fox Theatre",
        city: "Boulder",
        state: "CO",
        zip: "80302",
        latitude: 40.01499,
        longitude: -105.27055,
      },
    },
  };

  return {
    byDate: new Map([
      ["2026-03-01", [openMicFreeDenver]],
      ["2026-03-02", [openMicPaidDenver, showcaseBoulder]],
    ]),
    totalCount: 3,
    venueCount: 3,
    dateRange: {
      start: "2026-03-01",
      end: "2026-03-07",
    },
  };
}

describe("getDigestRecipients", () => {
  it("requires both email_enabled and email_digests when preference row exists", async () => {
    const supabase = createSupabaseMock({
      profiles: [
        { id: "u1", email: "u1@example.com", full_name: "User One" },
        { id: "u2", email: "u2@example.com", full_name: "User Two" },
        { id: "u3", email: "u3@example.com", full_name: "User Three" },
        { id: "u4", email: "u4@example.com", full_name: "User Four" },
      ],
      preferences: [
        { user_id: "u1", email_enabled: false, email_digests: true },
        { user_id: "u2", email_enabled: true, email_digests: false },
        { user_id: "u3", email_enabled: true, email_digests: true },
      ],
    });

    const recipients = await getDigestRecipients(supabase);
    const ids = recipients.map((r) => r.userId).sort();

    expect(ids).toEqual(["u3", "u4"]);
  });
});

describe("personalizeDigestRecipients", () => {
  it("applies saved type/day/cost/location filters and skips zero-result recipients", async () => {
    const baseData = buildBaseDigestData();
    const recipients: DigestRecipient[] = [
      { userId: "u1", email: "u1@example.com", firstName: "One" },
      { userId: "u2", email: "u2@example.com", firstName: "Two" },
      { userId: "u3", email: "u3@example.com", firstName: "Three" },
    ];

    const supabase = createSupabaseMock({
      savedFiltersRows: [
        {
          user_id: "u1",
          auto_apply: true,
          filters: {
            type: "open_mic",
            days: ["sun"],
            cost: "free",
            city: "Denver",
            radius: "10",
            csc: true, // Must be ignored for digest filtering
          },
        },
        {
          user_id: "u2",
          auto_apply: true,
          filters: {
            type: "workshop",
          },
        },
      ],
    });

    const result = await personalizeDigestRecipients(supabase, recipients, baseData, {
      enabled: true,
      logPrefix: "[Test]",
    });

    expect(result.recipients.map((r) => r.userId)).toEqual(["u1", "u3"]);
    expect(result.personalizedCount).toBe(1);
    expect(result.skippedCount).toBe(1);

    const personalizedU1 = result.digestByUserId.get("u1");
    expect(personalizedU1).toBeDefined();
    expect(personalizedU1?.totalCount).toBe(1);
    expect(personalizedU1?.venueCount).toBe(1);
    expect(personalizedU1?.byDate.get("2026-03-01")?.[0]?.event.title).toBe(
      "Denver Free Open Mic"
    );
  });

  it("does not personalize when only CSC filter is saved", async () => {
    const baseData = buildBaseDigestData();
    const recipients: DigestRecipient[] = [
      { userId: "u1", email: "u1@example.com", firstName: "One" },
    ];

    const supabase = createSupabaseMock({
      savedFiltersRows: [
        {
          user_id: "u1",
          auto_apply: true,
          filters: {
            csc: true,
          },
        },
      ],
    });

    const result = await personalizeDigestRecipients(supabase, recipients, baseData, {
      enabled: true,
    });

    expect(result.recipients).toHaveLength(1);
    expect(result.personalizedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.digestByUserId.size).toBe(0);
  });
});
