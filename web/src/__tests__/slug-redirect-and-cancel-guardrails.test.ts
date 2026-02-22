import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf-8");
}

describe("Event slug redirect history contracts", () => {
  it("migration defines event_slug_redirects and trigger history write", () => {
    const sql = read("supabase/migrations/20260222160000_event_slug_redirect_history.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.event_slug_redirects");
    expect(sql).toContain("INSERT INTO public.event_slug_redirects");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.handle_event_slug()");
  });

  it("event detail page resolves old slug redirects", () => {
    const page = read("web/src/app/events/[id]/page.tsx");
    expect(page).toContain('from("event_slug_redirects")');
    expect(page).toContain("buildCanonicalEventPath");
  });
});

describe("Cancel/unpublish guard contracts", () => {
  it("publish button disables unpublish when signup activity exists", () => {
    const publishButton = read("web/src/app/(protected)/dashboard/my-events/[id]/_components/PublishButton.tsx");
    expect(publishButton).toContain("hasSignupActivity");
    expect(publishButton).toContain("Unpublish disabled");
  });

  it("event PATCH API blocks unpublish when RSVPs/claims exist", () => {
    const route = read("web/src/app/api/my-events/[id]/route.ts");
    expect(route).toContain("Can't unpublish events with active RSVPs or performer claims.");
    expect(route).toContain("Use Cancel instead");
  });

  it("event cancellation path uses email notification sender", () => {
    const route = read("web/src/app/api/my-events/[id]/route.ts");
    expect(route).toContain("sendEventCancelledNotifications");
  });
});

describe("Occurrence host-update notifications contracts", () => {
  it("override save route sends date-scoped update/cancel notifications", () => {
    const overridesRoute = read("web/src/app/api/my-events/[id]/overrides/route.ts");
    expect(overridesRoute).toContain("sendOccurrenceCancelledNotifications");
    expect(overridesRoute).toContain("sendEventUpdatedNotifications");
    expect(overridesRoute).toContain("dateKey: date_key");
  });
});
