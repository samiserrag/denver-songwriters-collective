import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf-8");
}

describe("Friends host spotlight + organization member tags", () => {
  it("adds migration for host spotlight reason and organization_member_tags", () => {
    const migration = fs.readFileSync(
      path.join(
        __dirname,
        "../../../supabase/migrations/20260318154500_friends_host_spotlight_and_member_tags.sql"
      ),
      "utf-8"
    );

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS host_spotlight_reason");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.organization_member_tags");
    expect(migration).toContain("organization_member_tags_select_public");
    expect(migration).toContain("organization_member_tags_manage_admin");
  });

  it("adds admin API endpoint for host spotlight reason", () => {
    const source = read("app/api/admin/users/[id]/host-spotlight-reason/route.ts");
    expect(source).toContain("requireAdmin");
    expect(source).toContain("host_spotlight_reason");
    expect(source).toContain("export async function PATCH");
  });

  it("adds host reason editor and member pill rendering", () => {
    const userTable = read("components/admin/UserDirectoryTable.tsx");
    const friendsPage = read("app/friends-of-the-collective/page.tsx");

    expect(userTable).toContain("Host Spotlight Reason");
    expect(userTable).toContain("/host-spotlight-reason");
    expect(friendsPage).toContain("Featured Host Members");
    expect(friendsPage).toContain("Connected Members");
  });
});
