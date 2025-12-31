"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface Album {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
}

interface UserGalleryUploadProps {
  albums: Album[];
  venues: Venue[];
  events: Event[];
  userId: string;
}

interface UploadingFile {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function UserGalleryUpload({
  albums,
  venues,
  events,
  userId,
}: UserGalleryUploadProps) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/")
    );
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = newFiles.filter(f => {
      if (f.size > maxSize) {
        toast.error(`${f.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));

    setFiles(prev => [...prev, ...newUploadingFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one photo");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];
      if (uploadFile.status !== "pending") continue;

      // Update status to uploading
      setFiles(prev => {
        const newFiles = [...prev];
        newFiles[i] = { ...newFiles[i], status: "uploading" };
        return newFiles;
      });

      try {
        // Upload to storage
        const fileExt = uploadFile.file.name.split(".").pop();
        const fileName = `${userId}/${Date.now()}-${i}.${fileExt}`;

        const { error: storageError } = await supabase.storage
          .from("gallery-images")
          .upload(fileName, uploadFile.file);

        if (storageError) throw storageError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("gallery-images")
          .getPublicUrl(fileName);

        // Insert into database (pending approval)
        const { error: insertError } = await supabase
          .from("gallery_images")
          .insert({
            image_url: publicUrl,
            caption: caption || null,
            album_id: albumId || null,
            venue_id: venueId || null,
            event_id: eventId || null,
            uploaded_by: userId,
            is_approved: false, // Requires admin approval
          });

        if (insertError) throw insertError;

        // Update status to done
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i] = { ...newFiles[i], status: "done" };
          return newFiles;
        });

        successCount++;
      } catch (error) {
        console.error("Upload error:", error);
        setFiles(prev => {
          const newFiles = [...prev];
          newFiles[i] = {
            ...newFiles[i],
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
          };
          return newFiles;
        });
        errorCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded! Pending review.`);
      // Clear successful uploads
      setFiles(prev => prev.filter(f => f.status !== "done"));
      setCaption("");
      router.refresh();
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} upload${errorCount > 1 ? "s" : ""} failed`);
    }
  };

  const pendingCount = files.filter(f => f.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Metadata Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Album (optional)
          </label>
          <select
            value={albumId}
            onChange={(e) => setAlbumId(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
          >
            <option value="">No album</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Venue (optional)
          </label>
          <select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
          >
            <option value="">Select venue</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Event (optional)
          </label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
          >
            <option value="">Select event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Caption */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Caption (optional, applies to all photos)
        </label>
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g., Open mic night at The Venue"
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        />
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-[var(--color-border-default)] rounded-lg p-8 text-center hover:border-[var(--color-border-accent)] transition-colors cursor-pointer"
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-4xl mb-2">📷</div>
        <p className="text-[var(--color-text-primary)] font-medium">
          Drop photos here or click to select
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Max 10MB per photo. JPG, PNG, WebP supported.
        </p>
      </div>

      {/* Preview Grid */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
            Selected Photos ({files.length})
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {files.map((uploadFile, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Uses objectURL from local file; next/image incompatible with blob URLs */}
                <img
                  src={uploadFile.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Status Overlay */}
                {uploadFile.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {uploadFile.status === "done" && (
                  <div className="absolute inset-0 bg-emerald-500/50 flex items-center justify-center">
                    <span className="text-white text-2xl">✓</span>
                  </div>
                )}
                {uploadFile.status === "error" && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <span className="text-white text-2xl">✕</span>
                  </div>
                )}
                {/* Remove Button (only for pending) */}
                {uploadFile.status === "pending" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {pendingCount > 0 && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full px-4 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {isUploading
            ? "Uploading..."
            : `Upload ${pendingCount} Photo${pendingCount > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}
