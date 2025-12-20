
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// NEW full mock suggestion object (matches table output)
const mockSuggestion = {
  id: 1,
  batch_id: "batch-uuid-123",
  event_id: "event-uuid-456",
  field: "start_time",
  old_value: "7:00 PM",
  new_value: "Correct event date",
  notes: "The time was wrong on the flyer",
  status: "pending",
  created_at: "2024-12-31T17:00:00Z",
  reviewed_at: null,
  reviewed_by: null,
  submitter_email: "tester@example.com",
  submitter_name: "Test User",
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
    from: vi.fn((tableName?: string) => ({
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

    await waitFor(() => expect(screen.getByText("Correct event date")).toBeInTheDocument());

    // The table renders batch_id / event_id / field / old / new — assert those instead of venue
    expect(screen.getByText(/batch-uuid-123/)).toBeInTheDocument();
    expect(screen.getByText(/event-uuid-456/)).toBeInTheDocument();
    expect(screen.getByText("start_time")).toBeInTheDocument();

    const possibleActionLabels = ["Approve", "Reject", "Delete"];
    const anyActionPresent = possibleActionLabels.some((label) => screen.queryByText(label) !== null);
    expect(anyActionPresent).toBe(true);
  });
});
