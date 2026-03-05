/**
 * Admin Users spotlight eligibility regression assertions.
 *
 * Ensures:
 * 1) Host spotlight eligibility includes accepted event-level host/cohost roles.
 * 2) Admin users page passes accepted event host IDs into the table.
 * 3) Ineligible spotlight cells show disabled controls with explicit reasons.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const readSrc = (relPath: string) =>
  fs.readFileSync(path.resolve(__dirname, relPath), "utf-8");

const usersPage = readSrc("../app/(protected)/dashboard/admin/users/page.tsx");
const tableSrc = readSrc("../components/admin/UserDirectoryTable.tsx");

describe("admin users page event-host sourcing", () => {
  it("queries accepted event_hosts rows", () => {
    expect(usersPage).toContain('.from("event_hosts")');
    expect(usersPage).toContain('.eq("invitation_status", "accepted")');
    expect(usersPage).toContain('.in("role", ["host", "cohost"])');
  });

  it("passes acceptedEventHostUserIds to UserDirectoryTable", () => {
    expect(usersPage).toContain("acceptedEventHostUserIds={acceptedEventHostUserIds}");
  });
});

describe("UserDirectoryTable spotlight eligibility", () => {
  it("accepts acceptedEventHostUserIds prop", () => {
    expect(tableSrc).toContain("acceptedEventHostUserIds?: string[];");
    expect(tableSrc).toContain("acceptedEventHostUserIds = []");
  });

  it("builds an accepted event-host set", () => {
    expect(tableSrc).toContain("new Set(acceptedEventHostUserIds)");
    expect(tableSrc).toContain("const isEventLevelHost = (u: Profile): boolean => acceptedEventHostSet.has(u.id);");
  });

  it("treats event-level hosts as host spotlight eligible", () => {
    expect(tableSrc).toContain("const isHostSpotlightEligible = (u: Profile): boolean =>");
    expect(tableSrc).toContain("isUserHost(u) || isEventLevelHost(u);");
  });

  it("uses host spotlight eligibility in host filter and render paths", () => {
    expect(tableSrc).toContain('matchesFilter = isUserHost(u) || acceptedEventHostSet.has(u.id);');
    expect(tableSrc).toContain("{isHostSpotlightEligible(u) ? (");
  });

  it("treats host users as artist-spotlight eligible", () => {
    expect(tableSrc).toContain("function isUserArtist(u: Profile): boolean {");
    expect(tableSrc).toContain("return isUserSongwriter(u) || isUserHost(u);");
    expect(tableSrc).toContain("{isUserArtist(u) ? (");
  });

  it("shows explicit disabled reasons for ineligible spotlight types", () => {
    expect(tableSrc).toContain('renderDisabledSpotlightControl("Artist only")');
    expect(tableSrc).toContain('renderDisabledSpotlightControl("Host only")');
    expect(tableSrc).toContain('renderDisabledSpotlightControl("Studio only")');
  });

  it("shows Event Host label for event-level hosts without host flag", () => {
    expect(tableSrc).toContain("Event Host");
  });
});
