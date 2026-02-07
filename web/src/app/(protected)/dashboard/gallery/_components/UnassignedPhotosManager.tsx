"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Check, EyeOff } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  is_hidden: boolean;
}

interface Album {
  id: string;
  name: string;
}

interface UnassignedPhotosManagerProps {
  photos: Photo[];
  albums: Album[];
}

export function UnassignedPhotosManager({
  photos,
  albums,
}: UnassignedPhotosManagerProps) {
  const router = useRouter();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [assignToAlbumId, setAssignToAlbumId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle photo selection
  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  // Assign selected photos to an album
  const assignPhotosToAlbum = useCallback(async () => {
    if (!assignToAlbumId || selectedPhotos.size === 0) return;

    setIsAssigning(true);
    const supabase = createClient();
    const photoIds = Array.from(selectedPhotos);

    // Get current max sort_order for the target album
    const { data: maxSort } = await supabase
      .from("gallery_images")
      .select("sort_order")
      .eq("album_id", assignToAlbumId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    let nextSortOrder = (maxSort?.sort_order ?? -1) + 1;

    // Update each photo
    for (const photoId of photoIds) {
      const { error } = await supabase
        .from("gallery_images")
        .update({
          album_id: assignToAlbumId,
          sort_order: nextSortOrder++,
        })
        .eq("id", photoId);

      if (error) {
        console.error("Failed to move photo:", error);
      }
    }

    toast.success(`${photoIds.length} photo(s) moved to album`);
    setSelectedPhotos(new Set());
    setAssignToAlbumId("");
    setIsAssigning(false);
    router.refresh();
  }, [assignToAlbumId, selectedPhotos, router]);

  // Hide selected photos (soft-archive via is_hidden)
  const hideSelectedPhotos = useCallback(async () => {
    if (selectedPhotos.size === 0) return;

    const count = selectedPhotos.size;
    const confirmed = window.confirm(
      `Hide ${count} photo${count > 1 ? "s" : ""}? An admin can restore them if needed.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const supabase = createClient();
    const photoIds = Array.from(selectedPhotos);

    let hiddenCount = 0;
    for (const photoId of photoIds) {
      const { error } = await supabase
        .from("gallery_images")
        .update({ is_hidden: true })
        .eq("id", photoId);

      if (error) {
        console.error("Failed to hide photo:", error);
      } else {
        hiddenCount++;
      }
    }

    if (hiddenCount > 0) {
      toast.success(`${hiddenCount} photo(s) hidden`);
    }
    if (hiddenCount < photoIds.length) {
      toast.error(`Failed to hide ${photoIds.length - hiddenCount} photo(s)`);
    }

    setSelectedPhotos(new Set());
    setIsDeleting(false);
    router.refresh();
  }, [selectedPhotos, router]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedPhotos(new Set());
    setAssignToAlbumId("");
  }, []);

  if (photos.length === 0) {
    return null;
  }

  const isProcessing = isAssigning || isDeleting;

  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Unassigned Photos ({photos.length})
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Select photos to move them to an album or hide them.
          </p>
        </div>

        {/* Action controls - show when photos selected */}
        {selectedPhotos.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[var(--color-text-accent)] font-medium">
              {selectedPhotos.size} selected
            </span>

            {/* Album assignment */}
            <select
              value={assignToAlbumId}
              onChange={(e) => setAssignToAlbumId(e.target.value)}
              disabled={isProcessing}
              className="px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)]"
            >
              <option value="">Move to album...</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <button
              onClick={assignPhotosToAlbum}
              disabled={!assignToAlbumId || isProcessing}
              className="px-3 py-1.5 text-sm bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg disabled:opacity-50 transition-colors"
            >
              {isAssigning ? "Moving..." : "Move"}
            </button>

            {/* Hide */}
            <button
              onClick={hideSelectedPhotos}
              disabled={isProcessing}
              className="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <EyeOff className="w-3.5 h-3.5" />
              {isDeleting ? "Hiding..." : "Hide"}
            </button>

            {/* Clear */}
            <button
              onClick={clearSelection}
              disabled={isProcessing}
              className="px-3 py-1.5 text-sm border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {photos.map((photo) => {
          const isSelected = selectedPhotos.has(photo.id);
          return (
            <button
              key={photo.id}
              type="button"
              onClick={() => togglePhotoSelection(photo.id)}
              disabled={isProcessing}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/30"
                  : photo.is_hidden
                    ? "border-red-300 opacity-60 hover:border-red-400"
                    : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <Image
                src={photo.image_url}
                alt={photo.caption || "Gallery photo"}
                fill
                sizes="100px"
                className="object-cover object-top"
              />

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--color-accent-primary)] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-[var(--color-text-on-accent)]" />
                </div>
              )}

              {/* Hidden badge */}
              {photo.is_hidden && !isSelected && (
                <div className="absolute top-1 right-1">
                  <span className="px-1.5 py-0.5 bg-red-500/90 text-white text-[10px] rounded-full">
                    Hidden
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
