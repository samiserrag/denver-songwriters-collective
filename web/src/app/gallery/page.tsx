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
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <img
          src="/images/open-mic-placeholder.jpg"
          alt="Denver Songwriters Gallery"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] drop-shadow-lg">
              Gallery
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              Moments from open mics, showcases, and community events
            </p>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {images && images.length > 0 ? (
            <GalleryGrid images={images} />
          ) : (
            <div className="text-center py-16">
              <p className="text-neutral-400 text-lg mb-4">
                No photos yet. Be the first to share!
              </p>
              <p className="text-neutral-500 text-sm">
                Photos from community members will appear here after approval.
              </p>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
