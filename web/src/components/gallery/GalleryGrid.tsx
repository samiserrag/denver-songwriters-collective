"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface RawGalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_featured: boolean;
  created_at: string;
  uploader: { full_name: string | null }[] | { full_name: string | null } | null;
  event: { title: string }[] | { title: string } | null;
  venue: { name: string }[] | { name: string } | null;
}

interface NormalizedGalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_featured: boolean;
  created_at: string;
  uploader: { full_name: string | null } | null;
  event: { title: string } | null;
  venue: { name: string } | null;
}

interface Props {
  images: RawGalleryImage[];
}

// Helper to normalize array joins from Supabase
function normalizeRelation<T>(data: T | T[] | null): T | null {
  if (data === null) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export default function GalleryGrid({ images }: Props) {
  // Normalize the Supabase array joins
  const normalizedImages: NormalizedGalleryImage[] = images.map((img) => ({
    ...img,
    uploader: normalizeRelation(img.uploader),
    event: normalizeRelation(img.event),
    venue: normalizeRelation(img.venue),
  }));

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex !== null ? normalizedImages[selectedIndex] : null;

  // Navigate to previous image
  const goToPrevious = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : normalizedImages.length - 1);
  }, [selectedIndex, normalizedImages.length]);

  // Navigate to next image
  const goToNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex(selectedIndex < normalizedImages.length - 1 ? selectedIndex + 1 : 0);
  }, [selectedIndex, normalizedImages.length]);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          goToPrevious();
          break;
        case "ArrowRight":
          e.preventDefault();
          goToNext();
          break;
        case "Escape":
          e.preventDefault();
          closeLightbox();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedIndex, goToPrevious, goToNext, closeLightbox]);

  return (
    <>
      {/* Masonry-style grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {normalizedImages.map((image, index) => (
          <div
            key={image.id}
            className="break-inside-avoid group"
          >
            <button
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] rounded-xl"
              aria-label={`View ${image.caption || "gallery image"}`}
            >
              <div className="relative rounded-xl overflow-hidden border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 transition-colors cursor-pointer">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={image.image_url}
                    alt={image.caption ?? "Gallery image"}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                {image.is_featured && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-xs font-medium">
                    Featured
                  </div>
                )}
                {(image.caption || image.venue || image.event) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {image.caption && (
                      <p className="text-[var(--color-text-primary)] text-sm mb-1">{image.caption}</p>
                    )}
                    {(image.venue || image.event) && (
                      <p className="text-[var(--color-text-tertiary)] text-xs">
                        {image.event?.title ?? image.venue?.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {selectedImage && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)] p-2 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous button */}
          {normalizedImages.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)] p-2 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              aria-label="Previous image"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Next button */}
          {normalizedImages.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-primary)]/60 hover:text-[var(--color-text-primary)] p-2 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              aria-label="Next image"
            >
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Image container */}
          <div
            className="max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-w-4xl" style={{ height: "min(80vh, 800px)" }}>
              <Image
                src={selectedImage.image_url}
                alt={selectedImage.caption ?? "Gallery image"}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-contain rounded-lg"
                priority
              />
            </div>
            <div className="mt-4 text-center">
              {selectedImage.caption && (
                <p className="text-[var(--color-text-primary)] text-lg mb-2">{selectedImage.caption}</p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-4 text-[var(--color-text-tertiary)] text-sm">
                {selectedImage.uploader?.full_name && (
                  <span>Photo by {selectedImage.uploader.full_name}</span>
                )}
                {selectedImage.event?.title && (
                  <span>@ {selectedImage.event.title}</span>
                )}
                {selectedImage.venue?.name && !selectedImage.event && (
                  <span>@ {selectedImage.venue.name}</span>
                )}
              </div>
              {/* Image counter */}
              {normalizedImages.length > 1 && (
                <p className="text-[var(--color-text-tertiary)] text-xs mt-2">
                  {selectedIndex + 1} / {normalizedImages.length}
                </p>
              )}
              {/* Keyboard hint */}
              <p className="text-neutral-600 text-xs mt-2 hidden sm:block">
                Use arrow keys to navigate, Escape to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
