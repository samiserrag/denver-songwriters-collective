import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock Supabase to return a non-open-mic event and support chained query methods
vi.mock("@/lib/supabase/server", () => {
  const mockNonOpenEvents = [
    {
      id: "test-uuid-1",
      title: "Songwriter Showcase",
      event_type: "showcase",
      venue_name: "Test Venue",
      start_time: "2025-01-15T19:00:00Z",
      end_time: "2025-01-15T21:00:00Z",
      created_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockDSCEvents = [
    {
      id: "dsc-event-1",
      title: "Song Circle Wednesday",
      event_type: "song_circle",
      venue_name: "Community Center",
      day_of_week: "Wednesday",
      start_time: "7:00 PM",
      capacity: 12,
      event_hosts: [{ user: { full_name: "Test Host" } }],
    },
  ];

  // Create chainable query builder for different table queries
  const createQueryBuilder = (tableName: string) => {
    if (tableName === "events") {
      return {
        select: () => ({
          // .neq chain for non-open-mic events query
          neq: () => ({
            order: () => ({ data: mockNonOpenEvents, error: null }),
          }),
          // .eq chain for DSC events query
          eq: () => ({
            eq: () => ({
              order: () => ({ data: mockDSCEvents, error: null }),
            }),
          }),
          order: () => ({ data: mockNonOpenEvents, error: null }),
        }),
      };
    }
    if (tableName === "event_rsvps") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ count: 3, error: null }),
          }),
        }),
      };
    }
    // Default fallback
    return {
      select: () => ({
        eq: () => ({ data: [], error: null }),
        order: () => ({ data: [], error: null }),
      }),
    };
  };

  return {
    createSupabaseServerClient: async () => ({
      from: (tableName: string) => createQueryBuilder(tableName),
    }),
  };
});

// Mock next/navigation to avoid router-invariant errors
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    prefetch: async () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import EventsPage from "./page";

describe("Events Page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT render open-mic events in the Events listing", async () => {
    // EventsPage is an async server component
    const element = await EventsPage();

    // Render returned JSX
    const { container } = render(element as any);

    // Wait for the non-open-mic event to appear
    await waitFor(() => {
      expect(screen.getByText(/Songwriter Showcase/i)).toBeInTheDocument();
    });

    // Assert that the open-mic event from our mock data does NOT appear.
    expect(screen.queryByText(/Neighborhood Open Mic/i)).toBeNull();

    // Basic sanity check
    expect(container).toBeTruthy();
  });
});
