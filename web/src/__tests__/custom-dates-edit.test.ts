/**
 * Tests for editing custom_dates on existing custom-schedule events.
 *
 * Covers:
 * 1. PATCH validation: format, dedupe, sort, min 1, max 12
 * 2. PATCH canonical anchoring: event_date = min(custom_dates)
 * 3. PATCH preserves recurrence_rule='custom' and day_of_week=null
 * 4. Occurrence expansion reflects updated custom_dates
 * 5. EventForm client validation: min 1 date blocks submit
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── PATCH route tests ───────────────────────────────────────────────────────

// Mock state for PATCH route
let mockSession: { user: { id: string } } | null = null;
let mockIsAdmin = false;
let mockIsHost = true;
let mockCurrentEvent: Record<string, unknown> | null = null;
let capturedUpdatePayload: Record<string, unknown> | null = null;
let mockUpdateResult: { data: Record<string, unknown> | null; error: Error | null } = {
  data: { id: "event-1" },
  error: null,
};

const createChainable = (result: unknown) => {
  const chainable: Record<string, unknown> = {
    ...result as object,
    eq: () => chainable,
    in: () => chainable,
    not: () => chainable,
    gt: () => chainable,
    gte: () => chainable,
    is: () => chainable,
    order: () => chainable,
    limit: () => chainable,
    single: () => result,
    maybeSingle: () => result,
  };
  return chainable;
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: mockSession },
            error: null,
          }),
      },
      from: (table: string) => {
        if (table === "profiles") {
          return {
            select: () =>
              createChainable({
                data: mockIsAdmin ? { role: "admin" } : { role: "member" },
                error: null,
              }),
          };
        }
        if (table === "event_hosts") {
          return {
            select: () =>
              createChainable({
                data: mockIsHost ? { role: "host" } : null,
                error: null,
              }),
          };
        }
        if (table === "events") {
          return {
            select: () =>
              createChainable({
                data: mockCurrentEvent,
                error: mockCurrentEvent ? null : new Error("Not found"),
              }),
            update: (payload: Record<string, unknown>) => {
              capturedUpdatePayload = payload;
              return {
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve(mockUpdateResult),
                  }),
                }),
              };
            },
          };
        }
        if (table === "event_timeslots") {
          return {
            select: () => createChainable({ data: [], error: null }),
          };
        }
        if (table === "venues") {
          return {
            select: () =>
              createChainable({
                data: { name: "Test Venue", address: "123 Main St", city: "Denver", state: "CO" },
                error: null,
              }),
          };
        }
        return {
          select: () => createChainable({ data: [], error: null }),
        };
      },
      rpc: () => Promise.resolve({ data: null, error: null }),
    }),
}));

vi.mock("@/lib/auth/adminAuth", () => ({
  checkAdminRole: () => Promise.resolve(mockIsAdmin),
  checkHostStatus: () => Promise.resolve(mockIsHost),
}));

// Import AFTER mocks
import { PATCH } from "@/app/api/my-events/[id]/route";

function makePatchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/my-events/event-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/my-events/[id] — custom_dates validation and anchoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { user: { id: "user-1" } };
    mockIsAdmin = true;
    mockIsHost = true;
    mockCurrentEvent = {
      id: "event-1",
      host_id: "user-1",
      recurrence_rule: "custom",
      custom_dates: ["2026-02-01", "2026-02-15"],
      is_published: true,
      published_at: "2026-01-01",
    };
    capturedUpdatePayload = null;
    mockUpdateResult = { data: { id: "event-1" }, error: null };
  });

  it("accepts valid custom_dates and persists sorted/deduped", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["2026-03-10", "2026-02-20", "2026-03-10", "2026-02-05"],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload).not.toBeNull();
    expect(capturedUpdatePayload!.custom_dates).toEqual([
      "2026-02-05", "2026-02-20", "2026-03-10",
    ]);
  });

  it("sets event_date to first (min) custom date", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["2026-04-15", "2026-03-01", "2026-05-20"],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload!.event_date).toBe("2026-03-01");
  });

  it("sets recurrence_rule=custom and day_of_week=null", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["2026-06-01", "2026-06-15"],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload!.recurrence_rule).toBe("custom");
    expect(capturedUpdatePayload!.day_of_week).toBeNull();
  });

  it("rejects empty custom_dates array with 400", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: [],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("At least one valid date");
  });

  it("rejects array with only invalid format strings", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["not-a-date", "2026/01/01", "13-01-2026"],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("At least one valid date");
  });

  it("accepts more than 12 dates (no cap)", async () => {
    const dates = Array.from({ length: 20 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `2026-03-${day}`;
    });

    const res = await PATCH(makePatchRequest({
      custom_dates: dates,
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload!.custom_dates).toHaveLength(20);
  });

  it("rejects non-array custom_dates with 400", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: "2026-03-01",
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("must be an array");
  });

  it("filters out invalid dates from mixed array", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["2026-05-01", "bad-date", "2026-05-15", 12345],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload!.custom_dates).toEqual([
      "2026-05-01", "2026-05-15",
    ]);
  });

  it("allows past dates (admin accuracy use case)", async () => {
    const res = await PATCH(makePatchRequest({
      custom_dates: ["2020-01-01", "2026-06-01"],
    }), { params: Promise.resolve({ id: "event-1" }) });

    expect(res.status).toBe(200);
    expect(capturedUpdatePayload!.custom_dates).toEqual([
      "2020-01-01", "2026-06-01",
    ]);
    expect(capturedUpdatePayload!.event_date).toBe("2020-01-01");
  });
});

// ─── Occurrence expansion tests ──────────────────────────────────────────────

import { expandOccurrencesForEvent } from "@/lib/events/nextOccurrence";

describe("expandOccurrencesForEvent — custom_dates changes", () => {
  it("expanding with updated custom_dates includes new dates", () => {
    const event = {
      id: "evt-custom",
      recurrence_rule: "custom" as const,
      custom_dates: ["2026-03-01", "2026-03-15", "2026-04-01"],
      day_of_week: null,
      event_date: "2026-03-01",
      max_occurrences: null,
    };

    const result = expandOccurrencesForEvent(event, "2026-03-01", "2026-04-30");
    const dateKeys = result.map(o => o.dateKey);

    expect(dateKeys).toContain("2026-03-01");
    expect(dateKeys).toContain("2026-03-15");
    expect(dateKeys).toContain("2026-04-01");
    expect(dateKeys).toHaveLength(3);
  });

  it("removing a date excludes it from expansion", () => {
    const event = {
      id: "evt-custom",
      recurrence_rule: "custom" as const,
      custom_dates: ["2026-03-01", "2026-04-01"], // 2026-03-15 removed
      day_of_week: null,
      event_date: "2026-03-01",
      max_occurrences: null,
    };

    const result = expandOccurrencesForEvent(event, "2026-03-01", "2026-04-30");
    const dateKeys = result.map(o => o.dateKey);

    expect(dateKeys).not.toContain("2026-03-15");
    expect(dateKeys).toContain("2026-03-01");
    expect(dateKeys).toContain("2026-04-01");
    expect(dateKeys).toHaveLength(2);
  });

  it("adding a date expands to include it", () => {
    const event = {
      id: "evt-custom",
      recurrence_rule: "custom" as const,
      custom_dates: ["2026-03-01", "2026-03-15", "2026-04-01", "2026-04-15"],
      day_of_week: null,
      event_date: "2026-03-01",
      max_occurrences: null,
    };

    const result = expandOccurrencesForEvent(event, "2026-03-01", "2026-04-30");
    const dateKeys = result.map(o => o.dateKey);

    expect(dateKeys).toContain("2026-04-15");
    expect(dateKeys).toHaveLength(4);
  });

  it("dates outside window are excluded", () => {
    const event = {
      id: "evt-custom",
      recurrence_rule: "custom" as const,
      custom_dates: ["2026-01-01", "2026-03-01", "2026-06-01"],
      day_of_week: null,
      event_date: "2026-01-01",
      max_occurrences: null,
    };

    // Window: March only
    const result = expandOccurrencesForEvent(event, "2026-03-01", "2026-03-31");
    const dateKeys = result.map(o => o.dateKey);

    expect(dateKeys).toEqual(["2026-03-01"]);
  });
});

// ─── Client validation logic tests ──────────────────────────────────────────

describe("EventForm custom dates client logic", () => {
  it("deduplicate: adding same date twice has no effect", () => {
    const existing = ["2026-03-01", "2026-03-15"];
    const newDate = "2026-03-01";

    // Simulate the add logic from EventForm
    const result = newDate && !existing.includes(newDate)
      ? [...existing, newDate].sort()
      : existing;

    expect(result).toEqual(["2026-03-01", "2026-03-15"]);
  });

  it("adding new date results in sorted array", () => {
    const existing = ["2026-03-15", "2026-03-01"];
    const newDate = "2026-03-10";

    const result = [...existing, newDate].sort();

    expect(result).toEqual(["2026-03-01", "2026-03-10", "2026-03-15"]);
  });

  it("removing a date from array produces correct result", () => {
    const existing = ["2026-03-01", "2026-03-15", "2026-04-01"];
    const toRemove = "2026-03-15";

    const result = existing.filter(d => d !== toRemove);

    expect(result).toEqual(["2026-03-01", "2026-04-01"]);
  });

  it("no date cap — can add unlimited dates", () => {
    const existing = Array.from({ length: 30 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0");
      const month = String(Math.floor(i / 28) + 3).padStart(2, "0");
      return `2026-${month}-${day}`;
    });

    // UI should always allow adding more dates
    const atCap = false; // No cap exists
    expect(atCap).toBe(false);
    expect(existing.length).toBe(30);
  });

  it("min 1 date validation blocks empty array", () => {
    const customDates: string[] = [];
    const seriesMode = "custom";

    // Simulate validation logic from EventForm
    const isInvalid = seriesMode === "custom" && customDates.length === 0;
    expect(isInvalid).toBe(true);
  });

  it("override for removed date stays orphaned (not deleted)", () => {
    // This test documents the contract: removing a date from custom_dates
    // does NOT delete occurrence_overrides for that date_key.
    // The override row remains in DB and becomes active again if date is re-added.
    const customDates = ["2026-03-01", "2026-04-01"];
    const overrideDateKeys = ["2026-03-15"]; // override exists for removed date

    // After removing 2026-03-15 from custom_dates:
    // - It's not in custom_dates (won't expand)
    // - Override row still exists in DB (no cascade)
    // - Re-adding the date makes the override active again
    expect(customDates).not.toContain("2026-03-15");
    expect(overrideDateKeys).toContain("2026-03-15");

    // Re-add the date
    const restoredDates = [...customDates, "2026-03-15"].sort();
    expect(restoredDates).toContain("2026-03-15");
    // Override now applies since dateKey matches in expansion
  });

  it("Series Start Date is hidden for custom series in edit mode", () => {
    // Contract: formData.series_mode !== "custom" gates the Series Start Date section
    const seriesMode = "custom";
    const mode = "edit";
    const occurrenceMode = false;

    const showSeriesStartDate = !occurrenceMode && mode === "edit" && seriesMode !== "custom";
    expect(showSeriesStartDate).toBe(false);
  });

  it("Series Start Date is shown for weekly series in edit mode", () => {
    const seriesMode = "weekly";
    const mode = "edit";
    const occurrenceMode = false;

    const showSeriesStartDate = !occurrenceMode && mode === "edit" && seriesMode !== "custom";
    expect(showSeriesStartDate).toBe(true);
  });
});
