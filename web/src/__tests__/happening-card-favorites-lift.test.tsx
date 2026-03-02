/**
 * Behavioral regression tests for Option A: Server-side favorites lift.
 *
 * Validates the tri-state isFavorited prop contract on HappeningCard:
 *  - isFavorited=true  → renders favorited, NO client-side favorites query
 *  - isFavorited=false → renders unfavorited, NO client-side favorites query
 *  - isFavorited=null  → renders unfavorited (anonymous), NO client-side favorites query
 *  - isFavorited=undefined (omitted) → triggers client-side fallback via .from("favorites")
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HappeningCard } from "@/components/happenings/HappeningCard";

// ── Mocks ──────────────────────────────────────────────────────────

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

// Track .from("favorites") calls
const fromFavoritesSpy = vi.fn();

// Build a chainable mock that records when .from("favorites") is called
function createMockSupabase(opts: { sessionUser?: { id: string } | null } = {}) {
  const user = opts.sessionUser ?? null;

  const favoritesChain = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  };

  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: user ? { user } : null },
      })),
    },
    from: vi.fn((table: string) => {
      if (table === "favorites") {
        fromFavoritesSpy();
        return favoritesChain;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => mockSupabase,
}));

// ── Test fixtures ──────────────────────────────────────────────────

const baseEvent = {
  id: "event-abc",
  slug: "test-open-mic",
  title: "Test Open Mic Night",
  event_date: "2026-03-15",
  start_time: "19:00:00",
  status: "active" as const,
};

// ── Test suite ─────────────────────────────────────────────────────

describe("HappeningCard favorites lift (Option A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromFavoritesSpy.mockClear();
  });

  it("isFavorited=true → renders ★, no .from('favorites') query", async () => {
    mockSupabase = createMockSupabase();

    render(<HappeningCard event={baseEvent} isFavorited={true} />);

    // Wait for useEffect to settle
    await waitFor(() => {
      expect(screen.getByLabelText("Remove favorite")).toBeDefined();
    });

    // Star should be filled
    expect(screen.getByText("★")).toBeDefined();

    // No client-side favorites query
    expect(fromFavoritesSpy).not.toHaveBeenCalled();
  });

  it("isFavorited=false → renders ☆, no .from('favorites') query", async () => {
    mockSupabase = createMockSupabase();

    render(<HappeningCard event={baseEvent} isFavorited={false} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add favorite")).toBeDefined();
    });

    expect(screen.getByText("☆")).toBeDefined();

    // No client-side favorites query
    expect(fromFavoritesSpy).not.toHaveBeenCalled();
  });

  it("isFavorited=null (anonymous) → renders ☆, no .from('favorites') query", async () => {
    mockSupabase = createMockSupabase();

    render(<HappeningCard event={baseEvent} isFavorited={null} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Add favorite")).toBeDefined();
    });

    expect(screen.getByText("☆")).toBeDefined();

    // No client-side favorites query
    expect(fromFavoritesSpy).not.toHaveBeenCalled();
  });

  it("isFavorited=undefined (omitted) with logged-in user → triggers exactly one .from('favorites') fallback query", async () => {
    mockSupabase = createMockSupabase({
      sessionUser: { id: "user-123" },
    });

    render(<HappeningCard event={baseEvent} />);

    // Wait for the useEffect fallback to fire
    await waitFor(() => {
      expect(fromFavoritesSpy).toHaveBeenCalled();
    });

    // Exactly one favorites query for this card
    expect(fromFavoritesSpy).toHaveBeenCalledTimes(1);
  });

  it("isFavorited=undefined (omitted) with anonymous user → calls getSession but no .from('favorites') query", async () => {
    mockSupabase = createMockSupabase({ sessionUser: null });

    render(<HappeningCard event={baseEvent} />);

    // Wait for useEffect to settle
    await waitFor(() => {
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    // Anonymous: getSession returns null user, so no favorites query
    expect(fromFavoritesSpy).not.toHaveBeenCalled();
  });
});
