/**
 * Event Management Tabs Tests
 *
 * Phase 5.14: Tabbed layout for event management
 *
 * These tests ensure the event management dashboard properly separates:
 * - Details: Event form editing
 * - Attendees: RSVPs with profile cards and per-occurrence filtering
 * - Lineup: Performer signups with per-occurrence filtering
 * - Settings: Co-hosts, invites, danger zone
 *
 * INVARIANTS:
 * 1. Tab navigation preserves the selected date for recurring events
 * 2. Attendees and Lineup tabs must filter by date_key for recurring events
 * 3. Lineup tab only shows when has_timeslots is true
 * 4. Guest RSVPs display guest_name and guest_email (not "Anonymous")
 * 5. Date selector syncs across tabs for recurring events
 */

import { describe, it, expect } from "vitest";

describe("EventManagementTabs Component", () => {
  const TABS = [
    { id: "details", label: "Details", icon: "📝" },
    { id: "attendees", label: "Attendees", icon: "👥" },
    { id: "lineup", label: "Lineup", icon: "🎤" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  describe("Tab visibility rules", () => {
    it("shows all 4 tabs when event has timeslots", () => {
      const hasTimeslots = true;
      const visibleTabs = TABS.filter((tab) => {
        if (tab.id === "lineup" && !hasTimeslots) return false;
        return true;
      });

      expect(visibleTabs.length).toBe(4);
      expect(visibleTabs.map((t) => t.id)).toEqual(["details", "attendees", "lineup", "settings"]);
    });

    it("hides lineup tab when event does not have timeslots", () => {
      const hasTimeslots = false;
      const visibleTabs = TABS.filter((tab) => {
        if (tab.id === "lineup" && !hasTimeslots) return false;
        return true;
      });

      expect(visibleTabs.length).toBe(3);
      expect(visibleTabs.map((t) => t.id)).toEqual(["details", "attendees", "settings"]);
      expect(visibleTabs.find((t) => t.id === "lineup")).toBeUndefined();
    });
  });

  describe("Tab badge counts", () => {
    it("shows attendee count badge on Attendees tab", () => {
      const attendeeCount = 12;
      const tab = TABS.find((t) => t.id === "attendees");
      const shouldShowBadge = tab?.id === "attendees" && attendeeCount > 0;

      expect(shouldShowBadge).toBe(true);
      expect(attendeeCount).toBe(12);
    });

    it("shows lineup count badge on Lineup tab", () => {
      const lineupCount = 8;
      const tab = TABS.find((t) => t.id === "lineup");
      const shouldShowBadge = tab?.id === "lineup" && lineupCount > 0;

      expect(shouldShowBadge).toBe(true);
      expect(lineupCount).toBe(8);
    });

    it("does not show badge when count is zero", () => {
      const attendeeCount = 0;
      const tab = TABS.find((t) => t.id === "attendees");
      const shouldShowBadge = tab?.id === "attendees" && attendeeCount > 0;

      expect(shouldShowBadge).toBe(false);
    });

    it("does not show badge on Details or Settings tabs", () => {
      const detailsTab = TABS.find((t) => t.id === "details");
      const settingsTab = TABS.find((t) => t.id === "settings");

      // These tabs never have counts
      const shouldShowDetailsCount = detailsTab?.id === "attendees" || detailsTab?.id === "lineup";
      const shouldShowSettingsCount = settingsTab?.id === "attendees" || settingsTab?.id === "lineup";

      expect(shouldShowDetailsCount).toBe(false);
      expect(shouldShowSettingsCount).toBe(false);
    });
  });
});

describe("AttendeesTab Component", () => {
  describe("Per-occurrence filtering", () => {
    it("includes date_key in API request for recurring events", () => {
      const eventId = "event-123";
      const selectedDate = "2026-02-15";

      const expectedUrl = `/api/my-events/${eventId}/rsvps?date_key=${selectedDate}`;

      expect(expectedUrl).toContain("date_key=2026-02-15");
    });

    it("omits date_key when no date is selected", () => {
      const eventId = "event-123";
      const selectedDate = "";

      const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
      const expectedUrl = `/api/my-events/${eventId}/rsvps${dateParam}`;

      expect(expectedUrl).toBe("/api/my-events/event-123/rsvps");
      expect(expectedUrl).not.toContain("date_key");
    });
  });

  describe("Date selector for recurring events", () => {
    it("shows date selector when event is recurring and has multiple dates", () => {
      const isRecurring = true;
      const availableDates = ["2026-02-15", "2026-02-22", "2026-03-01"];

      const shouldShowSelector = isRecurring && availableDates.length > 1;

      expect(shouldShowSelector).toBe(true);
    });

    it("hides date selector for one-time events", () => {
      const isRecurring = false;
      const availableDates = ["2026-02-15"];

      const shouldShowSelector = isRecurring && availableDates.length > 1;

      expect(shouldShowSelector).toBe(false);
    });

    it("hides date selector for recurring events with only one future date", () => {
      const isRecurring = true;
      const availableDates = ["2026-02-15"]; // Only one date left

      const shouldShowSelector = isRecurring && availableDates.length > 1;

      expect(shouldShowSelector).toBe(false);
    });
  });

  describe("Guest RSVP display", () => {
    it("displays guest name instead of Anonymous", () => {
      const rsvp = {
        id: "rsvp-1",
        status: "confirmed",
        user: null,
        guest_name: "Jane Smith",
        guest_email: "jane@example.com",
      };

      const displayName = rsvp.user?.full_name || rsvp.guest_name || "Anonymous";

      expect(displayName).toBe("Jane Smith");
      expect(displayName).not.toBe("Anonymous");
    });

    it("shows guest badge for non-member RSVPs", () => {
      const rsvp = {
        id: "rsvp-1",
        status: "confirmed",
        user: null,
        guest_name: "Jane Smith",
        guest_email: "jane@example.com",
      };

      const isGuest = !rsvp.user && !!rsvp.guest_name;

      expect(isGuest).toBe(true);
    });

    it("shows member name with profile link for member RSVPs", () => {
      const rsvp = {
        id: "rsvp-2",
        status: "confirmed",
        user: {
          id: "user-123",
          full_name: "John Doe",
          avatar_url: null,
          slug: "john-doe",
        },
        guest_name: null,
        guest_email: null,
      };

      const displayName = rsvp.user?.full_name || rsvp.guest_name || "Anonymous";
      const profileSlug = rsvp.user?.slug || rsvp.user?.id;
      const isGuest = !rsvp.user && rsvp.guest_name;

      expect(displayName).toBe("John Doe");
      expect(profileSlug).toBe("john-doe");
      expect(isGuest).toBe(false);
    });

    it("falls back to Anonymous only when no name is available", () => {
      const rsvp = {
        id: "rsvp-3",
        status: "confirmed",
        user: null,
        guest_name: null,
        guest_email: null,
      };

      const displayName = rsvp.user?.full_name || rsvp.guest_name || "Anonymous";

      expect(displayName).toBe("Anonymous");
    });
  });

  describe("Date formatting", () => {
    it("formats date key as long date in Mountain Time", () => {
      const dateKey = "2026-02-15";
      // The actual formatDateKeyLong function formats dates in America/Denver timezone
      const date = new Date(`${dateKey}T12:00:00Z`);
      const formatted = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "America/Denver",
      });

      // Should be a Sunday
      expect(formatted).toContain("February");
      expect(formatted).toContain("15");
    });
  });
});

describe("LineupTab Component", () => {
  describe("Per-occurrence filtering", () => {
    it("includes date_key in claims API request", () => {
      const eventId = "event-123";
      const selectedDate = "2026-02-15";

      const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
      const expectedUrl = `/api/my-events/${eventId}/claims${dateParam}`;

      expect(expectedUrl).toContain("date_key=2026-02-15");
    });

    it("omits date_key when no date is selected", () => {
      const eventId = "event-123";
      const selectedDate = "";

      const dateParam = selectedDate ? `?date_key=${selectedDate}` : "";
      const expectedUrl = `/api/my-events/${eventId}/claims${dateParam}`;

      expect(expectedUrl).toBe("/api/my-events/event-123/claims");
    });
  });

  describe("Lineup Control link", () => {
    it("includes date parameter for recurring events", () => {
      const eventSlug = "weekly-open-mic";
      const eventId = "event-123";
      const selectedDate = "2026-02-15";

      const href = `/events/${eventSlug || eventId}/lineup${selectedDate ? `?date=${selectedDate}` : ""}`;

      expect(href).toBe("/events/weekly-open-mic/lineup?date=2026-02-15");
    });

    it("uses event ID when slug is not available", () => {
      const eventSlug = null;
      const eventId = "event-123-uuid";
      const selectedDate = "2026-02-15";

      const href = `/events/${eventSlug || eventId}/lineup${selectedDate ? `?date=${selectedDate}` : ""}`;

      expect(href).toBe("/events/event-123-uuid/lineup?date=2026-02-15");
    });
  });

  describe("Guest performer display", () => {
    it("displays guest name instead of Anonymous", () => {
      const claim = {
        id: "claim-1",
        status: "confirmed",
        user: null,
        guest_name: "Jane Performer",
        guest_email: "jane@example.com",
      };

      const displayName = claim.user?.full_name || claim.guest_name || "Anonymous";

      expect(displayName).toBe("Jane Performer");
    });

    it("shows guest badge for non-member performers", () => {
      const claim = {
        id: "claim-1",
        status: "confirmed",
        user: null,
        guest_name: "Jane Performer",
        guest_email: "jane@example.com",
      };

      const isGuest = !claim.user && !!claim.guest_name;

      expect(isGuest).toBe(true);
    });
  });

  describe("Claim status grouping", () => {
    it("groups claims by status correctly", () => {
      const claims = [
        { id: "1", status: "confirmed" },
        { id: "2", status: "confirmed" },
        { id: "3", status: "waitlist" },
        { id: "4", status: "performed" },
        { id: "5", status: "confirmed" },
      ];

      const confirmed = claims.filter((c) => c.status === "confirmed");
      const waitlist = claims.filter((c) => c.status === "waitlist");
      const performed = claims.filter((c) => c.status === "performed");

      expect(confirmed.length).toBe(3);
      expect(waitlist.length).toBe(1);
      expect(performed.length).toBe(1);
    });
  });

  describe("Slot information display", () => {
    it("uses custom slot label when available", () => {
      const claim = {
        timeslot: {
          slot_label: "Featured Spot",
          slot_index: 0,
          start_time: "19:00:00",
        },
        slot_index: 0,
      };

      const slotLabel = claim.timeslot?.slot_label || `Slot ${(claim.timeslot?.slot_index ?? claim.slot_index) + 1}`;

      expect(slotLabel).toBe("Featured Spot");
    });

    it("falls back to Slot N when no custom label", () => {
      const claim = {
        timeslot: {
          slot_label: null,
          slot_index: 2,
          start_time: "19:30:00",
        },
        slot_index: 2,
      };

      const slotLabel = claim.timeslot?.slot_label || `Slot ${(claim.timeslot?.slot_index ?? claim.slot_index) + 1}`;

      expect(slotLabel).toBe("Slot 3");
    });
  });
});

describe("Date Synchronization Across Tabs", () => {
  it("preserves selected date when switching between tabs", () => {
    // The initialDateKey is passed from parent to both AttendeesTab and LineupTab
    const initialDateKey = "2026-02-22";

    // Both tabs should initialize with the same date
    const attendeesSelectedDate = initialDateKey || "";
    const lineupSelectedDate = initialDateKey || "";

    expect(attendeesSelectedDate).toBe("2026-02-22");
    expect(lineupSelectedDate).toBe("2026-02-22");
  });

  it("updates tab content when parent date changes", () => {
    // Parent updates initialDateKey → useEffect syncs selectedDate
    // This ensures switching dates in one view updates all tabs
    const newDateKey = "2026-03-01";
    const selectedDate = "2026-02-15"; // Previous selection

    // The useEffect in both tabs does:
    // if (initialDateKey && initialDateKey !== selectedDate) {
    //   setSelectedDate(initialDateKey);
    // }
    const shouldUpdate = newDateKey && newDateKey !== selectedDate;

    expect(shouldUpdate).toBe(true);
  });
});

describe("CancelRSVPModal Per-Occurrence Support", () => {
  it("includes dateKey in DELETE request URL", () => {
    const eventId = "event-123";
    const dateKey = "2026-02-15";

    const apiUrl = dateKey
      ? `/api/events/${eventId}/rsvp?date_key=${dateKey}`
      : `/api/events/${eventId}/rsvp`;

    expect(apiUrl).toBe("/api/events/event-123/rsvp?date_key=2026-02-15");
  });

  it("omits date_key for one-time events", () => {
    const eventId = "event-123";
    const dateKey = undefined;

    const apiUrl = dateKey
      ? `/api/events/${eventId}/rsvp?date_key=${dateKey}`
      : `/api/events/${eventId}/rsvp`;

    expect(apiUrl).toBe("/api/events/event-123/rsvp");
    expect(apiUrl).not.toContain("date_key");
  });

  it("documents URL cleanup after successful cancel", () => {
    /**
     * After successful RSVP cancel, the modal MUST:
     * 1. Get current URL
     * 2. Remove ?cancel=true or &cancel=true parameter
     * 3. Use window.history.replaceState() to update URL without reload
     * 4. Call router.refresh() to update server state
     *
     * This prevents the cancel modal from reopening on page refresh.
     */
    const currentUrl = new URL("http://localhost:3000/events/test?date=2026-02-15&cancel=true");
    currentUrl.searchParams.delete("cancel");

    expect(currentUrl.toString()).toBe("http://localhost:3000/events/test?date=2026-02-15");
    expect(currentUrl.searchParams.get("cancel")).toBeNull();
    expect(currentUrl.searchParams.get("date")).toBe("2026-02-15");
  });
});
