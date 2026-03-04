/**
 * UX-13 — Host Venue Creation Gap source assertions.
 *
 * Verifies:
 * 1. New /api/venues POST route exists with host+admin auth (checkHostStatus).
 * 2. VenueSelector POSTs to /api/venues (not /api/admin/venues).
 * 3. All 3 page routes pass canCreateVenue for approved hosts (not just admins).
 * 4. Existing admin venue route (/api/admin/venues) unchanged.
 * 5. RLS policies unchanged (admin-only INSERT preserved at DB level).
 * 6. VenueSelector prop comment updated to reflect host access.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------
const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, relPath), "utf-8");

const venueApiRoute = readSrc("../app/api/venues/route.ts");
const adminVenueApiRoute = readSrc("../app/api/admin/venues/route.ts");
const venueSelector = readSrc("../components/ui/VenueSelector.tsx");
const createPage = readSrc(
  "../app/(protected)/dashboard/my-events/new/page.tsx"
);
const editPage = readSrc(
  "../app/(protected)/dashboard/my-events/[id]/page.tsx"
);
const overridePage = readSrc(
  "../app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/page.tsx"
);

// ---------------------------------------------------------------------------
// A) New /api/venues POST route — host-accessible venue creation
// ---------------------------------------------------------------------------
describe("UX-13 — /api/venues POST route", () => {
  it("exists and exports a POST handler", () => {
    expect(venueApiRoute).toContain("export async function POST");
  });

  it("uses checkHostStatus for auth (not checkAdminRole)", () => {
    expect(venueApiRoute).toContain("checkHostStatus");
    // Should NOT use checkAdminRole as the gate
    expect(venueApiRoute).not.toContain("checkAdminRole");
  });

  it("returns 401 for unauthenticated users", () => {
    expect(venueApiRoute).toContain('"Unauthorized"');
    expect(venueApiRoute).toContain("status: 401");
  });

  it("returns 403 for non-host users", () => {
    expect(venueApiRoute).toContain('"Forbidden"');
    expect(venueApiRoute).toContain("status: 403");
  });

  it("requires both name and address", () => {
    expect(venueApiRoute).toContain('"Venue name is required"');
    expect(venueApiRoute).toContain('"Address is required"');
  });

  it("uses service role client for INSERT (bypasses RLS safely)", () => {
    expect(venueApiRoute).toContain("createServiceRoleClient");
    expect(venueApiRoute).toContain("serviceClient");
  });

  it("runs geocoding pipeline", () => {
    expect(venueApiRoute).toContain("processVenueGeocodingWithStatus");
  });

  it("logs venue creation with actor info for audit trail", () => {
    expect(venueApiRoute).toContain("[POST /api/venues] Venue created:");
    expect(venueApiRoute).toContain("actor:");
  });

  it("returns 201 on success with geocoding status", () => {
    expect(venueApiRoute).toContain("status: 201");
    expect(venueApiRoute).toContain("geocodingApplied");
  });
});

// ---------------------------------------------------------------------------
// B) VenueSelector — uses new endpoint
// ---------------------------------------------------------------------------
describe("UX-13 — VenueSelector endpoint update", () => {
  it("POSTs to /api/venues (not /api/admin/venues)", () => {
    expect(venueSelector).toContain('"/api/venues"');
    expect(venueSelector).not.toContain('"/api/admin/venues"');
  });

  it("prop comment reflects host access (not admin-only)", () => {
    expect(venueSelector).toContain("approved hosts and admins");
  });
});

// ---------------------------------------------------------------------------
// C) Page routes — canCreateVenue includes approved hosts
// ---------------------------------------------------------------------------
describe("UX-13 — Page routes pass canCreateVenue for hosts", () => {
  it("create page: canCreateVenue={isAdmin || isApprovedHost}", () => {
    expect(createPage).toContain("canCreateVenue={isAdmin || isApprovedHost}");
  });

  it("edit page: canCreateVenue={isAdmin || isApprovedHost}", () => {
    expect(editPage).toContain("canCreateVenue={isAdmin || isApprovedHost}");
  });

  it("occurrence override page: canCreateVenue={isAdmin || isApprovedHost}", () => {
    expect(overridePage).toContain(
      "canCreateVenue={isAdmin || isApprovedHost}"
    );
  });

  it("occurrence override page imports checkHostStatus", () => {
    expect(overridePage).toContain("checkHostStatus");
  });

  it("occurrence override page calls checkHostStatus", () => {
    expect(overridePage).toContain(
      "await checkHostStatus(supabase, sessionUser.id)"
    );
  });
});

// ---------------------------------------------------------------------------
// D) Admin venue route — unchanged (no regression)
// ---------------------------------------------------------------------------
describe("UX-13 — Admin venue route preserved", () => {
  it("admin route still uses checkAdminRole", () => {
    expect(adminVenueApiRoute).toContain("checkAdminRole");
  });

  it("admin route still returns 403 for non-admins", () => {
    expect(adminVenueApiRoute).toContain('"Forbidden"');
  });

  it("admin route POST handler unchanged", () => {
    expect(adminVenueApiRoute).toContain("export async function POST");
    expect(adminVenueApiRoute).toContain("export async function GET");
  });
});

// ---------------------------------------------------------------------------
// E) Existing test compatibility — venue selector Phase 4.45b tests
// ---------------------------------------------------------------------------
describe("UX-13 — Backward compatibility", () => {
  it("VenueSelector still has canCreateVenue prop with false default", () => {
    expect(venueSelector).toContain("canCreateVenue = false");
  });

  it("VenueSelector still shows custom location option", () => {
    expect(venueSelector).toContain("Custom location");
  });

  it("VenueSelector still shows helper text for non-privileged users", () => {
    expect(venueSelector).toContain("Can&apos;t find your venue?");
    expect(venueSelector).toContain("Report a venue issue");
  });
});
