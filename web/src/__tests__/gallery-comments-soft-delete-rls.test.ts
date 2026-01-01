/**
 * Gallery Comments Soft-Delete RLS Regression Tests
 *
 * This test suite ensures the RLS fix for soft-delete cannot regress.
 *
 * Background (the bug):
 * - The original SELECT policy only allowed `is_deleted = false`
 * - When an UPDATE sets `is_deleted = true`, the row becomes invisible under
 *   that SELECT policy
 * - PostgreSQL RLS requires the row to be visible via SELECT to complete an UPDATE
 * - Result: "new row violates row-level security policy" even for authorized users
 *
 * The fix:
 * - Added a second SELECT policy (gallery_*_comments_select_own) that allows
 *   comment managers (author, admin, owner) to see ANY comment they manage,
 *   regardless of is_deleted status
 * - This permits UPDATE operations to complete successfully
 *
 * Policy structure after fix:
 * - gallery_*_comments_select_public: Anyone can see non-deleted comments
 * - gallery_*_comments_select_own: Managers can see comments they manage (any is_deleted state)
 * - gallery_*_comments_update_soft_delete: Managers can set is_deleted=true
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Paths to the migration files
const ORIGINAL_MIGRATION_PATH = path.join(
  __dirname,
  "../../../supabase/migrations/20251221044056_gallery_comments.sql"
);
const FIX_MIGRATION_PATH = path.join(
  __dirname,
  "../../../supabase/migrations/20260101071347_fix_gallery_comments_rls_admin_check.sql"
);

describe("Gallery Comments Soft-Delete RLS Fix", () => {
  describe("Fix Migration Exists", () => {
    it("should have the fix migration file", () => {
      expect(fs.existsSync(FIX_MIGRATION_PATH)).toBe(true);
    });

    it("fix migration should document the root cause", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      // Must document the issue for future maintainers
      expect(content).toMatch(/SELECT policy only allowed is_deleted = false/i);
      expect(content).toMatch(/blocked\s*\n?.*UPDATE operations/i);
    });
  });

  describe("Album Comments RLS Policies", () => {
    it("should have public SELECT policy for non-deleted comments", () => {
      const content = fs.readFileSync(ORIGINAL_MIGRATION_PATH, "utf-8");
      expect(content).toMatch(/gallery_album_comments_select_public/);
      expect(content).toMatch(/USING \(is_deleted = false\)/);
    });

    it("should have manager SELECT policy (the fix)", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      expect(content).toMatch(/gallery_album_comments_select_own/);
      // This policy does NOT filter by is_deleted, allowing managers to see deleted comments
      expect(content).toMatch(
        /CREATE POLICY "gallery_album_comments_select_own"[\s\S]*?USING \(/
      );
    });

    it("manager SELECT policy should allow author to see own comments", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      // Extract the album comments select_own policy
      const policyMatch = content.match(
        /CREATE POLICY "gallery_album_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      expect(policy).toMatch(/user_id = auth\.uid\(\)/);
    });

    it("manager SELECT policy should allow admin to see any comment", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_album_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      expect(policy).toMatch(/public\.is_admin\(\)/);
    });

    it("manager SELECT policy should allow album owner to see comments on their album", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_album_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      // Uses alias 'a' for gallery_albums and checks created_by
      expect(policy).toMatch(/gallery_albums\s+a[\s\S]*?a\.created_by = auth\.uid\(\)/);
    });

    it("UPDATE policy should use fully-qualified public.is_admin()", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const updatePolicyMatch = content.match(
        /CREATE POLICY "gallery_album_comments_update_soft_delete"[\s\S]*?WITH CHECK/
      );
      expect(updatePolicyMatch).not.toBeNull();
      const updatePolicy = updatePolicyMatch![0];
      // Must use public.is_admin() not just is_admin() to avoid search_path issues
      expect(updatePolicy).toMatch(/public\.is_admin\(\)/);
    });

    it("UPDATE policy should only allow setting is_deleted=true", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const updatePolicyMatch = content.match(
        /CREATE POLICY "gallery_album_comments_update_soft_delete"[\s\S]*?(?=CREATE POLICY|DROP POLICY|;[\s]*$)/
      );
      expect(updatePolicyMatch).not.toBeNull();
      const updatePolicy = updatePolicyMatch![0];
      expect(updatePolicy).toMatch(/WITH CHECK[\s\S]*is_deleted = true/);
    });
  });

  describe("Photo Comments RLS Policies", () => {
    it("should have public SELECT policy for non-deleted comments", () => {
      const content = fs.readFileSync(ORIGINAL_MIGRATION_PATH, "utf-8");
      expect(content).toMatch(/gallery_photo_comments_select_public/);
      expect(content).toMatch(/USING \(is_deleted = false\)/);
    });

    it("should have manager SELECT policy (the fix)", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      expect(content).toMatch(/gallery_photo_comments_select_own/);
    });

    it("manager SELECT policy should allow author to see own comments", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      expect(policy).toMatch(/user_id = auth\.uid\(\)/);
    });

    it("manager SELECT policy should allow admin to see any comment", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      expect(policy).toMatch(/public\.is_admin\(\)/);
    });

    it("manager SELECT policy should allow image uploader to see comments on their image", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      // Uses alias 'i' for gallery_images and checks uploaded_by
      expect(policy).toMatch(/gallery_images\s+i[\s\S]*?i\.uploaded_by = auth\.uid\(\)/);
    });

    it("manager SELECT policy should allow album owner to see comments on images in their album", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const policyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_select_own"[\s\S]*?(?=CREATE POLICY|DROP POLICY|$)/
      );
      expect(policyMatch).not.toBeNull();
      const policy = policyMatch![0];
      // Should join gallery_images to gallery_albums and check created_by (uses alias 'a')
      expect(policy).toMatch(/gallery_albums\s+a[\s\S]*?a\.created_by = auth\.uid\(\)/);
    });

    it("UPDATE policy should use fully-qualified public.is_admin()", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const updatePolicyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_update_soft_delete"[\s\S]*?WITH CHECK/
      );
      expect(updatePolicyMatch).not.toBeNull();
      const updatePolicy = updatePolicyMatch![0];
      expect(updatePolicy).toMatch(/public\.is_admin\(\)/);
    });

    it("UPDATE policy should only allow setting is_deleted=true", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");
      const updatePolicyMatch = content.match(
        /CREATE POLICY "gallery_photo_comments_update_soft_delete"[\s\S]*?(?=;[\s]*$)/
      );
      expect(updatePolicyMatch).not.toBeNull();
      const updatePolicy = updatePolicyMatch![0];
      expect(updatePolicy).toMatch(/WITH CHECK[\s\S]*is_deleted = true/);
    });
  });

  describe("Policy Architecture Invariants", () => {
    it("should have two SELECT policies per table (public + manager)", () => {
      const fixContent = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");

      // Album comments should have select_own (manager) policy created in fix
      expect(fixContent).toMatch(/gallery_album_comments_select_own/);

      // Photo comments should have select_own (manager) policy created in fix
      expect(fixContent).toMatch(/gallery_photo_comments_select_own/);

      // Original migration has select_public policies
      const origContent = fs.readFileSync(ORIGINAL_MIGRATION_PATH, "utf-8");
      expect(origContent).toMatch(/gallery_album_comments_select_public/);
      expect(origContent).toMatch(/gallery_photo_comments_select_public/);
    });

    it("select_public should filter by is_deleted=false (hide deleted from public)", () => {
      const content = fs.readFileSync(ORIGINAL_MIGRATION_PATH, "utf-8");
      // Both public SELECT policies should have is_deleted = false
      const albumPublicMatch = content.match(
        /gallery_album_comments_select_public[\s\S]*?USING \(is_deleted = false\)/
      );
      const photoPublicMatch = content.match(
        /gallery_photo_comments_select_public[\s\S]*?USING \(is_deleted = false\)/
      );
      expect(albumPublicMatch).not.toBeNull();
      expect(photoPublicMatch).not.toBeNull();
    });

    it("select_own should NOT filter by is_deleted (managers see all their comments)", () => {
      const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");

      // Extract both select_own policies and verify they don't filter by is_deleted
      const albumSelectOwn = content.match(
        /CREATE POLICY "gallery_album_comments_select_own"[\s\S]*?(?=-- Recreate UPDATE|CREATE POLICY "gallery_album_comments_update)/
      );
      const photoSelectOwn = content.match(
        /CREATE POLICY "gallery_photo_comments_select_own"[\s\S]*?(?=-- Recreate UPDATE|CREATE POLICY "gallery_photo_comments_update)/
      );

      expect(albumSelectOwn).not.toBeNull();
      expect(photoSelectOwn).not.toBeNull();

      // These policies should NOT have is_deleted in their USING clause
      // (they allow managers to see deleted comments)
      expect(albumSelectOwn![0]).not.toMatch(/USING[\s\S]*is_deleted\s*=\s*false/);
      expect(photoSelectOwn![0]).not.toMatch(/USING[\s\S]*is_deleted\s*=\s*false/);
    });
  });

  describe("Client Component Compatibility", () => {
    const componentPath = path.join(
      __dirname,
      "../components/gallery/GalleryComments.tsx"
    );

    it("client should filter is_deleted=false when fetching (public view)", () => {
      const content = fs.readFileSync(componentPath, "utf-8");
      // The client query should explicitly filter is_deleted=false
      expect(content).toMatch(/\.eq\(["']is_deleted["'],\s*false\)/);
    });

    it("client should set is_deleted=true when deleting (soft delete)", () => {
      const content = fs.readFileSync(componentPath, "utf-8");
      // The delete operation should update is_deleted to true
      expect(content).toMatch(/\.update\(\s*\{\s*is_deleted:\s*true\s*\}/);
    });

    it("client should check canDelete before showing delete button", () => {
      const content = fs.readFileSync(componentPath, "utf-8");
      expect(content).toMatch(/function canDelete/);
      expect(content).toMatch(/canDelete\(comment\)/);
    });

    it("canDelete should check author, admin, uploader, and owner", () => {
      const content = fs.readFileSync(componentPath, "utf-8");
      // Should check user_id (author), isAdmin, imageUploaderId, albumOwnerId
      expect(content).toMatch(/comment\.user_id === currentUserId/);
      expect(content).toMatch(/isAdmin/);
      expect(content).toMatch(/imageUploaderId/);
      expect(content).toMatch(/albumOwnerId/);
    });
  });
});

describe("RLS Soft-Delete Pattern Documentation", () => {
  it("fix migration should be self-documenting", () => {
    const content = fs.readFileSync(FIX_MIGRATION_PATH, "utf-8");

    // Should explain the issue
    expect(content).toMatch(/Issue:/);
    expect(content).toMatch(/Root cause:/);
    expect(content).toMatch(/Fix:/);

    // Should mention the key insight about SELECT blocking UPDATE
    expect(content).toMatch(/SELECT policy/);
    expect(content).toMatch(/UPDATE/);
  });
});
