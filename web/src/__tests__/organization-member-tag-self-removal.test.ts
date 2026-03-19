import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf-8");
}

describe("Organization member tag self-removal flow", () => {
  it("sends notification email with a self-removal link", () => {
    const template = read("lib/email/templates/organizationMemberTagged.ts");
    expect(template).toContain("removeTagUrl");
    expect(template).toContain("Remove me from this organization");
  });

  it("implements a self-removal membership page with login redirect support", () => {
    const page = read("app/organization-membership/page.tsx");
    expect(page).toContain("OrganizationMembershipContent");
    expect(page).toContain("setPendingRedirect");
    expect(page).toContain("/api/organization-membership");
    expect(page).toContain("Remove me from this organization");
  });

  it("implements membership API auth + delete path", () => {
    const api = read("app/api/organization-membership/route.ts");
    expect(api).toContain("export async function GET");
    expect(api).toContain("export async function DELETE");
    expect(api).toContain("organizationId is required");
    expect(api).toContain("Unauthorized");
    expect(api).toContain("You have been removed from this organization profile.");
  });
});
