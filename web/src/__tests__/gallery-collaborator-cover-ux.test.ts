/**
 * Tests: Gallery collaborator notifications, cover fallback, and Save clarity
 *
 * Verifies:
 * 1. Profile pages (studios, performers, songwriters) compute displayCoverUrl
 *    using fallback to first visible image when cover_image_url is null
 * 2. AlbumManager calls server-side notify-collaborators route for newly added collaborators
 * 3. Collaborator helper text is present in AlbumManager
 * 4. Save and Publish actions appear in both top and bottom action rows
 * 5. Email template exists with correct structure
 * 6. Server notify-collaborators route has correct auth checks and RPC calls
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
        expect(content).toMatch(/album\.displayCoverUrl/);
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

describe("Gallery Collaborator Notifications — AlbumManager client side", () => {
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

  it("should call server notify-collaborators route (not client RPC)", () => {
    expect(content).toContain("/api/gallery-albums/");
    expect(content).toContain("/notify-collaborators");
    expect(content).toContain("added_user_ids");
    expect(content).toContain("album_name");
    expect(content).toContain("album_slug");
    // Must NOT contain the old client-side RPC call
    expect(content).not.toContain('supabase.rpc("create_user_notification"');
  });

  it("should include credentials in fetch for auth cookie forwarding", () => {
    expect(content).toContain('credentials: "include"');
  });

  it("should only notify after successful reconcile (not if save fails)", () => {
    const reconcileIndex = content.indexOf("reconcileAlbumLinks");
    const notifyIndex = content.indexOf("notify-collaborators");
    expect(reconcileIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(-1);
    expect(notifyIndex).toBeGreaterThan(reconcileIndex);
  });

  it("should await the notification fetch and toast on error", () => {
    expect(content).toContain("await fetch(");
    expect(content).toContain("collaborator notifications failed");
  });
});

describe("Gallery Collaborator Notifications — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/notify-collaborators/route.ts"
  );
  const content = fs.readFileSync(routePath, "utf-8");

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    expect(content).toContain("export async function POST");
  });

  it("should authenticate the caller", () => {
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should verify album ownership (created_by or admin)", () => {
    expect(content).toContain("created_by");
    expect(content).toContain("isAdmin");
    expect(content).toContain('"Forbidden"');
    expect(content).toContain("status: 403");
  });

  it("should call create_user_notification RPC with correct args", () => {
    expect(content).toContain('supabase.rpc("create_user_notification"');
    expect(content).toContain("gallery_collaborator_added");
    expect(content).toContain("Added as a collaborator");
    expect(content).toContain("p_link: albumLink");
  });

  it("should use server Supabase client (not browser client)", () => {
    expect(content).toContain("createSupabaseServerClient");
    expect(content).not.toContain("createClient");
  });

  it("should validate request body", () => {
    expect(content).toContain("added_user_ids");
    expect(content).toContain("album_name");
    expect(content).toContain("album_slug");
    expect(content).toContain("status: 400");
  });

  it("should return 404 for missing album", () => {
    expect(content).toContain('"Album not found"');
    expect(content).toContain("status: 404");
  });

  it("should validate UUID format of added_user_ids", () => {
    expect(content).toContain("UUID_RE");
    expect(content).toContain("Invalid user ID format");
  });

  it("should enforce max 10 collaborators per request", () => {
    expect(content).toContain("added_user_ids.length > 10");
    expect(content).toContain("Too many collaborators");
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
