import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery | Denver Songwriters Collective",
  description: "Photos from open mics, showcases, and community events across Denver.",
};

export const dynamic = "force-dynamic";

const IMAGES_PER_PAGE = 24;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * IMAGES_PER_PAGE;

  // Fetch published albums with image count
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      created_at
    `)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(6);

  // Count images in each album and filter out empty albums
  const albumsWithCount = albums ? (await Promise.all(
    albums.map(async (album) => {
      const { count } = await supabase
        .from("gallery_images")
        .select("*", { count: "exact", head: true })
        .eq("album_id", album.id)
        .eq("is_approved", true);
      return { ...album, imageCount: count ?? 0 };
    })
  )).filter((album) => album.imageCount > 0) : [];

  // Fetch paginated images (excluding those in albums for the main grid)
  const { data: images, count: totalCount } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_featured,
      created_at,
      uploader:profiles!gallery_images_uploaded_by_fkey(full_name),
      event:events(title),
      venue:venues(name)
    `, { count: "exact" })
    .eq("is_approved", true)
    .is("album_id", null)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + IMAGES_PER_PAGE - 1);

  const totalPages = Math.ceil((totalCount ?? 0) / IMAGES_PER_PAGE);

  return (
    <>
      {/* Page Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto px-6 py-10 text-center">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
            Gallery
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mt-3">
            Moments from open mics, showcases, and community events
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
            <Link
              href="/events"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              See events
            </Link>
            <Link
              href="/dashboard/admin/gallery"
              className="inline-flex items-center justify-center px-6 py-3 border border-[var(--color-border-accent)] text-[var(--color-text-accent)] font-medium rounded-full hover:bg-[var(--color-accent-primary)]/10 transition-colors"
            >
              Share your photos
            </Link>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {/* Albums Section */}
          {albumsWithCount.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">
                Photo Albums
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {albumsWithCount.map((album) => (
                  <Link
                    key={album.id}
                    href={`/gallery/${album.slug}`}
                    className="group block rounded-xl overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors"
                  >
                    <div className="relative aspect-[4/3] w-full bg-[var(--color-bg-tertiary)]">
                      {album.cover_image_url ? (
                        <Image
                          src={album.cover_image_url}
                          alt={album.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg className="w-12 h-12 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <h3 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                        {album.name}
                      </h3>
                      {album.description && (
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2 text-left">
                          {album.description}
                        </p>
                      )}
                      <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
                        {album.imageCount} {album.imageCount === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </Link>
                ))}

                {/* Share Your Photos CTA Card */}
                <Link
                  href="/dashboard/admin/gallery"
                  className="group block rounded-xl overflow-hidden border border-dashed border-[var(--color-border-accent)]/40 bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent hover:border-[var(--color-border-accent)] transition-colors"
                >
                  <div className="relative aspect-[4/3] w-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-[var(--color-text-accent)]/50 group-hover:text-[var(--color-text-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                      Share Your Photos
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                      Got photos from an open mic or event? Add them to the gallery.
                    </p>
                    <span className="inline-flex items-center justify-center gap-1 text-[var(--color-text-accent)] text-sm font-medium mt-2">
                      Upload photos
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </div>
            </section>
          )}

          {/* Individual Photos Section */}
          <section>
            {albumsWithCount.length > 0 && (
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-6">
                All Photos
              </h2>
            )}

            {images && images.length > 0 ? (
              <>
                <GalleryGrid images={images} />

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="mt-12 flex justify-center items-center gap-2" aria-label="Gallery pagination">
                    {page > 1 && (
                      <Link
                        href={`/gallery?page=${page - 1}`}
                        className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        aria-label="Previous page"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </Link>
                    )}

                    <span className="px-4 py-2 text-[var(--color-text-secondary)]">
                      Page {page} of {totalPages}
                    </span>

                    {page < totalPages && (
                      <Link
                        href={`/gallery?page=${page + 1}`}
                        className="px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                        aria-label="Next page"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </nav>
                )}
              </>
            ) : (
              <div className="text-center py-16 space-y-6">
                <p className="text-[var(--color-text-secondary)] text-lg">
                  {albumsWithCount.length > 0 ? "No individual photos yet." : "No photos yet. Be the first to share!"}
                </p>
                <p className="text-[var(--color-text-tertiary)] text-sm">
                  Photos from community members will appear here after approval.
                </p>
                <Link
                  href="/dashboard/admin/gallery"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Photos
                </Link>
              </div>
            )}
          </section>
        </div>
      </PageContainer>
    </>
  );
}
