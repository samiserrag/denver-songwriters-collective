import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import { AlbumCommentsSection } from "./_components/AlbumCommentsSection";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

const IMAGES_PER_PAGE = 24;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: album } = await supabase
    .from("gallery_albums")
    .select("name, description")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!album) {
    return {
      title: "Album Not Found | Denver Songwriters Collective",
    };
  }

  const ogImageUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://denversongwriterscollective.org"}/og/gallery/${slug}`;

  return {
    title: `${album.name} | Gallery | Denver Songwriters Collective`,
    description: album.description || `Photos from ${album.name}`,
    openGraph: {
      title: `${album.name} | Gallery`,
      description: album.description || `Photos from ${album.name}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: album.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${album.name} | Gallery`,
      description: album.description || `Photos from ${album.name}`,
      images: [ogImageUrl],
    },
  };
}

export default async function AlbumPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const offset = (page - 1) * IMAGES_PER_PAGE;

  // Fetch album details
  const { data: album } = await supabase
    .from("gallery_albums")
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      created_at,
      created_by,
      event:events(id, slug, title),
      venue:venues(id, name)
    `)
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!album) {
    notFound();
  }

  // Fetch images for this album with pagination
  // Filter by is_published/is_hidden (matches gallery listing page)
  // RLS handles owner access to their own unapproved images
  const { data: images, count: totalCount } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_featured,
      created_at,
      uploaded_by,
      uploader:profiles!gallery_images_uploaded_by_fkey(id, full_name),
      event:events(title),
      venue:venues(name)
    `, { count: "exact" })
    .eq("album_id", album.id)
    .eq("is_published", true)
    .eq("is_hidden", false)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + IMAGES_PER_PAGE - 1);

  const totalPages = Math.ceil((totalCount ?? 0) / IMAGES_PER_PAGE);

  // Normalize the array join for event/venue
  const normalizedAlbum = {
    ...album,
    event: Array.isArray(album.event) ? album.event[0] ?? null : album.event,
    venue: Array.isArray(album.venue) ? album.venue[0] ?? null : album.venue,
  };

  const formattedDate = new Date(album.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });

  return (
    <>
      {/* Page Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm">
              <li>
                <Link
                  href="/gallery"
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors"
                >
                  Gallery
                </Link>
              </li>
              <li className="text-[var(--color-text-tertiary)]">/</li>
              <li className="text-[var(--color-text-primary)]">{album.name}</li>
            </ol>
          </nav>

          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
            {album.name}
          </h1>

          {album.description && (
            <p className="text-lg text-[var(--color-text-secondary)] mt-3 max-w-2xl">
              {album.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-[var(--color-text-tertiary)]">
            <span>{totalCount ?? 0} {(totalCount ?? 0) === 1 ? "photo" : "photos"}</span>
            <span>Created {formattedDate}</span>
            {normalizedAlbum.event && (
              <span>
                <Link
                  href={`/events/${normalizedAlbum.event.slug || normalizedAlbum.event.id}`}
                  className="hover:text-[var(--color-text-accent)] transition-colors"
                >
                  @ {normalizedAlbum.event.title}
                </Link>
              </span>
            )}
            {normalizedAlbum.venue && !normalizedAlbum.event && (
              <span>@ {normalizedAlbum.venue.name}</span>
            )}
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {/* Album Comments */}
          <AlbumCommentsSection albumId={album.id} albumOwnerId={album.created_by} />

          {images && images.length > 0 ? (
            <>
              <GalleryGrid images={images} albumOwnerId={album.created_by} />

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="mt-12 flex justify-center items-center gap-2" aria-label="Album pagination">
                  {page > 1 && (
                    <Link
                      href={`/gallery/${slug}?page=${page - 1}`}
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
                      href={`/gallery/${slug}?page=${page + 1}`}
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
            <div className="text-center py-16">
              <p className="text-[var(--color-text-secondary)] text-lg mb-4">
                No photos in this album yet.
              </p>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 text-[var(--color-text-accent)] hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Gallery
              </Link>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
