import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Friends of the Collective page", () => {
  const appDir = path.join(__dirname, "../app/friends-of-the-collective/page.tsx");
  const profilePageDir = path.join(__dirname, "../app/friends-of-the-collective/[slug]/page.tsx");
  const libDir = path.join(__dirname, "../lib/friends-of-the-collective.ts");
  const footerPath = path.join(__dirname, "../components/navigation/footer.tsx");
  const headerPath = path.join(__dirname, "../components/navigation/header.tsx");

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
    expect(source).toContain("Related on CSC");
    expect(source).toContain("Blog Posts");
    expect(source).toContain("Gallery Albums");
    expect(source).toContain("Hosted Happenings");
    expect(source).toContain("Default is alphabetical list view.");
    expect(source).toContain("Cards");
    expect(source).toContain("List");
    expect(source).toContain('href="/friends-of-the-collective?view=card"');
    expect(source).toContain("friendProfileHref");
    expect(source).toContain("claimFeedbackHref");
    expect(source).toContain("suggestOrganizationFeedbackHref");
    expect(source).toContain('category: "feature"');
    expect(source).toContain('subject: "Suggest organization for Friends of the Collective"');
    expect(source).toContain('link_type === "event"');
  });

  it("is still intentionally unlisted from footer", () => {
    const source = fs.readFileSync(footerPath, "utf-8");
    expect(source).not.toContain('href="/friends-of-the-collective"');
  });

  it("is publicly indexable and no longer gated to admins", () => {
    const source = fs.readFileSync(appDir, "utf-8");
    expect(source).toContain('from("organizations")');
    expect(source).toContain('from("organization_member_tags")');
    expect(source).toContain("profiles!organization_member_tags_profile_id_fkey(");
    expect(source).toContain('from("organization_content_links")');
    expect(source).toContain('robots: "index, follow"');
    expect(source).not.toContain("enforcePrivateAccessUntilLaunch");
    expect(source).not.toContain("NEXT_PUBLIC_FRIENDS_PAGE_PUBLIC");
  });

  it("adds Friends to the primary nav after Members", () => {
    const source = fs.readFileSync(headerPath, "utf-8");
    const membersPos = source.indexOf('{ href: "/members", label: "Members" }');
    const friendsPos = source.indexOf('{ href: "/friends-of-the-collective", label: "Friends" }');
    expect(membersPos).toBeGreaterThanOrEqual(0);
    expect(friendsPos).toBeGreaterThan(membersPos);
  });

  it("includes a dedicated friend profile route for richer linked content", () => {
    const source = fs.readFileSync(profilePageDir, "utf-8");
    expect(source).toContain("FriendOrganizationProfilePage");
    expect(source).toContain("Connected Members");
    expect(source).toContain("Related on CSC");
    expect(source).toContain("profiles!organization_member_tags_profile_id_fkey(");
    expect(source).toContain("Gallery");
    expect(source).toContain("SeriesCard");
    expect(source).toContain("card-spotlight");
    expect(source).toContain("Claim or update this organization profile");
    expect(source).toContain("claimFeedbackHref");
    expect(source).toContain('category: "feature"');
    expect(source).toContain('eventQuery = eventQuery.eq("is_published", true)');
    expect(source).not.toContain('eventQuery = eventQuery.eq("is_published", true).eq("visibility", "public")');
    expect(source).not.toContain("link.label_override ||");
    expect(source).toContain('link_type === "event"');
  });
});
