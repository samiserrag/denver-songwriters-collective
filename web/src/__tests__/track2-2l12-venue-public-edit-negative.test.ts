import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const ROUTE_PATH = join(WEB_SRC, "app/api/venues/[id]/route.ts");
const MANAGER_AUTH_PATH = join(WEB_SRC, "lib/venue/managerAuth.ts");
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const routeSource = readFileSync(ROUTE_PATH, "utf-8");
const managerAuthSource = readFileSync(MANAGER_AUTH_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function section(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  expect(start, `Missing start marker ${startNeedle}`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `Missing end marker ${endNeedle}`).toBeGreaterThan(start);

  return source.slice(start, end);
}

function exportSection(source: string, exportName: string): string {
  const startNeedle = `export async function ${exportName}(`;
  const start = source.indexOf(startNeedle);
  expect(start, `Missing export ${exportName}`).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf("export async function", start + startNeedle.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

function expectBefore(source: string, before: string, after: string): void {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  expect(beforeIndex, `Missing before marker ${before}`).toBeGreaterThanOrEqual(0);
  expect(afterIndex, `Missing after marker ${after}`).toBeGreaterThanOrEqual(0);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(
    afterIndex
  );
}

const patchSource = exportSection(routeSource, "PATCH");
const canEditVenueSource = exportSection(managerAuthSource, "canEditVenue");
const getActiveVenueGrantSource = exportSection(managerAuthSource, "getActiveVenueGrant");
const isEventHostAtVenueSource = exportSection(managerAuthSource, "isEventHostAtVenue");
const mediaEmbedWarningResponseSection = section(
  patchSource,
  "return NextResponse.json({\n          success: true,\n          venue: updatedVenue,",
  "        });\n      }"
);
const finalSuccessResponseSection = section(
  patchSource,
  "return NextResponse.json({\n      success: true,\n      venue: updatedVenue,",
  "    });\n  } catch"
);
const successResponseSections = `${mediaEmbedWarningResponseSection}\n${finalSuccessResponseSection}`;

describe("Track 2 2L.12 venue public edit BOLA negative cluster", () => {
  it("denies anonymous PATCH before body parsing, authorization helpers, or service-role access", () => {
    expect(patchSource).toContain("supabase.auth.getUser()");
    expect(patchSource).toContain('return NextResponse.json({ error: "Unauthorized" }, { status: 401 });');
    expectBefore(patchSource, 'error: "Unauthorized"', "canEditVenue(");
    expectBefore(patchSource, 'error: "Unauthorized"', "checkAdminRole(");
    expectBefore(patchSource, 'error: "Unauthorized"', "request.json()");
    expectBefore(patchSource, 'error: "Unauthorized"', "createServiceRoleClient()");
  });

  it("denies unrelated authenticated users before mutation or side effects", () => {
    expect(patchSource).toContain("canEditVenue(supabase, venueId, user.id)");
    expect(patchSource).toContain("checkAdminRole(supabase, user.id)");
    expect(patchSource).toContain("if (!canEdit && !isAdmin)");
    expect(patchSource).toContain("You do not have permission to edit this venue");
    expect(patchSource).toContain("{ status: 403 }");

    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "request.json()");
    expectBefore(patchSource, "You do not have permission to edit this venue", "sanitizeVenuePatch(");
    expectBefore(patchSource, "You do not have permission to edit this venue", "createServiceRoleClient()");
    expectBefore(patchSource, "You do not have permission to edit this venue", "upsertMediaEmbeds(");
    expectBefore(patchSource, "You do not have permission to edit this venue", "venueAudit.venueEdited(");
    expectBefore(patchSource, "You do not have permission to edit this venue", "notifyVenueGeocodingFailure(");
  });

  it("treats revoked manager grants as inactive and keeps active manager/admin allow paths explicit", () => {
    expect(getActiveVenueGrantSource).toContain('.from("venue_managers")');
    expect(getActiveVenueGrantSource).toContain('.eq("venue_id", venueId)');
    expect(getActiveVenueGrantSource).toContain('.eq("user_id", userId)');
    expect(getActiveVenueGrantSource).toContain('.is("revoked_at", null)');

    expect(canEditVenueSource).toContain("const isManager = await isVenueManager(supabase, venueId, userId)");
    expect(canEditVenueSource).toContain("if (isManager) return true;");
    expect(patchSource).toContain("checkAdminRole(supabase, user.id)");
    expect(patchSource).toContain("if (!canEdit && !isAdmin)");
  });

  it("only lets event hosts or cohosts edit the venue tied to their event", () => {
    expect(isEventHostAtVenueSource).toContain('.from("events")');
    expect(isEventHostAtVenueSource).toContain('.eq("venue_id", venueId)');
    expect(isEventHostAtVenueSource).toContain('.eq("host_id", userId)');
    expect(isEventHostAtVenueSource).toContain('.from("event_hosts")');
    expect(isEventHostAtVenueSource).toContain('.eq("user_id", userId)');
    expect(isEventHostAtVenueSource).toContain('.eq("invitation_status", "accepted")');
    expect(isEventHostAtVenueSource).toContain("eventVenueId === venueId");

    expect(routeSource).not.toContain("body.venue_id");
    expect(routeSource).not.toContain("body.id");
  });

  it("keeps writable venue fields constrained through the manager allowlist", () => {
    expect(managerAuthSource).toContain("MANAGER_EDITABLE_VENUE_FIELDS");
    expect(patchSource).toContain("getDisallowedFields(bodyForFieldCheck)");
    expect(patchSource).toContain("sanitizeVenuePatch(body)");
    expect(patchSource).toContain("allowedFields: MANAGER_EDITABLE_VENUE_FIELDS");

    for (const internalField of [
      '"id"',
      '"slug"',
      '"created_at"',
      '"updated_at"',
      '"geocoded_at"',
      '"geocode_source"',
      '"notes"',
    ]) {
      const allowlistSection = section(
        managerAuthSource,
        "export const MANAGER_EDITABLE_VENUE_FIELDS = [",
        "] as const;"
      );
      expect(allowlistSection).not.toContain(internalField);
    }
  });

  it("keeps service-role updates, geocoding, media embeds, and audit behind route-local authorization", () => {
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "const body = await request.json()");
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "const serviceClient = createServiceRoleClient()");
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "processVenueGeocodingWithStatus(");
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "notifyVenueGeocodingFailure(");
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "venueAudit.venueEdited(");
    expectBefore(patchSource, "if (!canEdit && !isAdmin)", "upsertMediaEmbeds(");

    expect(patchSource).toMatch(
      /\.from\("venues"\)\s*\.update\(updatesWithGeo\)\s*\.eq\("id", venueId\)/
    );
    expect(patchSource).toContain('{ type: "venue", id: venueId }');
  });

  it("keeps PATCH responses within the existing venue edit contract", () => {
    for (const privateMarker of [
      "venue_managers",
      "event_hosts",
      "profiles",
      "app_logs",
      "revoked_at",
      "created_by",
      "user.email",
      "existingVenue",
      "previousValues",
      "newValues",
    ]) {
      expect(successResponseSections).not.toContain(privateMarker);
    }

    expect(successResponseSections).toContain("success: true");
    expect(successResponseSections).toContain("venue: updatedVenue");
    expect(successResponseSections).toContain("updatedFields");
    expect(successResponseSections).toContain("geocodingWarning");
    expect(successResponseSections).toContain("disallowedFields");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l12-venue-public-edit-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-VENUE-PUBLIC-EDIT");
    expect(manifestSource).toContain("T2-SR-VENUE-PUBLIC-PATCH");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("revoked manager denial");
    expect(manifestSource).toContain("service-role update ordering");
  });
});
