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
      <HeroSection minHeight="md">
        <PageContainer>
          <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-4">
            Gallery
          </h1>
          <p className="text-neutral-300 text-lg max-w-2xl">
            Moments captured from open mics, showcases, and community events across Denver.
          </p>
        </PageContainer>
      </HeroSection>

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
