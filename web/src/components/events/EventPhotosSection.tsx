"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import { Trash2, Check, Loader2, X, ZoomIn } from "lucide-react";
import Image from "next/image";

type EventImage = {
  id: string;
  event_id: string;
  image_url: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

type EventPhotosSectionProps = {
  eventId: string;
  eventTitle: string;
  currentCoverUrl: string | null;
  initialImages: EventImage[];
  userId: string;
};

export function EventPhotosSection({
  eventId,
  eventTitle,
  currentCoverUrl,
  initialImages,
  userId,
}: EventPhotosSectionProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [images, setImages] = useState<EventImage[]>(initialImages);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null>(currentCoverUrl);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler for ImageUpload component
  const handleUpload = useCallback(
    async (file: File): Promise<string | null> => {
      // Check if this will be the first image (before upload)
      const activeCount = images.filter((img) => !img.deleted_at).length;
      const isFirstImage = !localCoverUrl && activeCount === 0;

      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${eventId}/${crypto.randomUUID()}.${fileExt}`;

        // Upload to storage - using event-images bucket with event_id folder structure
        const { error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(fileName, file, { upsert: false });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error("Failed to upload image");
          return null;
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("event-images").getPublicUrl(fileName);

        // Insert record into event_images table
        const { data: imageRecord, error: insertError } = await supabase
          .from("event_images")
          .insert({
            event_id: eventId,
            image_url: publicUrl,
            storage_path: fileName,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Insert error:", insertError);
          // Try to clean up the uploaded file
          await supabase.storage.from("event-images").remove([fileName]);
          toast.error("Failed to save image record");
          return null;
        }

        // Update local state
        setImages((prev) => [imageRecord as EventImage, ...prev]);

        // Auto-set as cover if this is the first image
        if (isFirstImage) {
          const { error: coverError } = await supabase
            .from("events")
            .update({ cover_image_url: publicUrl })
            .eq("id", eventId);

          if (!coverError) {
            setLocalCoverUrl(publicUrl);
            router.refresh();
            toast.success("Image uploaded and set as cover!");
          } else {
            toast.success("Image uploaded!");
          }
        } else {
          toast.success("Image uploaded!");
        }

        return publicUrl;
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("Failed to upload image");
        return null;
      }
    },
    [supabase, eventId, userId, images, localCoverUrl, router]
  );

  // Delete (soft-delete) an image
  const handleDelete = useCallback(
    async (image: EventImage) => {
      setDeletingId(image.id);
      try {
        // Soft-delete by setting deleted_at
        const { error } = await supabase
          .from("event_images")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", image.id);

        if (error) {
          console.error("Delete error:", error);
          toast.error("Failed to delete image");
          return;
        }

        // Update local state
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, deleted_at: new Date().toISOString() }
              : img
          )
        );
        toast.success("Image deleted");

        // If this was the cover image, clear it
        if (localCoverUrl === image.image_url) {
          setLocalCoverUrl(null);
          await supabase
            .from("events")
            .update({ cover_image_url: null })
            .eq("id", eventId);
          router.refresh();
        }
      } catch (err) {
        console.error("Delete error:", err);
        toast.error("Failed to delete image");
      } finally {
        setDeletingId(null);
      }
    },
    [supabase, eventId, localCoverUrl, router]
  );

  // Set image as cover
  const handleSetAsCover = useCallback(
    async (image: EventImage) => {
      setSettingCoverId(image.id);
      try {
        const { error } = await supabase
          .from("events")
          .update({ cover_image_url: image.image_url })
          .eq("id", eventId);

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
    [supabase, eventId, router]
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
    <section id="event-photos-section">
      <h2 className="text-xl text-[var(--color-text-primary)] mb-2">
        Happening Photos
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Add photos for {eventTitle}. Click on an image to set it as the cover photo.
      </p>

      {/* Upload Area */}
      <div className="mb-6">
        <div className="max-w-xs">
          <ImageUpload
            currentImageUrl={null}
            onUpload={handleUpload}
            onRemove={async () => {}}
            aspectRatio={4 / 3}
            shape="square"
            placeholderText="Add Photo"
            maxSizeMB={5}
          />
        </div>
      </div>

      {/* Image Grid */}
      {activeImages.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {activeImages.map((image) => (
            <div
              key={image.id}
              className={`relative group aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all ${
                isCurrentCover(image.image_url)
                  ? "border-emerald-500 ring-2 ring-emerald-500/30"
                  : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
              }`}
            >
              <Image
                src={image.image_url}
                alt={`${eventTitle} photo`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              />

              {/* Current Cover Badge */}
              {isCurrentCover(image.image_url) && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Cover
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {/* View Full Size */}
                <button
                  type="button"
                  onClick={() => setLightboxImage(image.image_url)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  title="View full size"
                >
                  <ZoomIn className="w-5 h-5 text-white" />
                </button>

                {/* Set as Cover */}
                {!isCurrentCover(image.image_url) && (
                  <button
                    type="button"
                    onClick={() => handleSetAsCover(image)}
                    disabled={settingCoverId === image.id}
                    className="p-2 bg-emerald-500/80 hover:bg-emerald-500 rounded-full transition-colors disabled:opacity-50"
                    title="Set as cover photo"
                  >
                    {settingCoverId === image.id ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Check className="w-5 h-5 text-white" />
                    )}
                  </button>
                )}

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDelete(image)}
                  disabled={deletingId === image.id}
                  className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors disabled:opacity-50"
                  title="Delete image"
                >
                  {deletingId === image.id ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Trash2 className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 border-2 border-dashed border-[var(--color-border-default)] rounded-lg">
          <p className="text-[var(--color-text-secondary)]">
            No photos yet. Upload some photos to showcase this happening.
          </p>
        </div>
      )}

      {/* Hidden file input for additional uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            await handleUpload(file);
            e.target.value = "";
          }
        }}
      />

      {/* Lightbox Modal */}
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
          <div className="max-w-4xl max-h-[90vh] relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- Lightbox displays user-uploaded image */}
            <img
              src={lightboxImage}
              alt={`${eventTitle} full size`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </section>
  );
}
