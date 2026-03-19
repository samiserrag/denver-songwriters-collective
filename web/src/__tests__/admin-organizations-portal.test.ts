import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Admin organizations portal", () => {
  const dashboardPath = path.join(__dirname, "../app/(protected)/dashboard/admin/page.tsx");
  const pagePath = path.join(__dirname, "../app/(protected)/dashboard/admin/organizations/page.tsx");
  const clientPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/admin/organizations/AdminOrganizationsClient.tsx"
  );
  const apiPath = path.join(__dirname, "../app/api/admin/organizations/route.ts");
  const apiItemPath = path.join(__dirname, "../app/api/admin/organizations/[id]/route.ts");

  it("admin dashboard links to organizations portal", () => {
    const source = fs.readFileSync(dashboardPath, "utf-8");
    expect(source).toContain('href="/dashboard/admin/organizations"');
    expect(source).toContain("Friends Organizations");
  });

  it("organizations page is admin-guarded", () => {
    const source = fs.readFileSync(pagePath, "utf-8");
    expect(source).toContain("profile.role !== \"admin\"");
    expect(source).toContain("AdminOrganizationsClient");
  });

  it("client implements create and edit controls", () => {
    const source = fs.readFileSync(clientPath, "utf-8");
    expect(source).toContain("/api/admin/organizations");
    expect(source).toContain("Create Organization");
    expect(source).toContain("Edit Organization");
    expect(source).toContain("Delete organization");
    expect(source).toContain("Tagged Members");
    expect(source).toContain("Related Content Links");
    expect(source).toContain("Add blog post...");
    expect(source).toContain("Add gallery album...");
    expect(source).toContain("Add event...");
    expect(source).toContain('link_type: "event"');
  });

  it("admin APIs target organizations table", () => {
    const source = fs.readFileSync(apiPath, "utf-8");
    const sourceItem = fs.readFileSync(apiItemPath, "utf-8");
    expect(source).toContain("const TABLE_NAME = \"organizations\"");
    expect(source).toContain("const TAG_TABLE_NAME = \"organization_member_tags\"");
    expect(source).toContain("const CONTENT_LINK_TABLE_NAME = \"organization_content_links\"");
    expect(sourceItem).toContain("const TABLE_NAME = \"organizations\"");
    expect(sourceItem).toContain("const TAG_TABLE_NAME = \"organization_member_tags\"");
    expect(sourceItem).toContain("const CONTENT_LINK_TABLE_NAME = \"organization_content_links\"");
    expect(source).toContain("checkAdminRole");
    expect(sourceItem).toContain("checkAdminRole");
  });
});
