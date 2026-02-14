"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { reconcileAlbumLinks } from "@/lib/gallery/albumLinks";
import { toast } from "sonner";
import { Star, Check, X, MessageSquare, GripVertical, Trash2 } from "lucide-react";
import { MediaEmbedsEditor } from "@/components/media";
import CollaboratorSelect, { type Collaborator } from "@/components/gallery/CollaboratorSelect";
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
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  is_published: boolean;
  is_hidden: boolean;
  created_by: string;
  created_at: string;
}

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_published: boolean;
  is_hidden: boolean;
  sort_order: number | null;
  created_at: string;
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

interface AlbumManagerProps {
  album: Album;
  images: GalleryImage[];
  isAdmin: boolean;
  mediaEmbedUrls?: string[];
  venues?: Venue[];
  events?: Event[];
  initialVenueId?: string | null;
  initialEventId?: string | null;
  initialCollaborators?: Collaborator[];
}

// Sortable photo card for drag-and-drop reordering
function SortablePhotoCard({
  image,
  isCover,
  onSetCover,
}: {
  image: GalleryImage;
  isCover: boolean;
  onSetCover: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

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
      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${
        isCover
          ? "border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/30"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
      }`}
    >
      <Image
        src={image.image_url}
        alt={image.caption || "Album photo"}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
        className="object-cover object-top"
      />

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>

      {/* Cover Badge */}
      {isCover && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-xs rounded-full flex items-center gap-1">
            <Star className="w-3 h-3 fill-current" />
            Cover
          </span>
        </div>
      )}

      {/* Hidden indicator */}
      {image.is_hidden && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-red-500/90 text-white text-xs rounded-full">
            Hidden
          </span>
        </div>
      )}

      {/* Set as Cover Button */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        {isCover ? (
          <div className="text-center text-white text-xs font-medium">
            Current Cover
          </div>
        ) : (
          <button
            onClick={onSetCover}
            className="w-full px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
          >
            <Star className="w-3 h-3" />
            Set as cover
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlbumManager({
  album,
  images: initialImages,
  isAdmin,
  mediaEmbedUrls: initialMediaEmbedUrls = [],
  venues = [],
  events = [],
  initialVenueId = null,
  initialEventId = null,
  initialCollaborators = [],
}: AlbumManagerProps) {
  const router = useRouter();
  const [albumName, setAlbumName] = useState(album.name);
  const [albumDescription, setAlbumDescription] = useState(album.description || "");
  const [albumYoutubeUrl, setAlbumYoutubeUrl] = useState(album.youtube_url || "");
  const [albumSpotifyUrl, setAlbumSpotifyUrl] = useState(album.spotify_url || "");
  const [mediaEmbedUrls, setMediaEmbedUrls] = useState<string[]>(initialMediaEmbedUrls);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(album.cover_image_url);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isModeratingComments, setIsModeratingComments] = useState(false);
  const [images, setImages] = useState(initialImages);
  const [isReordering, setIsReordering] = useState(false);

  // Album linkage state (venue, event, collaborators)
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId || "");
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || "");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialCollaborators);

  // Track unsaved changes
  const hasUnsavedChanges =
    albumName !== album.name ||
    albumDescription !== (album.description || "") ||
    selectedVenueId !== (initialVenueId || "") ||
    selectedEventId !== (initialEventId || "") ||
    JSON.stringify(collaborators.map((c) => c.id).sort()) !==
      JSON.stringify(initialCollaborators.map((c) => c.id).sort()) ||
    (isAdmin && (
      albumYoutubeUrl !== (album.youtube_url || "") ||
      albumSpotifyUrl !== (album.spotify_url || "") ||
      JSON.stringify(mediaEmbedUrls) !== JSON.stringify(initialMediaEmbedUrls)
    ));

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      const newOrder = arrayMove(images, oldIndex, newIndex);
      setImages(newOrder);

      // Persist new sort_order to database
      setIsReordering(true);
      const supabase = createClient();

      const updates = newOrder.map((img, index) => ({
        id: img.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("gallery_images")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }

      setIsReordering(false);
      setStatusMessage("Photo order saved.");
      setTimeout(() => setStatusMessage(null), 2000);
    },
    [images]
  );

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  // Save album details
  const handleSaveDetails = async () => {
    if (!albumName.trim()) {
      toast.error("Album name is required");
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    const supabase = createClient();

    // Generate new slug from name
    const baseSlug = generateSlug(albumName);
    let finalSlug = baseSlug;

    // Check for existing slugs (excluding current album)
    const { data: existingSlugs } = await supabase
      .from("gallery_albums")
      .select("slug")
      .like("slug", `${baseSlug}%`)
      .neq("id", album.id);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(existingSlugs.map((a: { slug: string }) => a.slug));
      let counter = 1;
      while (slugSet.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    let error: { message: string } | null = null;

    // Include venue_id and event_id in album updates
    const venueIdValue = selectedVenueId || null;
    const eventIdValue = selectedEventId || null;

    if (isAdmin) {
      const response = await fetch(`/api/admin/gallery-albums/${album.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: albumName.trim(),
          slug: finalSlug,
          description: albumDescription.trim() || null,
          youtube_url: albumYoutubeUrl,
          spotify_url: albumSpotifyUrl,
          media_embed_urls: mediaEmbedUrls,
          venue_id: venueIdValue,
          event_id: eventIdValue,
          collaborator_ids: collaborators.map((c) => c.id),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFieldErrors(payload?.fieldErrors || {});
        error = { message: payload?.error || "Failed to update album" };
      }
    } else {
      const result = await supabase
        .from("gallery_albums")
        .update({
          name: albumName.trim(),
          slug: finalSlug,
          description: albumDescription.trim() || null,
          venue_id: venueIdValue,
          event_id: eventIdValue,
        })
        .eq("id", album.id);
      error = result.error ? { message: result.error.message } : null;
    }

    if (error) {
      setIsSaving(false);
      toast.error("Failed to update album");
      console.error(error);
      return;
    }

    // Reconcile album links (creator + collaborators + venue + event)
    try {
      await reconcileAlbumLinks(supabase, album.id, {
        createdBy: album.created_by,
        venueId: venueIdValue,
        eventId: eventIdValue,
        collaboratorIds: collaborators.map((c) => c.id),
      });
    } catch (linkError) {
      console.error("Album link reconciliation error:", linkError);
      toast.error("Album saved but cross-page links failed. Try saving again.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    toast.success("Album updated");
    router.refresh();
  };

  // Cancel edits — reset all form state to initial values
  const handleCancelEdits = () => {
    setAlbumName(album.name);
    setAlbumDescription(album.description || "");
    setAlbumYoutubeUrl(album.youtube_url || "");
    setAlbumSpotifyUrl(album.spotify_url || "");
    setMediaEmbedUrls(initialMediaEmbedUrls);
    setSelectedVenueId(initialVenueId || "");
    setSelectedEventId(initialEventId || "");
    setCollaborators(initialCollaborators);
    setFieldErrors({});
  };

  // Toggle publish state with inline feedback (no toasts)
  const handleTogglePublish = async () => {
    const supabase = createClient();
    const newState = !album.is_published;

    const { error } = await supabase
      .from("gallery_albums")
      .update({ is_published: newState })
      .eq("id", album.id);

    if (error) {
      setStatusMessage("Failed to update album.");
      setTimeout(() => setStatusMessage(null), 3000);
    } else {
      setStatusMessage(newState ? "Album published." : "Album hidden from public view.");
      setTimeout(() => setStatusMessage(null), 3000);
      router.refresh();
    }
  };

  // Delete album (UI guard + confirm + DB delete)
  const handleDeleteAlbum = async () => {
    if (images.length > 0) {
      toast.error(
        `Cannot delete album: it still has ${images.length} photo${images.length > 1 ? "s" : ""}. Remove or move all photos first.`
      );
      return;
    }

    if (!window.confirm("Permanently delete this album? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("gallery_albums")
      .delete()
      .eq("id", album.id);

    if (error) {
      setIsDeleting(false);
      // Handle FK restrict or other DB errors
      if (error.message?.includes("violates foreign key") || error.code === "23503") {
        toast.error("Album has photos — remove or move them first.");
      } else {
        toast.error("Failed to delete album.");
      }
      console.error(error);
      return;
    }

    toast.success("Album deleted.");
    router.push("/dashboard/gallery");
  };

  // Set cover image
  const handleSetCover = useCallback(async (imageUrl: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("gallery_albums")
      .update({ cover_image_url: imageUrl })
      .eq("id", album.id);

    if (error) {
      toast.error("Failed to set cover image");
      console.error(error);
    } else {
      setCurrentCoverUrl(imageUrl);
      toast.success("Cover image updated");
      router.refresh();
    }
  }, [album.id, router]);

  // Bulk hide all comments on this album (album comments + photo comments)
  const handleBulkHideComments = async () => {
    setIsModeratingComments(true);
    const supabase = createClient();

    // Hide album-level comments
    const { error: albumError } = await supabase
      .from("gallery_album_comments")
      .update({ is_deleted: true })
      .eq("album_id", album.id)
      .eq("is_deleted", false);

    // Hide photo comments for all images in this album
    const imageIds = images.map((img) => img.id);
    let photoError = null;
    if (imageIds.length > 0) {
      const { error } = await supabase
        .from("gallery_photo_comments")
        .update({ is_deleted: true })
        .in("image_id", imageIds)
        .eq("is_deleted", false);
      photoError = error;
    }

    setIsModeratingComments(false);

    if (albumError || photoError) {
      setStatusMessage("Failed to hide some comments.");
    } else {
      setStatusMessage("All comments hidden.");
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Bulk unhide all comments on this album
  const handleBulkUnhideComments = async () => {
    setIsModeratingComments(true);
    const supabase = createClient();

    // Unhide album-level comments
    const { error: albumError } = await supabase
      .from("gallery_album_comments")
      .update({ is_deleted: false })
      .eq("album_id", album.id)
      .eq("is_deleted", true);

    // Unhide photo comments for all images in this album
    const imageIds = images.map((img) => img.id);
    let photoError = null;
    if (imageIds.length > 0) {
      const { error } = await supabase
        .from("gallery_photo_comments")
        .update({ is_deleted: false })
        .in("image_id", imageIds)
        .eq("is_deleted", true);
      photoError = error;
    }

    setIsModeratingComments(false);

    if (albumError || photoError) {
      setStatusMessage("Failed to unhide some comments.");
    } else {
      setStatusMessage("All comments restored.");
    }
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Get first visible image for fallback
  const firstVisibleImage = images.find((img) => img.is_published && !img.is_hidden);
  const displayCoverUrl = currentCoverUrl || firstVisibleImage?.image_url;

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Album Title (read-only heading) */}
      <div>
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          {album.name}
        </h2>
        <p className="text-sm text-[var(--color-text-tertiary)]">/{album.slug}</p>
        {album.description && (
          <p className="text-[var(--color-text-secondary)] mt-1">{album.description}</p>
        )}
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {images.length} {images.length === 1 ? "photo" : "photos"}
        </span>

        {album.is_hidden && !isAdmin && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full" title="Contact us if you think this is a mistake">
            Hidden by admin
          </span>
        )}
        {album.is_hidden && isAdmin && (
          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs rounded-full">
            Hidden
          </span>
        )}

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
            album.is_published
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
          }`}
        >
          {album.is_published ? "Published" : "Draft"}
        </span>

        {/* Explicit publish/unpublish button */}
        <button
          onClick={handleTogglePublish}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            album.is_published
              ? "bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]"
              : "bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
          }`}
        >
          {album.is_published ? "Unpublish" : "Publish"}
        </button>

        {/* Delete album button */}
        <button
          onClick={handleDeleteAlbum}
          disabled={isDeleting}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            {isDeleting ? "Deleting..." : "Delete Album"}
          </span>
        </button>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <span className="text-sm text-amber-600 dark:text-amber-400 italic">
            Unsaved changes
          </span>
        )}

        {/* Inline status feedback */}
        {statusMessage && (
          <span className="text-sm text-[var(--color-text-secondary)] italic">
            {statusMessage}
          </span>
        )}
      </div>

      {/* Album Details Form (always visible, full width) */}
      <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg w-full">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Album Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Album Name
            </label>
            <input
              type="text"
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Description <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
            </label>
            <textarea
              value={albumDescription}
              onChange={(e) => setAlbumDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)] resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Venue Selector */}
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Venue <span className="font-normal text-[var(--color-text-tertiary)]">(optional — appears on venue page)</span>
              </label>
              <select
                value={selectedVenueId}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm"
              >
                <option value="">No venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            {/* Event Selector */}
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Event <span className="font-normal text-[var(--color-text-tertiary)]">(optional — appears on event page)</span>
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm"
              >
                <option value="">No event</option>
                {events.map((ev) => {
                  const dateLabel = ev.event_date
                    ? ` — ${new Date(ev.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "America/Denver",
                      })}`
                    : "";
                  return (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}{dateLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          {/* Collaborators */}
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Collaborators <span className="font-normal text-[var(--color-text-tertiary)]">(optional — album appears on their profiles)</span>
            </label>
            <CollaboratorSelect
              value={collaborators}
              onChange={setCollaborators}
              ownerId={album.created_by}
              disabled={isSaving}
            />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Media Links <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
              </label>
              <MediaEmbedsEditor value={mediaEmbedUrls} onChange={setMediaEmbedUrls} />
            </div>
          )}
          {/* Save / Cancel */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveDetails}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save"}
            </button>
            {hasUnsavedChanges && (
              <button
                onClick={handleCancelEdits}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Album Cover Preview */}
      <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg w-full">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Album Cover
        </h3>
        <div className="relative w-full max-w-xs aspect-[3/2] rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)]">
          {displayCoverUrl ? (
            <Image
              src={displayCoverUrl}
              alt={album.name}
              fill
              sizes="320px"
              className="object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-tertiary)]">
              <span className="text-4xl">📷</span>
            </div>
          )}
        </div>
        {!currentCoverUrl && firstVisibleImage && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
            Using first photo as cover. Set a specific cover from the photos below.
          </p>
        )}
        {!displayCoverUrl && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
            No cover image. Upload photos and set one as the cover.
          </p>
        )}
      </div>

      {/* Images Grid - Drag to Reorder, Set as Cover */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Album Photos
          </h3>
          {isReordering && (
            <span className="text-sm text-[var(--color-text-accent)] animate-pulse">
              Saving order...
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Drag photos to reorder. Click &quot;Set as cover&quot; to choose the album cover.
        </p>

        {images.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map((img) => img.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image) => (
                  <SortablePhotoCard
                    key={image.id}
                    image={image}
                    isCover={currentCoverUrl === image.image_url}
                    onSetCover={() => handleSetCover(image.image_url)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <div className="text-4xl mb-4">📷</div>
            <p className="text-[var(--color-text-primary)] font-medium">Add photos to finish this album.</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
              Go to your gallery dashboard and select this album when uploading.
            </p>
          </div>
        )}
      </div>

      {/* Comment Moderation Section */}
      <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-[var(--color-text-secondary)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Comment Moderation
          </h3>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Bulk actions for all comments on this album and its photos.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBulkHideComments}
            disabled={isModeratingComments}
            className="px-4 py-2 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isModeratingComments ? "Working..." : "Hide all comments"}
          </button>
          <button
            onClick={handleBulkUnhideComments}
            disabled={isModeratingComments}
            className="px-4 py-2 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isModeratingComments ? "Working..." : "Unhide all comments"}
          </button>
        </div>
      </div>

      {/* Owner context for hidden albums (non-admin) */}
      {album.is_hidden && !isAdmin && (
        <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This album has been hidden by an admin and is not visible in the public gallery.
            Contact us if you think this is a mistake.
          </p>
        </div>
      )}

      {/* Admin Info */}
      {isAdmin && (
        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Admin view:</strong> You are viewing this album as an admin.
            {album.is_hidden && " This album is currently hidden from the public gallery."}
          </p>
        </div>
      )}
    </div>
  );
}
