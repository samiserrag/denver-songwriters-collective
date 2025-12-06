"use client";

import { useState } from "react";

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

  const [selectedImage, setSelectedImage] = useState<NormalizedGalleryImage | null>(null);

  return (
    <>
      {/* Masonry-style grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {normalizedImages.map((image) => (
          <div
            key={image.id}
            className="break-inside-avoid group cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <div className="relative rounded-xl overflow-hidden border border-white/10 hover:border-[var(--color-gold)]/30 transition-colors">
              <img
                src={image.image_url}
                alt={image.caption ?? "Gallery image"}
                className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {image.is_featured && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-[var(--color-gold)] text-black text-xs font-medium">
                  Featured
                </div>
              )}
              {(image.caption || image.venue || image.event) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  {image.caption && (
                    <p className="text-white text-sm mb-1">{image.caption}</p>
                  )}
                  {(image.venue || image.event) && (
                    <p className="text-neutral-400 text-xs">
                      {image.event?.title ?? image.venue?.name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/60 hover:text-white p-2"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="max-w-5xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.image_url}
              alt={selectedImage.caption ?? "Gallery image"}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-4 text-center">
              {selectedImage.caption && (
                <p className="text-white text-lg mb-2">{selectedImage.caption}</p>
              )}
              <div className="flex items-center justify-center gap-4 text-neutral-400 text-sm">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
