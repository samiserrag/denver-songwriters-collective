import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("UX-11 recurring event sharing reliability", () => {
  it("renders recurring slug without redirect markers when date is omitted", async () => {
    vi.resetModules();

    const redirectSpy = vi.fn((to: string) => {
      throw new Error(`UNEXPECTED_REDIRECT:${to}`);
    });
    const notFoundSpy = vi.fn(() => {
      throw new Error("UNEXPECTED_NOT_FOUND");
    });

    vi.doMock("next/navigation", () => ({
      redirect: redirectSpy,
      notFound: notFoundSpy,
    }));

    vi.doMock("next/link", () => ({
      default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>
          {children}
        </a>
      ),
    }));

    vi.doMock("next/image", () => ({
      default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
    }));

    const recurringEvent = {
      id: "event-1",
      title: "Renegade Brewing Open Mic Night",
      description: "Weekly open mic in Denver",
      event_type: "open_mic",
      venue_name: null,
      venue_address: null,
      venue_id: null,
      day_of_week: "Tuesday",
      start_time: "19:00:00",
      end_time: "21:00:00",
      capacity: null,
      cover_image_url: null,
      is_dsc_event: true,
      status: "approved",
      created_at: "2026-02-01T00:00:00.000Z",
      event_date: "2026-02-04",
      slug: "renegade-brewing-open-mic-night",
      has_timeslots: false,
      total_slots: null,
      slot_duration_minutes: null,
      is_published: true,
      is_recurring: true,
      recurrence_pattern: "weekly",
      recurrence_rule: "weekly",
      max_occurrences: null,
      custom_location_name: null,
      custom_address: null,
      custom_city: null,
      custom_state: null,
      custom_latitude: null,
      custom_longitude: null,
      location_notes: null,
      location_mode: null,
      is_free: true,
      cost_label: null,
      age_policy: null,
      host_id: null,
      source: "manual",
      last_verified_at: null,
      verified_by: null,
      series_id: null,
      external_url: null,
      timezone: "America/Denver",
      online_url: null,
      signup_url: null,
      signup_mode: null,
      custom_dates: null,
      signup_time: null,
    };

    function createQuery(table: string, options?: { count?: "exact"; head?: boolean }) {
      const filters: Record<string, unknown> = {};
      const query: {
        eq: (column: string, value: unknown) => typeof query;
        in: (column: string, values: unknown[]) => typeof query;
        order: (column: string, opts?: unknown) => typeof query;
        limit: (value: number) => Promise<Record<string, unknown>>;
        single: () => Promise<Record<string, unknown>>;
        maybeSingle: () => Promise<Record<string, unknown>>;
        then: (resolve: (value: Record<string, unknown>) => unknown) => Promise<unknown>;
      } = {
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return query;
        },
        in: () => query,
        order: () => query,
        limit: async () => resultFor(table, filters, options),
        single: async () => resultFor(table, filters, options, "single"),
        maybeSingle: async () => resultFor(table, filters, options, "maybeSingle"),
        then: (resolve: (value: Record<string, unknown>) => unknown) => {
          return Promise.resolve(resolve(resultFor(table, filters, options)));
        },
      };
      return query;
    }

    function resultFor(
      table: string,
      _filters: Record<string, unknown>,
      options?: { count?: "exact"; head?: boolean },
      mode: "single" | "maybeSingle" | "list" = "list"
    ): Record<string, unknown> {
      if (table === "events") {
        if (mode === "maybeSingle") return { data: null, error: null };
        return { data: recurringEvent, error: null };
      }

      if (table === "occurrence_overrides") {
        if (mode === "maybeSingle") return { data: null, error: null };
        return { data: [], error: null };
      }

      if (table === "event_hosts") {
        return { data: [], error: null };
      }

      if (table === "profiles") {
        return { data: [], error: null };
      }

      if (table === "event_rsvps" && options?.count === "exact" && options?.head === true) {
        return { count: 0, error: null };
      }

      if (table === "gallery_images") {
        return { data: [], error: null };
      }

      if (table === "venues") {
        if (mode === "single") return { data: null, error: null };
        return { data: [], error: null };
      }

      if (table === "event_claims") {
        return { data: null, error: null };
      }

      if (table === "event_watchers") {
        return { data: null, error: null };
      }

      if (table === "event_timeslots") {
        return { data: [], error: null };
      }

      if (table === "timeslot_claims" && options?.count === "exact" && options?.head === true) {
        return { count: 0, error: null };
      }

      return { data: [], error: null };
    }

    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
        from: (table: string) => ({
          select: (_columns: string, options?: { count?: "exact"; head?: boolean }) =>
            createQuery(table, options),
        }),
      }),
    }));

    vi.doMock("@/types/events", () => ({
      EVENT_TYPE_CONFIG: {
        open_mic: { label: "Open Mic", icon: "mic", color: "amber" },
        other: { label: "Happening", icon: "music", color: "amber" },
      },
    }));

    vi.doMock("@/components/events/RSVPSection", () => ({
      RSVPSection: () => <div data-testid="rsvp-section">RSVP</div>,
    }));
    vi.doMock("@/components/events/AddToCalendarButton", () => ({
      AddToCalendarButton: () => <div data-testid="calendar-button">Calendar</div>,
    }));
    vi.doMock("@/components/events/TimeslotSection", () => ({
      TimeslotSection: () => <div data-testid="timeslot-section">Timeslots</div>,
    }));
    vi.doMock("@/components/events/HostControls", () => ({
      HostControls: () => <div data-testid="host-controls">Host Controls</div>,
    }));
    vi.doMock("@/components/events/ClaimEventButton", () => ({
      ClaimEventButton: () => <div data-testid="claim-button">Claim</div>,
    }));
    vi.doMock("@/components/events/AttendeeList", () => ({
      AttendeeList: () => <div data-testid="attendee-list">Attendees</div>,
    }));
    vi.doMock("@/components/events/EventComments", () => ({
      EventComments: () => <div data-testid="event-comments">Comments</div>,
    }));
    vi.doMock("@/components/events/WatchEventButton", () => ({
      WatchEventButton: () => <div data-testid="watch-button">Watch</div>,
    }));
    vi.doMock("@/components/events/VerifyEventButton", () => ({
      VerifyEventButton: () => <div data-testid="verify-button">Verify</div>,
    }));
    vi.doMock("@/components/events/SuggestUpdateSection", () => ({
      SuggestUpdateSection: () => <div data-testid="suggest-update">Suggest Update</div>,
    }));
    vi.doMock("@/components/media", () => ({
      PosterMedia: () => <div data-testid="poster-media">Poster</div>,
    }));
    vi.doMock("@/components/venue/VenueLink", () => ({
      VenueLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    }));
    vi.doMock("@/components/shared/QrShareBlock", () => ({
      QrShareBlock: () => <div data-testid="qr-share">QR Share</div>,
    }));

    vi.doMock("@/lib/auth/adminAuth", () => ({
      checkAdminRole: async () => false,
    }));
    vi.doMock("@/lib/events/missingDetails", () => ({
      hasMissingDetails: () => false,
    }));
    vi.doMock("@/lib/events/verification", () => ({
      getPublicVerificationState: () => ({ state: "confirmed" }),
      formatVerifiedDate: () => null,
      shouldShowUnconfirmedBadge: () => false,
    }));
    vi.doMock("@/lib/events/recurrenceContract", () => ({
      interpretRecurrence: () => ({ isRecurring: true, isConfident: true }),
      labelFromRecurrence: () => "Every Tuesday",
    }));
    vi.doMock("@/lib/events/nextOccurrence", () => ({
      expandOccurrencesForEvent: () => [{ dateKey: "2026-02-25", isConfident: true }],
      getTodayDenver: () => "2026-02-10",
      addDaysDenver: () => "2026-05-10",
    }));
    vi.doMock("@/lib/events/occurrenceWindow", () => ({
      getOccurrenceWindowNotice: () => ({ detail: "Showing the next 90 days of occurrences." }),
    }));
    vi.doMock("@/lib/venue/getDirectionsUrl", () => ({
      getVenueDirectionsUrl: () => "https://maps.google.com",
    }));
    vi.doMock("@/lib/events/signupMeta", () => ({
      getSignupMeta: () => ({ show: false, type: null, label: "" }),
    }));

    const mod = await import("@/app/events/[id]/page");
    const element = await mod.default({
      params: Promise.resolve({ id: "renegade-brewing-open-mic-night" }),
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(element as React.ReactElement);

    expect(redirectSpy).not.toHaveBeenCalledWith(expect.stringContaining("?date="));
    expect(html).not.toContain("NEXT_REDIRECT");
    expect(html).not.toContain("__next-page-redirect");
  });
});
