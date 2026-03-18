import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Friends of the Collective page", () => {
  const appDir = path.join(__dirname, "../app/friends-of-the-collective/page.tsx");
  const libDir = path.join(__dirname, "../lib/friends-of-the-collective.ts");
  const footerPath = path.join(__dirname, "../components/navigation/footer.tsx");

  it("defines a shared data contract for organizations", () => {
    const source = fs.readFileSync(libDir, "utf-8");
    expect(source).toContain("export interface CollectiveFriend");
    expect(source).toContain("export const FRIENDS_OF_COLLECTIVE");
    expect(source).toContain("getFriendsOfCollective");
    expect(source).toContain("rock-for-the-people");
    expect(source).toContain("front-range-songwriters");
  });

  it("renders the page with core mission copy", () => {
    const source = fs.readFileSync(appDir, "utf-8");
    expect(source).toContain("Friends of the Collective");
    expect(source).toContain("This page celebrates collaborators. It is not a ranking.");
    expect(source).toContain("Suggest an Organization");
    expect(source).toContain("Featured Host Members");
    expect(source).toContain("Why Featured");
    expect(source).toContain("Connected Members");
  });

  it("is intentionally unlisted from footer while private", () => {
    const source = fs.readFileSync(footerPath, "utf-8");
    expect(source).not.toContain('href="/friends-of-the-collective"');
  });

  it("enforces private mode guard and noindex metadata", () => {
    const source = fs.readFileSync(appDir, "utf-8");
    expect(source).toContain("FRIENDS_PAGE_PUBLIC");
    expect(source).toContain("enforcePrivateAccessUntilLaunch");
    expect(source).toContain('from("organizations")');
    expect(source).toContain('from("organization_member_tags")');
    expect(source).toContain("notFound()");
    expect(source).toContain('robots: "noindex, nofollow"');
  });
});
