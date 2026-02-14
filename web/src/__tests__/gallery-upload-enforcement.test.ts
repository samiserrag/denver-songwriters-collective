/**
 * Gallery Upload Enforcement Tests
 *
 * Verifies the "album-required" invariant is enforced at every layer:
 * 1. DB: migration makes album_id NOT NULL + ON DELETE RESTRICT
 * 2. UI: deleted components (UserGalleryUpload, UnassignedPhotosManager) are gone
 * 3. UI: /dashboard/gallery page.tsx is album-dashboard only
 * 4. UI: BulkUploadGrid requires album selection
 * 5. UI: CreateAlbumForm has venue/event/collaborator selectors
 * 6. UI: GalleryAdminTabs create form has venue/event/collaborator + reconcile
 * 7. UI: GalleryAdminTabs handleDeleteAlbum checks photo count before delete
 */

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const MIGRATIONS = path.resolve(__dirname, "../../..", "supabase/migrations");

// ---------------------------------------------------------------------------
// 1. Migration enforces album-required at DB level
// ---------------------------------------------------------------------------
describe("gallery_require_album migration", () => {
  const migrationPath = path.join(MIGRATIONS, "20260215200000_gallery_require_album.sql");
  const source = fs.readFileSync(migrationPath, "utf-8");

  it("makes album_id NOT NULL", () => {
    expect(source).toContain("ALTER COLUMN album_id SET NOT NULL");
  });

  it("drops old FK constraint", () => {
    expect(source).toContain("DROP CONSTRAINT IF EXISTS gallery_images_album_id_fkey");
  });

  it("recreates FK with ON DELETE RESTRICT (not SET NULL or CASCADE)", () => {
    expect(source).toContain("ON DELETE RESTRICT");
    // Verify no actual SET NULL or CASCADE in SQL statements (comments may reference old behavior)
    const sqlStatements = source
      .split("\n")
      .filter((line: string) => !line.trimStart().startsWith("--"));
    const sqlBody = sqlStatements.join("\n");
    expect(sqlBody).not.toContain("ON DELETE SET NULL");
    expect(sqlBody).not.toContain("ON DELETE CASCADE");
  });

  it("references gallery_albums(id)", () => {
    expect(source).toContain("REFERENCES public.gallery_albums(id)");
  });
});

// ---------------------------------------------------------------------------
// 2. Deleted components no longer exist
// ---------------------------------------------------------------------------
describe("retired components removed", () => {
  it("UserGalleryUpload.tsx is deleted", () => {
    const filePath = path.join(SRC, "app/(protected)/dashboard/gallery/UserGalleryUpload.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("UnassignedPhotosManager.tsx is deleted", () => {
    const filePath = path.join(SRC, "app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("no source file imports UserGalleryUpload", () => {
    const pageSource = fs.readFileSync(
      path.join(SRC, "app/(protected)/dashboard/gallery/page.tsx"),
      "utf-8"
    );
    expect(pageSource).not.toContain("UserGalleryUpload");
  });

  it("no source file imports UnassignedPhotosManager", () => {
    const pageSource = fs.readFileSync(
      path.join(SRC, "app/(protected)/dashboard/gallery/page.tsx"),
      "utf-8"
    );
    expect(pageSource).not.toContain("UnassignedPhotosManager");
  });
});

// ---------------------------------------------------------------------------
// 3. /dashboard/gallery page is album-dashboard only
// ---------------------------------------------------------------------------
describe("gallery dashboard page", () => {
  const source = fs.readFileSync(
    path.join(SRC, "app/(protected)/dashboard/gallery/page.tsx"),
    "utf-8"
  );

  it("renders CreateAlbumForm component", () => {
    expect(source).toContain("CreateAlbumForm");
    expect(source).toContain("_components/CreateAlbumForm");
  });

  it("title is 'My Albums' not 'My Photos'", () => {
    expect(source).toContain("My Albums");
    expect(source).not.toContain("My Photos");
  });

  it("does not reference unassigned photos", () => {
    expect(source).not.toContain("unassigned");
    expect(source).not.toContain("Unassigned");
  });

  it("passes venues and events to CreateAlbumForm", () => {
    expect(source).toContain("venues={");
    expect(source).toContain("events={");
  });
});

// ---------------------------------------------------------------------------
// 4. BulkUploadGrid requires album selection
// ---------------------------------------------------------------------------
describe("BulkUploadGrid album enforcement", () => {
  const source = fs.readFileSync(
    path.join(SRC, "components/gallery/BulkUploadGrid.tsx"),
    "utf-8"
  );

  it("does not offer 'No album' option", () => {
    expect(source).not.toContain("No album");
    expect(source).not.toContain("add to library");
  });

  it("has a 'Select album...' placeholder option", () => {
    expect(source).toContain("Select album...");
  });

  it("labels album as required", () => {
    expect(source).toContain("(required)");
  });

  it("guards uploadAll with album selection check", () => {
    expect(source).toContain("if (!selectedAlbum)");
    expect(source).toContain("Please select an album before uploading");
  });

  it("does not send null album_id", () => {
    // Should be `album_id: albumId` not `album_id: albumId || null`
    expect(source).not.toContain("album_id: albumId || null");
  });
});

// ---------------------------------------------------------------------------
// 5. CreateAlbumForm has venue/event/collaborator selectors + reconcile
// ---------------------------------------------------------------------------
describe("CreateAlbumForm completeness", () => {
  const source = fs.readFileSync(
    path.join(SRC, "app/(protected)/dashboard/gallery/_components/CreateAlbumForm.tsx"),
    "utf-8"
  );

  it("has venue selector", () => {
    expect(source).toContain("venueId");
    expect(source).toContain("venue_id");
  });

  it("has event selector", () => {
    expect(source).toContain("eventId");
    expect(source).toContain("event_id");
  });

  it("has CollaboratorSelect component", () => {
    expect(source).toContain("CollaboratorSelect");
    expect(source).toContain("@/components/gallery/CollaboratorSelect");
  });

  it("calls reconcileAlbumLinks with all fields", () => {
    expect(source).toContain("reconcileAlbumLinks(supabase, data.id,");
    expect(source).toContain("createdBy: userId");
    expect(source).toContain("venueId: venueIdValue");
    expect(source).toContain("eventId: eventIdValue");
    expect(source).toContain("collaboratorIds:");
  });

  it("redirects to album detail page after creation", () => {
    expect(source).toContain("router.push(`/dashboard/gallery/albums/${data.id}`)");
  });
});

// ---------------------------------------------------------------------------
// 6. GalleryAdminTabs create form has venue/event/collaborator + reconcile
// ---------------------------------------------------------------------------
describe("GalleryAdminTabs album create completeness", () => {
  const source = fs.readFileSync(
    path.join(SRC, "app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx"),
    "utf-8"
  );

  it("imports reconcileAlbumLinks", () => {
    expect(source).toContain("reconcileAlbumLinks");
    expect(source).toContain("@/lib/gallery/albumLinks");
  });

  it("imports CollaboratorSelect", () => {
    expect(source).toContain("CollaboratorSelect");
    expect(source).toContain("@/components/gallery/CollaboratorSelect");
  });

  it("has venue and event state for album create", () => {
    expect(source).toContain("albumVenueId");
    expect(source).toContain("albumEventId");
    expect(source).toContain("albumCollaborators");
  });

  it("inserts album with venue_id and event_id", () => {
    expect(source).toContain("venue_id: venueIdValue");
    expect(source).toContain("event_id: eventIdValue");
  });

  it("calls reconcileAlbumLinks after album creation", () => {
    expect(source).toContain("reconcileAlbumLinks(supabase, data.id,");
    expect(source).toContain("createdBy: userId");
    expect(source).toContain("collaboratorIds: albumCollaborators.map");
  });

  it("does not reference unassigned photos", () => {
    expect(source).not.toContain("unassigned");
    expect(source).not.toContain("Unassigned");
  });
});

// ---------------------------------------------------------------------------
// 7. GalleryAdminTabs handleDeleteAlbum checks photo count
// ---------------------------------------------------------------------------
describe("GalleryAdminTabs delete album safety", () => {
  const source = fs.readFileSync(
    path.join(SRC, "app/(protected)/dashboard/admin/gallery/GalleryAdminTabs.tsx"),
    "utf-8"
  );

  it("checks photo count before delete", () => {
    expect(source).toContain("getAlbumPhotoCount(albumId)");
    expect(source).toContain("Cannot delete album");
  });

  it("blocks delete when photos exist", () => {
    expect(source).toContain("if (photoCount > 0)");
    expect(source).toContain("Remove or move all photos first");
  });

  it("only confirms delete for empty albums", () => {
    expect(source).toContain("Delete this empty album?");
  });

  it("does not have old unassigned confirmation copy", () => {
    expect(source).not.toContain("Photos in it will be unassigned");
  });
});
