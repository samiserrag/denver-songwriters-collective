"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  id: string;
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

// Sortable thumbnail component for drag-and-drop reordering
function SortableThumbnail({
  uploadFile,
  index,
  onRemove,
}: {
  uploadFile: UploadingFile;
  index: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uploadFile.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)] group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Uses objectURL from local file; next/image incompatible with blob URLs */}
      <img
        src={uploadFile.preview}
        alt={`Preview ${index + 1}`}
        className="w-full h-full object-cover object-top"
      />

      {/* Drag Handle - only for pending files */}
      {uploadFile.status === "pending" && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 p-1 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>
      )}

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
            onRemove();
          }}
          className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
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

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFiles((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

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
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));

    setFiles(prev => [...prev, ...newUploadingFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one photo");
      return;
    }

    setIsUploading(true);
    const supabase = createClient();

    // Get starting sort_order for the album (if one is selected)
    let startSortOrder = 0;
    if (albumId) {
      const { data: maxSort } = await supabase
        .from("gallery_images")
        .select("sort_order")
        .eq("album_id", albumId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single();
      startSortOrder = (maxSort?.sort_order ?? -1) + 1;
    }

    let successCount = 0;
    let errorCount = 0;
    let sortOrderOffset = 0;

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

        // Insert into database (auto-approved - trust members)
        // sort_order preserves user's drag-and-drop order
        // Mutual exclusivity: use custom fields XOR FK fields
        const { error: insertError } = await supabase
          .from("gallery_images")
          .insert({
            image_url: publicUrl,
            caption: caption || null,
            album_id: albumId || null,
            sort_order: startSortOrder + sortOrderOffset,
            // Venue: either venue_id OR custom_venue_name (not both)
            venue_id: useCustomVenue ? null : (venueId || null),
            custom_venue_name: useCustomVenue && customVenueName.trim() ? customVenueName.trim() : null,
            // Event: either event_id OR custom_event_name/date (not both)
            event_id: useCustomEvent ? null : (eventId || null),
            custom_event_name: useCustomEvent && customEventName.trim() ? customEventName.trim() : null,
            custom_event_date: useCustomEvent && customEventDate ? customEventDate : null,
            uploaded_by: userId,
            is_approved: true, // Trust members - auto-approve all uploads (admins can hide if needed)
          });

        if (insertError) throw insertError;

        sortOrderOffset++;

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
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded successfully!`);
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
            onChange={(e) => {
              setAlbumId(e.target.value);
              setLastCreatedAlbum(null); // Clear status chip when user changes selection
            }}
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
          >
            <option value="">No album</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>
          {/* New album link - below dropdown */}
          <button
            type="button"
            onClick={() => setShowAlbumCreate(!showAlbumCreate)}
            className="mt-2 inline-flex items-center gap-1 text-sm text-[var(--color-text-accent)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New album</span>
          </button>
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

      {/* Preview Grid with Drag-and-Drop Reordering */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">
              Selected Photos ({files.length})
            </h3>
            {pendingCount > 1 && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Drag to reorder before uploading
              </p>
            )}
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={files.map((f) => f.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {files.map((uploadFile, index) => (
                  <SortableThumbnail
                    key={uploadFile.id}
                    uploadFile={uploadFile}
                    index={index}
                    onRemove={() => removeFile(uploadFile.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
