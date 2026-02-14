/**
 * Gallery Album Links — Migration, Helper, and Page Wiring Tests
 *
 * Covers:
 * 1. Migration source: table, constraints, RPC, RLS, grants, backfill
 * 2. buildDesiredAlbumLinks: pure function correctness
 * 3. reconcileAlbumLinks: calls the correct RPC
 * 4. Page wiring: members, songwriters, events, venues query gallery_album_links
 * 5. Album edit wiring: AlbumManager calls reconcileAlbumLinks
 * 6. Album create wiring: UserGalleryUpload calls reconcileAlbumLinks
 * 7. Admin API wiring: route calls reconcileAlbumLinks
 * 8. Resilience: RPC error throws (does not silently succeed)
 */
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { buildDesiredAlbumLinks } from "@/lib/gallery/albumLinks";

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.resolve(__dirname, "../../..", "supabase/migrations");

// ---------------------------------------------------------------------------
// 1. Migration source checks
// ---------------------------------------------------------------------------
describe("gallery_album_links migration", () => {
  const migrationPath = path.join(MIGRATIONS, "20260215100000_gallery_album_links.sql");
  const source = fs.readFileSync(migrationPath, "utf-8");

  it("creates the gallery_album_links table", () => {
    expect(source).toContain("CREATE TABLE public.gallery_album_links");
  });

  it("has target_type CHECK constraint with profile, venue, event", () => {
    expect(source).toContain("gallery_album_links_target_type_check");
    expect(source).toContain("'profile'");
    expect(source).toContain("'venue'");
    expect(source).toContain("'event'");
  });

  it("has link_role CHECK constraint with creator, collaborator, venue, event", () => {
    expect(source).toContain("gallery_album_links_link_role_check");
    expect(source).toContain("'creator'");
    expect(source).toContain("'collaborator'");
  });

  it("has UNIQUE constraint on album_id, target_type, target_id, link_role", () => {
    expect(source).toContain("gallery_album_links_unique");
    expect(source).toContain("UNIQUE (album_id, target_type, target_id, link_role)");
  });

  it("creates the reconcile_gallery_album_links RPC function", () => {
    expect(source).toContain("reconcile_gallery_album_links");
    expect(source).toContain("SECURITY INVOKER");
    expect(source).toContain("p_album_id UUID");
    expect(source).toContain("p_links    JSONB");
  });

  it("RPC validates target_type/link_role consistency", () => {
    expect(source).toContain("target_type/link_role mismatch");
    expect(source).toContain("elem->>'target_type' = 'venue' AND elem->>'link_role' != 'venue'");
    expect(source).toContain("elem->>'target_type' = 'event' AND elem->>'link_role' != 'event'");
    expect(source).toContain("elem->>'target_type' = 'profile' AND elem->>'link_role' NOT IN ('creator', 'collaborator')");
  });

  it("revokes EXECUTE from anon and grants to authenticated", () => {
    expect(source).toContain("REVOKE ALL ON FUNCTION public.reconcile_gallery_album_links");
    expect(source).toContain("FROM anon");
    expect(source).toContain("GRANT EXECUTE ON FUNCTION public.reconcile_gallery_album_links");
    expect(source).toContain("TO authenticated");
  });

  it("enables RLS on gallery_album_links", () => {
    expect(source).toContain("ALTER TABLE public.gallery_album_links ENABLE ROW LEVEL SECURITY");
  });

  it("grants SELECT to anon and full DML to authenticated", () => {
    expect(source).toContain("GRANT SELECT ON public.gallery_album_links TO anon");
    expect(source).toContain("GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_album_links TO authenticated");
  });

  it("creates public_read, owner_manage, and admin_all RLS policies", () => {
    expect(source).toContain("gallery_album_links_public_read");
    expect(source).toContain("gallery_album_links_owner_manage");
    expect(source).toContain("gallery_album_links_admin_all");
  });

  it("public_read checks is_published = true AND is_hidden = false", () => {
    expect(source).toContain("is_published = true");
    expect(source).toContain("is_hidden = false");
  });

  it("backfills creator, venue, and event links", () => {
    // Creator backfill
    expect(source).toContain("'profile', created_by, 'creator'");
    // Venue backfill
    expect(source).toContain("'venue', venue_id, 'venue'");
    // Event backfill
    expect(source).toContain("'event', event_id, 'event'");
  });

  it("backfill uses idempotent NOT EXISTS pattern", () => {
    const notExistsCount = (source.match(/NOT EXISTS/g) || []).length;
    expect(notExistsCount).toBe(3); // creator, venue, event
  });
});

// ---------------------------------------------------------------------------
// 2. buildDesiredAlbumLinks: pure function
// ---------------------------------------------------------------------------
describe("buildDesiredAlbumLinks", () => {
  it("always includes a creator link", () => {
    const links = buildDesiredAlbumLinks({ createdBy: "user-1" });
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target_type: "profile",
      target_id: "user-1",
      link_role: "creator",
    });
  });

  it("includes venue link when venueId is provided", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      venueId: "venue-1",
    });
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({
      target_type: "venue",
      target_id: "venue-1",
      link_role: "venue",
    });
  });

  it("includes event link when eventId is provided", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      eventId: "event-1",
    });
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({
      target_type: "event",
      target_id: "event-1",
      link_role: "event",
    });
  });

  it("includes collaborator links", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      collaboratorIds: ["collab-1", "collab-2"],
    });
    expect(links).toHaveLength(3); // creator + 2 collaborators
    expect(links).toContainEqual({
      target_type: "profile",
      target_id: "collab-1",
      link_role: "collaborator",
    });
    expect(links).toContainEqual({
      target_type: "profile",
      target_id: "collab-2",
      link_role: "collaborator",
    });
  });

  it("deduplicates collaborator IDs", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      collaboratorIds: ["collab-1", "collab-1", "collab-2"],
    });
    const collabLinks = links.filter((l) => l.link_role === "collaborator");
    expect(collabLinks).toHaveLength(2);
  });

  it("allows creator to also be a collaborator (different link_role)", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      collaboratorIds: ["user-1"],
    });
    expect(links).toHaveLength(2);
    expect(links).toContainEqual({
      target_type: "profile",
      target_id: "user-1",
      link_role: "creator",
    });
    expect(links).toContainEqual({
      target_type: "profile",
      target_id: "user-1",
      link_role: "collaborator",
    });
  });

  it("builds full link set with all fields", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      venueId: "venue-1",
      eventId: "event-1",
      collaboratorIds: ["collab-1"],
    });
    expect(links).toHaveLength(4); // creator + venue + event + 1 collaborator
  });

  it("skips null/undefined venueId and eventId", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      venueId: null,
      eventId: undefined,
      collaboratorIds: [],
    });
    expect(links).toHaveLength(1); // creator only
  });

  it("skips empty string collaborator IDs", () => {
    const links = buildDesiredAlbumLinks({
      createdBy: "user-1",
      collaboratorIds: ["", "collab-1", ""],
    });
    const collabLinks = links.filter((l) => l.link_role === "collaborator");
    expect(collabLinks).toHaveLength(1);
    expect(collabLinks[0].target_id).toBe("collab-1");
  });
});

// ---------------------------------------------------------------------------
// 3. reconcileAlbumLinks: calls the correct RPC
// ---------------------------------------------------------------------------
describe("reconcileAlbumLinks", () => {
  it("calls supabase.rpc('reconcile_gallery_album_links') with correct params", async () => {
    const { reconcileAlbumLinks } = await import("@/lib/gallery/albumLinks");

    const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await reconcileAlbumLinks(mockSupabase, "album-1", {
      createdBy: "user-1",
      venueId: "venue-1",
      eventId: "event-1",
      collaboratorIds: ["collab-1"],
    });

    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith("reconcile_gallery_album_links", {
      p_album_id: "album-1",
      p_links: expect.arrayContaining([
        expect.objectContaining({ target_type: "profile", target_id: "user-1", link_role: "creator" }),
        expect.objectContaining({ target_type: "profile", target_id: "collab-1", link_role: "collaborator" }),
        expect.objectContaining({ target_type: "venue", target_id: "venue-1", link_role: "venue" }),
        expect.objectContaining({ target_type: "event", target_id: "event-1", link_role: "event" }),
      ]),
    });
  });

  it("throws on RPC error (does not silently succeed)", async () => {
    const { reconcileAlbumLinks } = await import("@/lib/gallery/albumLinks");

    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "constraint violation" },
    });
    const mockSupabase = {
      rpc: mockRpc,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;

    await expect(
      reconcileAlbumLinks(mockSupabase, "album-1", { createdBy: "user-1" })
    ).rejects.toThrow("Failed to reconcile album links: constraint violation");
  });
});

// ---------------------------------------------------------------------------
// 4. Page wiring: members and songwriters use gallery_album_links
// ---------------------------------------------------------------------------
describe("profile page wiring: gallery_album_links", () => {
  it("members page queries gallery_album_links for profile albums", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/members/[id]/page.tsx"), "utf-8");
    expect(source).toContain("gallery_album_links");
    expect(source).toContain("target_type");
    expect(source).toContain("profile");
  });

  it("songwriters page queries gallery_album_links for profile albums", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/songwriters/[id]/page.tsx"), "utf-8");
    expect(source).toContain("gallery_album_links");
    expect(source).toContain("target_type");
    expect(source).toContain("profile");
  });

  it("members page has legacy fallback to created_by", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/members/[id]/page.tsx"), "utf-8");
    expect(source).toContain("Legacy fallback");
    expect(source).toContain("created_by");
  });

  it("songwriters page has legacy fallback to created_by", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/songwriters/[id]/page.tsx"), "utf-8");
    expect(source).toContain("Legacy fallback");
    expect(source).toContain("created_by");
  });
});

describe("event page wiring: gallery_album_links", () => {
  it("event page queries gallery_album_links for event albums", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/events/[id]/page.tsx"), "utf-8");
    expect(source).toContain("gallery_album_links");
    expect(source).toContain("target_type");
    expect(source).toContain("eventAlbums");
  });

  it("event page still queries gallery_images separately (not removed)", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/events/[id]/page.tsx"), "utf-8");
    expect(source).toContain("eventPhotos");
    expect(source).toContain("gallery_images");
  });
});

describe("venue page wiring: gallery_album_links", () => {
  it("venue page queries gallery_album_links for venue albums", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/venues/[id]/page.tsx"), "utf-8");
    expect(source).toContain("gallery_album_links");
    expect(source).toContain("target_type");
    expect(source).toContain("venueAlbums");
  });

  it("venue page still queries venue_images separately (not removed)", () => {
    const source = fs.readFileSync(path.join(ROOT, "app/venues/[id]/page.tsx"), "utf-8");
    expect(source).toContain("venueImages");
    expect(source).toContain("venue_images");
  });
});

// ---------------------------------------------------------------------------
// 5. Album edit wiring: AlbumManager calls reconcileAlbumLinks
// ---------------------------------------------------------------------------
describe("AlbumManager wiring", () => {
  it("imports reconcileAlbumLinks", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"),
      "utf-8"
    );
    expect(source).toContain("reconcileAlbumLinks");
    expect(source).toContain("@/lib/gallery/albumLinks");
  });

  it("imports and uses CollaboratorSelect component", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"),
      "utf-8"
    );
    expect(source).toContain("CollaboratorSelect");
    expect(source).toContain("@/components/gallery/CollaboratorSelect");
  });

  it("has venue and event selectors in the edit form", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/albums/[id]/AlbumManager.tsx"),
      "utf-8"
    );
    expect(source).toContain("selectedVenueId");
    expect(source).toContain("selectedEventId");
    expect(source).toContain("venue_id");
    expect(source).toContain("event_id");
  });
});

// ---------------------------------------------------------------------------
// 6. Album create wiring: UserGalleryUpload calls reconcileAlbumLinks
// ---------------------------------------------------------------------------
describe("UserGalleryUpload wiring", () => {
  it("imports reconcileAlbumLinks", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/UserGalleryUpload.tsx"),
      "utf-8"
    );
    expect(source).toContain("reconcileAlbumLinks");
    expect(source).toContain("@/lib/gallery/albumLinks");
  });

  it("calls reconcile with createdBy after album creation", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/UserGalleryUpload.tsx"),
      "utf-8"
    );
    expect(source).toContain("reconcileAlbumLinks(supabase, data.id, { createdBy: userId })");
  });

  it("surfaces reconcile errors to user via toast", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/(protected)/dashboard/gallery/UserGalleryUpload.tsx"),
      "utf-8"
    );
    expect(source).toContain("cross-page links failed");
  });
});

// ---------------------------------------------------------------------------
// 7. Admin API wiring: route calls reconcileAlbumLinks
// ---------------------------------------------------------------------------
describe("admin gallery-albums API wiring", () => {
  it("imports reconcileAlbumLinks", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/api/admin/gallery-albums/[id]/route.ts"),
      "utf-8"
    );
    expect(source).toContain("reconcileAlbumLinks");
    expect(source).toContain("@/lib/gallery/albumLinks");
  });

  it("passes venue_id, event_id, and collaborator_ids from request body", () => {
    const source = fs.readFileSync(
      path.join(ROOT, "app/api/admin/gallery-albums/[id]/route.ts"),
      "utf-8"
    );
    expect(source).toContain("body.venue_id");
    expect(source).toContain("body.event_id");
    expect(source).toContain("body.collaborator_ids");
  });
});
