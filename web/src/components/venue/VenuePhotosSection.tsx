"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import { Trash2, Check, Loader2, X, ZoomIn } from "lucide-react";
import Image from "next/image";

type VenueImage = {
  id: string;
  venue_id: string;
  image_url: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

type VenuePhotosSectionProps = {
  venueId: string;
  venueName: string;
  currentCoverUrl: string | null;
  initialImages: VenueImage[];
  userId: string;
};

export function VenuePhotosSection({
  venueId,
  venueName,
  currentCoverUrl,
  initialImages,
  userId,
}: VenuePhotosSectionProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [images, setImages] = useState<VenueImage[]>(initialImages);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(currentCoverUrl);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler for ImageUpload component
  const handleUpload = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileId = crypto.randomUUID();
        // Storage path for venue images
        const storagePath = `venues/${venueId}/${fileId}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(storagePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Failed to upload image");
          return null;
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(storagePath);

        // Add cache buster for immediate display
        const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

        // Insert record into venue_images
        const { data: newImage, error: insertError } = await supabase
          .from("venue_images")
          .insert({
            venue_id: venueId,
            image_url: urlWithTimestamp,
            storage_path: storagePath,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          // Try to clean up the uploaded file
          await supabase.storage.from("avatars").remove([storagePath]);
          toast.error("Failed to save image record");
          return null;
        }

        // Add to local state
        setImages((prev) => [newImage, ...prev]);
        toast.success("Photo uploaded!");
        return urlWithTimestamp;
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Failed to upload image");
        return null;
      }
    },
    [supabase, venueId, userId]
  );

  // Delete (soft-delete) an image
  const handleDelete = useCallback(
    async (imageId: string, storagePath: string) => {
      setDeletingId(imageId);

      try {
        // Soft delete the record
        const { error: updateError } = await supabase
          .from("venue_images")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", imageId);

        if (updateError) {
          console.error("Delete error:", updateError);
          toast.error("Failed to delete image");
          return;
        }

        // Also remove from storage
        await supabase.storage.from("avatars").remove([storagePath]);

        // Remove from local state
        setImages((prev) => prev.filter((img) => img.id !== imageId));
        toast.success("Photo deleted");
      } catch (err) {
        console.error("Delete error:", err);
        toast.error("Failed to delete image");
      } finally {
        setDeletingId(null);
      }
    },
    [supabase]
  );

  // Set an image as the venue cover
  const handleSetAsCover = useCallback(
    async (image: VenueImage) => {
      setSettingCoverId(image.id);

      try {
        const { error } = await supabase
          .from("venues")
          .update({ cover_image_url: image.image_url })
          .eq("id", venueId);

        if (error) {
          console.error("Cover update error:", error);
          toast.error("Failed to set cover photo");
          return;
        }

        setLocalCoverUrl(image.image_url);
        router.refresh();
        toast.success("Cover photo updated!");
      } catch (err) {
        console.error("Cover update error:", err);
        toast.error("Failed to set cover photo");
      } finally {
        setSettingCoverId(null);
      }
    },
    [supabase, venueId, router]
  );

  // Check if an image is the current cover
  const isCurrentCover = useCallback(
    (imageUrl: string) => {
      if (!localCoverUrl) return false;
      // Compare without cache busters
      const normalizedCurrent = localCoverUrl.split("?")[0];
      const normalizedImage = imageUrl.split("?")[0];
      return normalizedCurrent === normalizedImage;
    },
    [localCoverUrl]
  );

  // Filter out soft-deleted images
  const activeImages = images.filter((img) => !img.deleted_at);

  return (
    <section id="venue-photos-section">
      <h2 className="text-xl text-[var(--color-text-primary)] mb-2">
        Venue Photos
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Upload photos of {venueName}. Hover over a photo to set it as the cover.
      </p>

      {/* Upload new photo */}
      <div className="mb-6">
        <div className="w-32 h-32">
          <ImageUpload
            onUpload={handleUpload}
            aspectRatio={16 / 9}
            maxSizeMB={10}
            shape="square"
            placeholderText="Add Photo"
            className="w-full h-full"
          />
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          Click or drag to upload. JPG, PNG, WebP, or GIF. Max 10 MB.
        </p>
      </div>

      {/* Photo grid */}
      {activeImages.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {activeImages.map((image) => {
            const isCover = isCurrentCover(image.image_url);
            const isDeleting = deletingId === image.id;
            const isSettingCover = settingCoverId === image.id;

            return (
              <div
                key={image.id}
                className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all group ${
                  isCover
                    ? "border-[var(--color-border-accent)] ring-2 ring-[var(--color-accent-primary)]/30"
                    : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/50"
                }`}
              >
                <Image
                  src={image.image_url}
                  alt={`Photo of ${venueName}`}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                />

                {/* Current cover badge */}
                {isCover && (
                  <div className="absolute top-1 left-1 px-2 py-0.5 bg-[var(--color-accent-primary)] text-[var(--color-background)] text-xs font-medium rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Cover
                  </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {/* View full size button */}
                  <button
                    type="button"
                    onClick={() => setLightboxImage(image.image_url)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    title="View full size"
                  >
                    <ZoomIn className="w-4 h-4 text-white" />
                  </button>

                  {/* Set as cover button */}
                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => handleSetAsCover(image)}
                      disabled={isSettingCover || isDeleting}
                      className="p-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-full transition-colors disabled:opacity-50"
                      title="Set as cover photo"
                    >
                      {isSettingCover ? (
                        <Loader2 className="w-4 h-4 text-[var(--color-background)] animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-[var(--color-background)]" />
                      )}
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(image.id, image.storage_path)}
                    disabled={isDeleting || isSettingCover}
                    className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors disabled:opacity-50"
                    title="Delete photo"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
          <div className="text-4xl mb-3">📷</div>
          <p className="text-[var(--color-text-secondary)]">
            No photos yet. Upload your first photo above.
          </p>
        </div>
      )}

      {/* Hidden file input for additional uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
      />

      {/* Lightbox modal for full-size viewing */}
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
            {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox needs unconstrained sizing; next/image requires fixed dimensions */}
            <img
              src={lightboxImage}
              alt="Full size photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </section>
  );
}
