import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UserGalleryUpload from "./UserGalleryUpload";
import { FolderOpen, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Photos | DSC"
};

export default async function UserGalleryPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const userId = session.user.id;

  // Fetch user's albums with photo counts
  const { data: userAlbums } = await supabase
    .from("gallery_albums")
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      is_published,
      is_hidden,
      created_at
    `)
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  // Get photo counts for each album
  const albumsWithCounts = userAlbums ? await Promise.all(
    userAlbums.map(async (album) => {
      const { count } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .eq("album_id", album.id);

      // Get first visible image for cover fallback
      let fallbackCoverUrl: string | null = null;
      if (!album.cover_image_url) {
        const { data: firstImage } = await supabase
          .from("gallery_images")
          .select("image_url")
          .eq("album_id", album.id)
          .eq("is_published", true)
          .eq("is_hidden", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        fallbackCoverUrl = firstImage?.image_url ?? null;
      }

      return {
        ...album,
        photoCount: count ?? 0,
        displayCoverUrl: album.cover_image_url || fallbackCoverUrl,
      };
    })
  ) : [];

  // Fetch user's uploaded photos (for stats and unassigned photos)
  const { data: myPhotos } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_published,
      is_hidden,
      album_id,
      created_at
    `)
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  // Count visible vs hidden photos
  const visibleCount = myPhotos?.filter(p => p.is_published && !p.is_hidden).length ?? 0;
  const hiddenCount = myPhotos?.filter(p => p.is_hidden).length ?? 0;
  const unassignedPhotos = myPhotos?.filter(p => !p.album_id) ?? [];

  // Fetch all albums for the upload form (published albums from anyone OR user's own)
  const { data: allAlbums } = await supabase
    .from("gallery_albums")
    .select("id, name")
    .or(`is_published.eq.true,created_by.eq.${userId}`)
    .order("name");

  // Fetch venues for metadata
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name");

  // Fetch events for metadata
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date")
    .order("event_date", { ascending: false, nullsFirst: false });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)]">
            My Photos
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Organize and share your photos with the community.
          </p>
        </div>

        {/* Stats */}
        <div className={`grid gap-4 mb-8 ${hiddenCount > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center">
            <div className="text-2xl font-bold text-[var(--color-text-accent)]">{albumsWithCounts.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Albums</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-500">{visibleCount}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Visible Photos</div>
          </div>
          {hiddenCount > 0 && (
            <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center">
              <div className="text-2xl font-bold text-red-500">{hiddenCount}</div>
              <div className="text-sm text-[var(--color-text-secondary)]">Hidden by Admin</div>
            </div>
          )}
        </div>

        {/* My Albums Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              My Albums ({albumsWithCounts.length})
            </h2>
          </div>

          {albumsWithCounts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albumsWithCounts.map((album) => (
                <Link
                  key={album.id}
                  href={`/dashboard/gallery/albums/${album.id}`}
                  className="group block rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-all"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-[3/2] bg-[var(--color-bg-tertiary)]">
                    {album.displayCoverUrl ? (
                      <Image
                        src={album.displayCoverUrl}
                        alt={album.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FolderOpen className="w-12 h-12 text-[var(--color-text-tertiary)]" />
                      </div>
                    )}

                    {/* Status Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {album.is_hidden && (
                        <span className="px-2 py-0.5 bg-red-500/90 text-white text-xs rounded-full">
                          Hidden
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        album.is_published
                          ? "bg-green-500/90 text-white"
                          : "bg-yellow-500/90 text-white"
                      }`}>
                        {album.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>

                  {/* Album Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                      {album.name}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {album.photoCount} {album.photoCount === 1 ? "photo" : "photos"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
              <FolderOpen className="w-12 h-12 text-[var(--color-text-tertiary)] mx-auto mb-4" />
              <p className="text-[var(--color-text-secondary)]">No albums yet.</p>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
                Create an album when uploading photos below.
              </p>
            </div>
          )}
        </section>

        {/* Upload Section */}
        <section className="mb-12 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-[var(--color-text-accent)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Upload New Photos
            </h2>
          </div>
          <UserGalleryUpload
            albums={allAlbums ?? []}
            venues={venues ?? []}
            events={events ?? []}
            userId={userId}
          />
        </section>

        {/* Unassigned Photos Section */}
        {unassignedPhotos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Unassigned Photos ({unassignedPhotos.length})
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              These photos are not in any album. Add them to an album when uploading or via the admin panel.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {unassignedPhotos.slice(0, 12).map((photo) => (
                <div
                  key={photo.id}
                  className={`relative aspect-square rounded-lg overflow-hidden border ${
                    photo.is_hidden ? "border-red-300 opacity-60" : "border-[var(--color-border-default)]"
                  } bg-[var(--color-bg-tertiary)]`}
                >
                  <Image
                    src={photo.image_url}
                    alt={photo.caption || "Gallery photo"}
                    fill
                    sizes="100px"
                    className="object-cover"
                  />
                  {photo.is_hidden && (
                    <div className="absolute top-1 right-1">
                      <span className="px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] rounded-full">
                        Hidden
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {unassignedPhotos.length > 12 && (
              <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                +{unassignedPhotos.length - 12} more unassigned photos
              </p>
            )}
          </section>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg">
          <h3 className="font-medium text-[var(--color-text-primary)] mb-2">How it works</h3>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            <li>• Photos appear immediately in the gallery</li>
            <li>• Organize photos into albums for better discovery</li>
            <li>• Set any photo as the album cover</li>
            <li>• Admins may hide photos that violate community guidelines</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
