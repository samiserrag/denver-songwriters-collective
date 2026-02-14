import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FolderOpen } from "lucide-react";
import { CreateAlbumForm } from "./_components/CreateAlbumForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Albums | CSC"
};

export default async function UserGalleryPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  const userId = sessionUser.id;

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

  // Fetch user's uploaded photos (for stats)
  const { data: myPhotos } = await supabase
    .from("gallery_images")
    .select("id, is_published, is_hidden")
    .eq("uploaded_by", userId);

  // Count visible vs hidden photos
  const visibleCount = myPhotos?.filter(p => p.is_published && !p.is_hidden).length ?? 0;
  const hiddenCount = myPhotos?.filter(p => p.is_hidden).length ?? 0;

  // Fetch venues for album create form
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  // Fetch events for album create form
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date")
    .eq("status", "published")
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
            My Albums
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Create albums and upload photos to share with the community.
          </p>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
            Albums can be linked to venues, events, and collaborators.
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

        {/* Create Album Section */}
        <section className="mb-12">
          <CreateAlbumForm
            venues={venues ?? []}
            events={events ?? []}
            userId={userId}
          />
        </section>

        {/* My Albums Section */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            My Albums ({albumsWithCounts.length})
          </h2>

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
                        className="object-contain group-hover:scale-[1.02] transition-transform"
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
                          : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
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
                Create your first album above to start uploading photos.
              </p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
