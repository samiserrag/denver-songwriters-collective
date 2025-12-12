const mockSearchParams = Promise.resolve({});
import { vi, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock the supabase server client to avoid Next.js runtime cookies() calls
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => {
    const result = { data: [], error: null, count: 0 };
    const chain = {
      select: () => chain,
      not: () => chain,
      in: () => chain,
      eq: () => chain,
      or: () => chain,
      then: (resolve: any) => resolve(result),
    };
    return {
      from: () => chain,
    };
  },
}));

// Mock next/navigation useRouter to avoid router-invariant errors
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    refresh: () => {},
    prefetch: async () => {},
  }),
}));

import Page from "./page";

describe("Open Mics Page", () => {
  it("renders the Help Us Keep This List Accurate banner", async () => {
    render(await Page({ searchParams: mockSearchParams }));

    expect(
      screen.getByText(/help us keep this list accurate/i)
    ).toBeInTheDocument();
  });
});
