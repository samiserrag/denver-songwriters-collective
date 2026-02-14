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
 * 6. Server notify-collaborators route has correct auth checks, actor name, and email sending
 * 7. Leave-collaboration route exists with correct behavior
 * 8. NotificationsList renders "Remove myself" button for collaborator notifications
 * 9. collaboratorAdded is registered in template registry and category map
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

  it("should derive actor name from session user profile", () => {
    expect(content).toContain("actorProfile");
    expect(content).toContain("full_name");
    expect(content).toContain('|| user.email || "Someone"');
  });

  it("should include actor name in notification message", () => {
    expect(content).toContain("actorName");
    expect(content).toMatch(/actorName.*added you as a collaborator/);
  });

  it("should use sendEmailWithPreferences for notification + email", () => {
    expect(content).toContain("sendEmailWithPreferences");
    expect(content).toContain("gallery_collaborator_added");
    expect(content).toContain("Added as a collaborator");
    expect(content).toContain('templateKey: "collaboratorAdded"');
  });

  it("should include albumId in notification link for self-removal", () => {
    expect(content).toContain("albumId=");
    expect(content).toMatch(/albumLink.*albumId/);
  });

  it("should fetch collaborator email via service role client", () => {
    expect(content).toContain("getServiceRoleClient");
    expect(content).toContain("auth.admin.getUserById");
    expect(content).toContain("collabEmail");
  });

  it("should use server Supabase client (not browser client)", () => {
    expect(content).toContain("createSupabaseServerClient");
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

describe("Leave Collaboration — Server route", () => {
  const routePath = path.join(
    __dirname,
    "../app/api/gallery-albums/[id]/leave-collaboration/route.ts"
  );

  it("should exist as a POST handler", () => {
    expect(fs.existsSync(routePath)).toBe(true);
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function POST");
  });

  it("should require authentication (401)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("auth.getUser()");
    expect(content).toContain('"Unauthorized"');
    expect(content).toContain("status: 401");
  });

  it("should validate album ID format (400)", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("UUID_RE");
    expect(content).toContain('"Invalid album ID"');
    expect(content).toContain("status: 400");
  });

  it("should delete only collaborator role links for the caller", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('.eq("album_id", albumId)');
    expect(content).toContain('.eq("target_type", "profile")');
    expect(content).toContain('.eq("target_id", user.id)');
    expect(content).toContain('.eq("link_role", "collaborator")');
  });

  it("should use service role client to bypass RLS", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("getServiceRoleClient");
  });

  it("should return { removed: true|false } based on delete result", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("removed");
    expect(content).toMatch(/removed.*data.*length/);
  });
});

describe("NotificationsList — Remove myself button", () => {
  const listPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/notifications/NotificationsList.tsx"
  );
  const content = fs.readFileSync(listPath, "utf-8");

  it("should render Remove myself button for gallery_collaborator_added type", () => {
    expect(content).toContain('notification.type === "gallery_collaborator_added"');
    expect(content).toContain("Remove myself");
  });

  it("should parse albumId from notification link", () => {
    expect(content).toContain("getAlbumIdFromLink");
    expect(content).toContain('searchParams.get("albumId")');
  });

  it("should call leave-collaboration API route on click", () => {
    expect(content).toContain("/api/gallery-albums/");
    expect(content).toContain("/leave-collaboration");
    expect(content).toContain('method: "POST"');
  });

  it("should show loading state during removal", () => {
    expect(content).toContain("leavingAlbum");
    expect(content).toContain("Removing...");
  });

  it("should remove notification from list on success", () => {
    expect(content).toContain("data.removed");
    expect(content).toMatch(/setItems.*prev.*filter/);
  });

  it("should have gallery_collaborator_added icon", () => {
    expect(content).toContain('"gallery_collaborator_added"');
  });
});

describe("Collaborator Email — Registry and Category Registration", () => {
  it("should be registered in TEMPLATE_REGISTRY", () => {
    const registryPath = path.join(
      __dirname,
      "../lib/email/registry.ts"
    );
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain('"collaboratorAdded"');
    expect(content).toContain("collaboratorAdded:");
    // Verify in EmailTemplateKey union
    expect(content).toContain('| "collaboratorAdded"');
    // Verify in getTemplate switch
    expect(content).toContain('case "collaboratorAdded"');
    // Verify in re-exports
    expect(content).toContain("getCollaboratorAddedEmail");
    expect(content).toContain("CollaboratorAddedEmailParams");
  });

  it("should be mapped to event_updates category", () => {
    const prefsPath = path.join(
      __dirname,
      "../lib/notifications/preferences.ts"
    );
    const content = fs.readFileSync(prefsPath, "utf-8");
    expect(content).toContain('collaboratorAdded: "event_updates"');
  });
});
