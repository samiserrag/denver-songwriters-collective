import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { mapDBEventToEvent } from "@/app/page";
import { HappeningCard } from "@/components/happenings/HappeningCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt || ""} {...props} />
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
  }),
}));

describe("Phase 7B side tract: homepage DSC rail confirmed parity", () => {
  it("homepage mapper preserves verification/location fields needed by HappeningCard", () => {
    const dbEvent = {
      id: "event-1",
      slug: "sloan-lake-song-circle-jam-2026-02-01",
      title: "Sloan Lake Song Circle Jam",
      description: "Community jam.",
      event_date: "2026-02-08",
      start_time: "19:00:00",
      end_time: "21:00:00",
      day_of_week: null,
      recurrence_rule: "custom",
      venue_name: "Sloan's Lake Tap",
      venue_address: "123 Main St",
      venue_id: "venue-1",
      location_mode: "venue",
      custom_location_name: null,
      online_url: null,
      age_policy: "21+",
      status: "active",
      last_verified_at: "2026-02-07T04:45:05.356Z",
      verified_by: "admin-1",
      source: "manual",
      is_dsc_event: true,
      is_published: true,
      has_timeslots: false,
      total_slots: null,
      capacity: 40,
      rsvp_count: 8,
      claimed_slots: 0,
      cover_image_url: null,
      host_id: "host-1",
    };

    const mapped = mapDBEventToEvent(dbEvent as never);

    expect(mapped.status).toBe("active");
    expect(mapped.last_verified_at).toBe("2026-02-07T04:45:05.356Z");
    expect(mapped.venue_id).toBe("venue-1");
    expect((mapped as { location_mode?: string }).location_mode).toBe("venue");
    expect((mapped as { age_policy?: string }).age_policy).toBe("21+");
  });

  it("renders Confirmed and does not render Unconfirmed or Missing details for mapped DSC rail event", () => {
    const dbEvent = {
      id: "event-1",
      slug: "sloan-lake-song-circle-jam-2026-02-01",
      title: "Sloan Lake Song Circle Jam",
      description: "Community jam.",
      event_date: "2026-02-08",
      start_time: "19:00:00",
      end_time: "21:00:00",
      day_of_week: null,
      recurrence_rule: "custom",
      venue_name: "Sloan's Lake Tap",
      venue_address: "123 Main St",
      venue_id: "venue-1",
      location_mode: "venue",
      custom_location_name: null,
      online_url: null,
      age_policy: "21+",
      status: "active",
      last_verified_at: "2026-02-07T04:45:05.356Z",
      verified_by: "admin-1",
      source: "manual",
      is_dsc_event: true,
      is_published: true,
      has_timeslots: false,
      total_slots: null,
      capacity: 40,
      rsvp_count: 8,
      claimed_slots: 0,
      cover_image_url: null,
      host_id: "host-1",
    };

    const mapped = mapDBEventToEvent(dbEvent as never);

    render(
      <HappeningCard
        event={mapped as never}
        occurrence={{
          date: "2026-02-08",
          isToday: false,
          isTomorrow: false,
          isConfident: true,
          reason: "custom_dates",
        }}
        todayKey="2026-02-07"
      />
    );

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Unconfirmed")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing details")).not.toBeInTheDocument();
  });

  it("homepage source keeps full db fields in mapDBEventToEvent", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/page.tsx", "utf-8");

    expect(source).toMatch(/function mapDBEventToEvent[\s\S]*return\s*{[\s\S]*\.\.\.dbEvent/);
  });
});
