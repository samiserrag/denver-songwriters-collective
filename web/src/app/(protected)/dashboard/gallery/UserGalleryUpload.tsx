"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

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
  event_date: string | null;
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
  albums: initialAlbums,
  venues,
  events,
  userId,
}: UserGalleryUploadProps) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [albumId, setAlbumId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [caption, setCaption] = useState("");

  // Custom venue/event override state
  const [useCustomVenue, setUseCustomVenue] = useState(false);
  const [customVenueName, setCustomVenueName] = useState("");
  const [useCustomEvent, setUseCustomEvent] = useState(false);
  const [customEventName, setCustomEventName] = useState("");
  const [customEventDate, setCustomEventDate] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Album creation state
  const [showAlbumCreate, setShowAlbumCreate] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [lastCreatedAlbum, setLastCreatedAlbum] = useState<{ id: string; name: string; isPublished: boolean } | null>(null);

  /**
   * Generate a URL-safe slug from a name.
   * Same logic used in admin GalleryAdminTabs.tsx (lines 116-120).
   */
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  /**
   * Create a new album for the current user.
   * Reuses slug generation and conflict resolution from admin flow.
   */
  const handleCreateAlbum = async () => {
    const trimmedName = newAlbumName.trim();
    if (!trimmedName) {
      setAlbumError("Album name is required");
      return;
    }

    setIsCreatingAlbum(true);
    setAlbumError(null);

    const supabase = createClient();
    const baseSlug = generateSlug(trimmedName);

    // Check for existing slugs and auto-increment if needed
    // Same logic as admin GalleryAdminTabs.tsx (lines 122-136)
    let finalSlug = baseSlug;
    const { data: existingSlugs } = await supabase
      .from("gallery_albums")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(existingSlugs.map((a: { slug: string }) => a.slug));
      let counter = 1;
      while (slugSet.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    const isPublished = !saveAsDraft;
    const { data, error } = await supabase
      .from("gallery_albums")
      .insert({
        name: trimmedName,
        slug: finalSlug,
        created_by: userId,
        is_published: isPublished, // Published by default, unless "Save as draft" checked
      })
      .select("id, name")
      .single();

    if (error) {
      console.error("Album creation error:", error);
      setAlbumError("Could not create album. Please try again.");
      setIsCreatingAlbum(false);
      return;
    }

    // Add to local state and select it
    setAlbums((prev) => [...prev, { id: data.id, name: data.name }]);
    setAlbumId(data.id);
    setLastCreatedAlbum({ id: data.id, name: data.name, isPublished });
    setNewAlbumName("");
    setSaveAsDraft(false);
    setShowAlbumCreate(false);
    setIsCreatingAlbum(false);
    toast.success(isPublished ? "Album created and published" : "Album created as draft");
    router.refresh();
  };

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
        // Mutual exclusivity: use custom fields XOR FK fields
        const { error: insertError } = await supabase
          .from("gallery_images")
          .insert({
            image_url: publicUrl,
            caption: caption || null,
            album_id: albumId || null,
            // Venue: either venue_id OR custom_venue_name (not both)
            venue_id: useCustomVenue ? null : (venueId || null),
            custom_venue_name: useCustomVenue && customVenueName.trim() ? customVenueName.trim() : null,
            // Event: either event_id OR custom_event_name/date (not both)
            event_id: useCustomEvent ? null : (eventId || null),
            custom_event_name: useCustomEvent && customEventName.trim() ? customEventName.trim() : null,
            custom_event_date: useCustomEvent && customEventDate ? customEventDate : null,
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
          <div className="flex gap-2">
            <select
              value={albumId}
              onChange={(e) => {
                setAlbumId(e.target.value);
                setLastCreatedAlbum(null); // Clear status chip when user changes selection
              }}
              className="flex-1 px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
            >
              <option value="">No album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAlbumCreate(!showAlbumCreate)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New album</span>
            </button>
          </div>
          {/* Status chip for newly created album */}
          {lastCreatedAlbum && albumId === lastCreatedAlbum.id && (
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                lastCreatedAlbum.isPublished
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              }`}>
                {lastCreatedAlbum.isPublished ? "Published" : "Draft — not visible in public gallery"}
              </span>
            </div>
          )}
          {/* Inline album creation */}
          {showAlbumCreate && (
            <div className="mt-2 p-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => {
                  setNewAlbumName(e.target.value);
                  setAlbumError(null);
                }}
                placeholder="Album name"
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] mb-2"
                disabled={isCreatingAlbum}
              />
              {/* Save as draft toggle */}
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveAsDraft}
                  onChange={(e) => setSaveAsDraft(e.target.checked)}
                  disabled={isCreatingAlbum}
                  className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Save as draft
                  <span className="text-[var(--color-text-tertiary)]"> (won&apos;t appear in public gallery)</span>
                </span>
              </label>
              {albumError && (
                <p className="text-sm text-red-500 mb-2">{albumError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateAlbum}
                  disabled={isCreatingAlbum || !newAlbumName.trim()}
                  className="px-3 py-1.5 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] text-sm rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isCreatingAlbum ? "Creating..." : "Create album"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAlbumCreate(false);
                    setNewAlbumName("");
                    setSaveAsDraft(false);
                    setAlbumError(null);
                  }}
                  disabled={isCreatingAlbum}
                  className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Venue (optional)
          </label>
          {!useCustomVenue ? (
            <div className="space-y-2">
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
              <button
                type="button"
                onClick={() => {
                  setUseCustomVenue(true);
                  setVenueId("");
                }}
                className="text-sm text-[var(--color-text-accent)] hover:underline"
              >
                Venue not listed? Enter manually
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={customVenueName}
                onChange={(e) => setCustomVenueName(e.target.value)}
                placeholder="Enter venue name"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <button
                type="button"
                onClick={() => {
                  setUseCustomVenue(false);
                  setCustomVenueName("");
                }}
                className="text-sm text-[var(--color-text-accent)] hover:underline"
              >
                Select from list instead
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Event (optional)
          </label>
          {!useCustomEvent ? (
            <div className="space-y-2">
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
              >
                <option value="">Select event</option>
                {events.map((event) => {
                  // Format: "Event Title — Dec 31, 2025" or "Event Title" if no date
                  const dateLabel = event.event_date
                    ? ` — ${new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/Denver",
                      })}`
                    : "";
                  return (
                    <option key={event.id} value={event.id}>
                      {event.title}{dateLabel}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => {
                  setUseCustomEvent(true);
                  setEventId("");
                }}
                className="text-sm text-[var(--color-text-accent)] hover:underline"
              >
                Event not listed? Enter manually
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={customEventName}
                onChange={(e) => setCustomEventName(e.target.value)}
                placeholder="Enter event name"
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <input
                type="date"
                value={customEventDate}
                onChange={(e) => setCustomEventDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
              />
              <button
                type="button"
                onClick={() => {
                  setUseCustomEvent(false);
                  setCustomEventName("");
                  setCustomEventDate("");
                }}
                className="text-sm text-[var(--color-text-accent)] hover:underline"
              >
                Select from list instead
              </button>
            </div>
          )}
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
