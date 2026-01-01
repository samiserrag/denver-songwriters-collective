import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UserGalleryUpload from "./UserGalleryUpload";

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

  // Fetch user's uploaded photos
  const { data: myPhotos } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_approved,
      created_at,
      album:gallery_albums(id, name)
    `)
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  // Fetch albums for the upload form
  // Include both: published albums (from anyone) OR user's own albums (even if unpublished)
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select("id, name")
    .or(`is_published.eq.true,created_by.eq.${userId}`)
    .order("name");

  // Fetch venues for metadata
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name");

  // Fetch events for metadata - include event_date for display, sort by most recent first
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date")
    .order("event_date", { ascending: false, nullsFirst: false });

  const pendingCount = myPhotos?.filter(p => !p.is_approved).length ?? 0;
  const approvedCount = myPhotos?.filter(p => p.is_approved).length ?? 0;

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
            Share photos from open mics and events with the community.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center">
            <div className="text-2xl font-bold text-emerald-500">{approvedCount}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Published</div>
          </div>
          <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-500">{pendingCount}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Pending Review</div>
          </div>
        </div>

        {/* Upload Section */}
        <section className="mb-12 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Upload New Photos
          </h2>
          <UserGalleryUpload
            albums={albums ?? []}
            venues={venues ?? []}
            events={events ?? []}
            userId={userId}
          />
        </section>

        {/* My Photos Grid */}
        <section>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            My Uploads ({myPhotos?.length ?? 0})
          </h2>

          {myPhotos && myPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {myPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                >
                  <Image
                    src={photo.image_url}
                    alt={photo.caption || "Gallery photo"}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                    className="object-cover"
                  />
                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {photo.is_approved ? (
                      <span className="px-2 py-1 bg-emerald-500/90 text-white text-xs rounded-full">
                        Live
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-500/90 text-white text-xs rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  {/* Album Badge */}
                  {photo.album && typeof photo.album === "object" && "name" in photo.album && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <span className="px-2 py-1 bg-black/60 text-white text-xs rounded truncate block">
                        {(photo.album as { name: string }).name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <div className="text-4xl mb-4">📷</div>
              <p>No photos uploaded yet.</p>
              <p className="text-sm mt-1">Upload your first photo above!</p>
            </div>
          )}
        </section>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg">
          <h3 className="font-medium text-[var(--color-text-primary)] mb-2">How it works</h3>
          <ul className="text-sm text-[var(--color-text-secondary)] space-y-1">
            <li>• Photos are reviewed before appearing in the public gallery</li>
            <li>• Most photos are approved within 24 hours</li>
            <li>• Please only upload photos you have permission to share</li>
            <li>• Avoid photos with identifiable faces without consent</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
