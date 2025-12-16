import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery | Denver Songwriters Collective",
  description: "Photos from open mics, showcases, and community events across Denver.",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient();

  const { data: images } = await supabase
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
    `)
    .eq("is_approved", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <>
      {/* Page Header */}
      <div className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)]">
            Gallery
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] mt-3">
            Moments from open mics, showcases, and community events
          </p>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {images && images.length > 0 ? (
            <GalleryGrid images={images} />
          ) : (
            <div className="text-center py-16">
              <p className="text-[var(--color-text-secondary)] text-lg mb-4">
                No photos yet. Be the first to share!
              </p>
              <p className="text-[var(--color-text-tertiary)] text-sm">
                Photos from community members will appear here after approval.
              </p>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
