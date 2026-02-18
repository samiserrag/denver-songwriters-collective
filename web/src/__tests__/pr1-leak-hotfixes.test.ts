/**
 * PR1: Leak Hotfix Tests
 *
 * Verifies that pre-existing metadata leaks are fixed:
 * 1. OG event route must filter by is_published=true (no draft/cancelled event metadata exposure)
 * 2. Search API must filter non-open-mic events by is_published=true AND status=active
 *
 * These are source-code contract tests — they read the actual route source files
 * and verify the required filters are present. This approach catches regressions
 * without requiring a running server or Supabase connection.
 *
 * @see docs/investigation/private-invite-only-events-stopgate.md §1
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC_ROOT = join(__dirname, "..");

describe("PR1: OG Event Route Leak Fix", () => {
  const ogRouteSource = readFileSync(
    join(SRC_ROOT, "app/og/event/[id]/route.tsx"),
    "utf-8"
  );

  it("must filter events by is_published=true", () => {
    // The OG route must include .eq("is_published", true) to prevent
    // draft/cancelled events from leaking metadata via OG image crawlers
    expect(ogRouteSource).toContain('.eq("is_published", true)');
  });

  it("must return generic fallback for unpublished events (no title leak)", () => {
    // When event is null (unpublished/missing), the route must render
    // a generic card without any event-specific metadata
    expect(ogRouteSource).toContain("if (!event)");
    // Fallback must use generic "Happening" title, not the real event title
    expect(ogRouteSource).toContain('title: "Happening"');
  });

  it("must include is_published in select fields", () => {
    // The select must fetch is_published to enable the filter
    expect(ogRouteSource).toContain("is_published");
  });
});

describe("PR1: Search API Leak Fix", () => {
  const searchRouteSource = readFileSync(
    join(SRC_ROOT, "app/api/search/route.ts"),
    "utf-8"
  );

  it("must filter non-open-mic events by is_published=true", () => {
    // The events search query (non-open-mic) must include is_published filter
    // to prevent draft events from appearing in search results
    expect(searchRouteSource).toContain('.eq("is_published", true)');
  });

  it("must filter non-open-mic events by status=active", () => {
    // The events search query (non-open-mic) must include status filter
    // to prevent cancelled/pending events from appearing in search results
    //
    // Count occurrences — open_mic query already has status=active,
    // so we need at least 2 occurrences total
    const statusActiveCount = (
      searchRouteSource.match(/\.eq\("status",\s*"active"\)/g) || []
    ).length;
    expect(statusActiveCount).toBeGreaterThanOrEqual(2);
  });

  it("open_mic query must still filter by status=active", () => {
    // Verify the existing open_mic filter hasn't been removed
    expect(searchRouteSource).toContain('.eq("event_type", "open_mic")');
    expect(searchRouteSource).toContain('.eq("status", "active")');
  });

  it("blog posts must still filter by is_published=true", () => {
    // Verify blogs are still filtered (existing correct behavior)
    // Count occurrences — should be at least 2 (events + blog)
    const publishedCount = (
      searchRouteSource.match(/\.eq\("is_published",\s*true\)/g) || []
    ).length;
    expect(publishedCount).toBeGreaterThanOrEqual(2);
  });
});

describe("PR1: No additional leak surfaces in search", () => {
  const searchRouteSource = readFileSync(
    join(SRC_ROOT, "app/api/search/route.ts"),
    "utf-8"
  );

  it("venue search from matching venues must also filter by status=active", () => {
    // The venueOpenMics secondary query should filter by status=active
    // (it already did before — verify it hasn't been removed)
    // This query is: .eq("event_type", "open_mic").eq("status", "active")
    const activeFilterCount = (
      searchRouteSource.match(/\.eq\("status",\s*"active"\)/g) || []
    ).length;
    // At minimum: open_mic direct query + non-open-mic query + venueOpenMics query = 3
    expect(activeFilterCount).toBeGreaterThanOrEqual(3);
  });
});
