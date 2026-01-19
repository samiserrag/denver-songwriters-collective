
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock suggestion object matching the table component expectations
const mockSuggestion = {
  id: 1,
  batch_id: "batch-uuid-123",
  event_id: "event-uuid-456",
  field: "start_time",
  old_value: "7:00 PM",
  new_value: "8:00 PM",
  notes: "The time was wrong on the flyer",
  status: "pending",
  created_at: "2024-12-31T17:00:00Z",
  reviewed_at: null,
  reviewed_by: null,
  submitter_email: "tester@example.com",
  submitter_name: "Test User",
  admin_response: null,
  // Joined events data that the table expects
  events: {
    id: "event-uuid-456",
    title: "Test Open Mic Night",
    slug: "test-open-mic-night",
    venue_name: "Test Venue",
    day_of_week: "Monday",
    start_time: "7:00 PM",
  },
};

// Updated Supabase mock to match the page query pattern
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: "admin-user-id", email: "admin@test.com" } },
          error: null,
        })
      ),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        // Support profile role check: .eq(...).single()
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: { role: "admin" }, error: null })),
        })),
        // Support profiles lookup: .in()
        in: vi.fn(() => ({ data: [], error: null })),
        // Support listing suggestions: .order()
        order: vi.fn(() => ({ data: [mockSuggestion], error: null })),
      })),
    })),
  })),
}));

// Mock next/navigation to avoid router-related runtime errors
vi.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
  };
});

import AdminEventUpdateSuggestionsPage from "./page";

describe("Admin Event Update Suggestions Page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders suggestions rows and admin action controls", async () => {
    const element = await AdminEventUpdateSuggestionsPage();
    render(element as any);

    await waitFor(() => expect(screen.getByText("8:00 PM")).toBeInTheDocument());

    // The table shows: Event (title), Field, Current (old_value), Suggested (new_value), Submitter, Status, Created, Actions
    expect(screen.getByText("Test Open Mic Night")).toBeInTheDocument();
    expect(screen.getByText("start_time")).toBeInTheDocument();
    expect(screen.getByText("7:00 PM")).toBeInTheDocument(); // old_value (Current)
    expect(screen.getByText("Test User")).toBeInTheDocument(); // submitter_name
    expect(screen.getByText("pending")).toBeInTheDocument();

    // Admin action buttons should be present for pending suggestions
    const possibleActionLabels = ["Approve", "Reject", "Need Info", "Delete"];
    const anyActionPresent = possibleActionLabels.some((label) => screen.queryByText(label) !== null);
    expect(anyActionPresent).toBe(true);
  });
});
