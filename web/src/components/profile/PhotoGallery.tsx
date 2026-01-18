"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

type PhotoGalleryProps = {
  images: Array<{ id: string; image_url: string }>;
};

export function PhotoGallery({ images }: PhotoGalleryProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setLightboxImage(image.image_url)}
            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] transition-colors cursor-pointer group"
          >
            <Image
              src={image.image_url}
              alt="Profile photo"
              fill
              className="object-cover object-top group-hover:scale-105 transition-transform duration-200"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            />
          </button>
        ))}
      </div>

      {/* Lightbox modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox needs unconstrained sizing */}
            <img
              src={lightboxImage}
              alt="Full size photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
