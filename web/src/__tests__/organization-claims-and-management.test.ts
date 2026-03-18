import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf-8");
}

describe("Organization claim and management workflow", () => {
  it("defines manager + claim schema in migration", () => {
    const migration = fs.readFileSync(
      path.join(__dirname, "../../../supabase/migrations/20260317224500_organizations_claims_and_managers.sql"),
      "utf-8"
    );
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organization_managers");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organization_claims");
    expect(migration).toContain("CREATE POLICY organizations_update_manager");
    expect(migration).toContain("organization_claims_insert_own");
  });

  it("adds member-facing organization dashboard route and sidebar link", () => {
    const page = read("app/(protected)/dashboard/my-organizations/page.tsx");
    const sidebar = read("components/navigation/DashboardSidebar.tsx");
    expect(page).toContain("Claim an Organization Profile");
    expect(page).toContain("RelinquishOrganizationButtonClient");
    expect(sidebar).toContain('href: "/dashboard/my-organizations"');
  });

  it("adds admin organization claim review route and dashboard links", () => {
    const adminPage = read("app/(protected)/dashboard/admin/page.tsx");
    const claimsPage = read("app/(protected)/dashboard/admin/organization-claims/page.tsx");
    expect(adminPage).toContain('href="/dashboard/admin/organization-claims"');
    expect(adminPage).toContain("pendingOrganizationClaims");
    expect(claimsPage).toContain("Organization Claims");
    expect(claimsPage).toContain("OrganizationClaimsTable");
  });

  it("implements claim and self-management APIs", () => {
    const claimApi = read("app/api/organizations/[id]/claim/route.ts");
    const myOrgsApi = read("app/api/my-organizations/route.ts");
    const myOrgItemApi = read("app/api/my-organizations/[id]/route.ts");
    const adminClaimsApi = read("app/api/admin/organization-claims/route.ts");
    const approveApi = read("app/api/admin/organization-claims/[id]/approve/route.ts");
    const rejectApi = read("app/api/admin/organization-claims/[id]/reject/route.ts");

    expect(claimApi).toContain('from("organization_claims")');
    expect(claimApi).toContain("export async function DELETE");
    expect(myOrgsApi).toContain('from("organization_managers")');
    expect(myOrgsApi).toContain('from("organization_claims")');
    expect(myOrgItemApi).toContain("MANAGER_EDITABLE_FIELDS");
    expect(myOrgItemApi).toContain('from("organizations")');
    expect(adminClaimsApi).toContain("checkAdminRole");
    expect(approveApi).toContain('from("organization_managers")');
    expect(rejectApi).toContain("rejection_reason");
  });

  it("adds claim CTA to friends cards", () => {
    const source = read("app/friends-of-the-collective/page.tsx");
    expect(source).toContain("Represent this organization? Claim or update this profile.");
    expect(source).toContain('href="/dashboard/my-organizations"');
  });
});
