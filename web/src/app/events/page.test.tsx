import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock Supabase to return a non-open-mic event and support the .neq().order() chain
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

  const mockAllEvents = [
    ...mockNonOpenEvents,
    {
      id: "event-2",
      title: "Neighborhood Open Mic",
      event_type: "open_mic",
    },
  ];

  return {
    createSupabaseServerClient: async () => ({
      from: () => ({
        select: () => ({
          // .neq should return only non-open-mic events
          neq: () => ({
            order: () => ({ data: mockNonOpenEvents, error: null }),
          }),
          // generic order (used in other code paths) returns all events
          order: () => ({ data: mockAllEvents, error: null }),
        }),
      }),
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
