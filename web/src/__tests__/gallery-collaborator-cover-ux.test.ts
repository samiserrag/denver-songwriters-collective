/**
 * Tests: Gallery collaborator notifications, cover fallback, and Save clarity
 *
 * Verifies:
 * 1. Profile pages (studios, performers, songwriters) compute displayCoverUrl
 *    using fallback to first visible image when cover_image_url is null
 * 2. AlbumManager triggers create_user_notification RPC for newly added collaborators
 * 3. Collaborator helper text is present in AlbumManager
 * 4. Save and Publish actions appear in both top and bottom action rows
 * 5. Email template exists with correct structure
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Gallery Album Cover Fallback on Profile Pages", () => {
  const profilePages = [
    {
      name: "studios",
      path: path.join(__dirname, "../app/studios/[id]/page.tsx"),
    },
    {
      name: "performers",
      path: path.join(__dirname, "../app/performers/[id]/page.tsx"),
    },
    {
      name: "songwriters",
      path: path.join(__dirname, "../app/songwriters/[id]/page.tsx"),
    },
  ];

  for (const page of profilePages) {
    describe(`/${page.name}/[id]`, () => {
      const content = fs.readFileSync(page.path, "utf-8");

      it("should resolve displayCoverUrl with fallback to first visible image", () => {
        // Must have the galleriesWithCovers mapping
        expect(content).toContain("galleriesWithCovers");
        expect(content).toContain("displayCoverUrl");
      });

      it("should query gallery_images for fallback cover when cover_image_url is null", () => {
        expect(content).toContain("gallery_images");
        expect(content).toContain("is_approved");
        expect(content).toContain("is_hidden");
        expect(content).toContain("sort_order");
      });

      it("should render using displayCoverUrl not raw cover_image_url in album cards", () => {
        // The render section should reference album.displayCoverUrl
        expect(content).toMatch(/album\.displayCoverUrl/);
        // Should NOT use album.cover_image_url in the render section (only in query)
        const renderMatch = content.match(/galleriesWithCovers\.map[\s\S]*?<\/section>/);
        if (renderMatch) {
          expect(renderMatch[0]).not.toContain("album.cover_image_url");
        }
      });

      it("should maintain visibility filters on gallery_albums query", () => {
        expect(content).toContain('is_published", true');
        expect(content).toContain('is_hidden", false');
      });
    });
  }
});

describe("Gallery Collaborator Notifications", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should capture previous collaborator IDs before save", () => {
    expect(content).toContain("prevCollaboratorIds");
  });

  it("should compute newly added collaborator IDs after successful save", () => {
    expect(content).toMatch(/addedIds.*filter.*prevCollaboratorIds/);
  });

  it("should call create_user_notification RPC for newly added collaborators", () => {
    expect(content).toContain("create_user_notification");
    expect(content).toContain("gallery_collaborator_added");
  });

  it("should only notify after successful reconcile (not if save fails)", () => {
    // The notification RPC must come AFTER the reconcile try/catch block
    const reconcileIndex = content.indexOf("reconcileAlbumLinks");
    const notifyIndex = content.indexOf("gallery_collaborator_added");
    expect(reconcileIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(reconcileIndex);
  });

  it("should include album name and link in notification", () => {
    expect(content).toContain("Added as a collaborator");
    expect(content).toContain("p_link: albumLink");
  });
});

describe("Gallery Collaborator Save Clarity", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should have helper text about collaborator changes requiring Save", () => {
    expect(content).toContain(
      "Collaborator changes take effect after you click Save"
    );
  });
});

describe("Save and Publish Actions in Top and Bottom Rows", () => {
  const albumManagerPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"
  );
  const content = fs.readFileSync(albumManagerPath, "utf-8");

  it("should have Save button in the top action row", () => {
    expect(content).toContain("{/* Save button (top) */}");
  });

  it("should have Save button in the bottom action row", () => {
    expect(content).toContain("{/* Save / Cancel / Publish (bottom action row) */}");
  });

  it("should have Publish button in both top and bottom action rows", () => {
    const publishMatches = content.match(/onClick={handleTogglePublish}/g);
    expect(publishMatches).not.toBeNull();
    expect(publishMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should have Cancel button in both top and bottom action rows", () => {
    const cancelMatches = content.match(/onClick={handleCancelEdits}/g);
    expect(cancelMatches).not.toBeNull();
    expect(cancelMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it("should disable Save when no unsaved changes", () => {
    expect(content).toContain("disabled={isSaving || !hasUnsavedChanges}");
  });
});

describe("Collaborator Email Template", () => {
  const templatePath = path.join(
    __dirname,
    "../lib/email/templates/collaboratorAdded.ts"
  );

  it("should exist", () => {
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it("should export getCollaboratorAddedEmail function", () => {
    const content = fs.readFileSync(templatePath, "utf-8");
    expect(content).toContain("export function getCollaboratorAddedEmail");
  });

  it("should include album name in subject and body", () => {
    const content = fs.readFileSync(templatePath, "utf-8");
    expect(content).toContain("albumName");
    expect(content).toContain("collaborator");
  });

  it("should include link to album page", () => {
    const content = fs.readFileSync(templatePath, "utf-8");
    expect(content).toContain("albumSlug");
    expect(content).toContain("/gallery/");
  });
});
