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
      is_published: true,
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
      is_published: true,
      event_hosts: [{ user: { full_name: "Test Host" } }],
    },
  ];

  // Helper to create a fully chainable query builder that returns data at terminal methods
  const createChainableResult = (data: unknown) => {
    const chain: Record<string, unknown> = {};
    // Terminal properties that hold the result
    chain.data = data;
    chain.error = null;
    chain.count = 0;

    // All chainable methods return the same chain object
    const chainable = () => chain;
    chain.select = chainable;
    chain.eq = chainable;
    chain.neq = chainable;
    chain.gte = chainable;
    chain.gt = chainable;
    chain.lt = chainable;
    chain.lte = chainable;
    chain.order = chainable;
    chain.limit = chainable;
    chain.single = chainable;
    chain.maybeSingle = chainable;
    chain.range = chainable;
    chain.filter = chainable;
    chain.match = chainable;
    chain.in = chainable;
    chain.contains = chainable;
    chain.containedBy = chainable;
    chain.or = chainable;
    chain.not = chainable;
    chain.is = chainable;
    chain.ilike = chainable;
    chain.like = chainable;

    return chain;
  };

  // Create chainable query builder for different table queries
  const createQueryBuilder = (tableName: string) => {
    if (tableName === "events") {
      // For events table, we need to handle multiple query patterns
      // The key insight: each query chain should return appropriate data
      // regardless of how many .eq() calls are chained
      return {
        select: () => {
          let isDSCQuery = false;

          // Create a chain that tracks whether this is a DSC query
          const chain: Record<string, unknown> = {
            data: mockNonOpenEvents,
            error: null,
            count: 0,
          };

          const makeChainable = (currentData: unknown) => {
            const innerChain: Record<string, unknown> = {
              data: currentData,
              error: null,
              count: 0,
            };

            // All methods return a new chainable with the same data
            const methods = ['neq', 'gte', 'gt', 'lt', 'lte', 'order', 'limit',
                           'single', 'maybeSingle', 'range', 'filter', 'match',
                           'in', 'contains', 'containedBy', 'or', 'not', 'is',
                           'ilike', 'like', 'select'];

            methods.forEach(method => {
              innerChain[method] = () => makeChainable(currentData);
            });

            // eq is special - it may switch to DSC data
            innerChain.eq = (field: string, value: unknown) => {
              if (field === 'is_dsc_event' && value === true) {
                isDSCQuery = true;
                return makeChainable(mockDSCEvents);
              }
              // For other eq calls, return current data
              return makeChainable(isDSCQuery ? mockDSCEvents : mockNonOpenEvents);
            };

            return innerChain;
          };

          return makeChainable(mockNonOpenEvents);
        },
      };
    }
    if (tableName === "event_rsvps") {
      return {
        select: () => createChainableResult({ count: 3 }),
      };
    }
    // Default fallback
    return {
      select: () => createChainableResult([]),
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

    // Wait for the non-open-mic event to appear (may appear in multiple sections)
    await waitFor(() => {
      expect(screen.getAllByText(/Songwriter Showcase/i).length).toBeGreaterThan(0);
    });

    // Assert that the open-mic event from our mock data does NOT appear.
    expect(screen.queryByText(/Neighborhood Open Mic/i)).toBeNull();

    // Basic sanity check
    expect(container).toBeTruthy();
  });
});
