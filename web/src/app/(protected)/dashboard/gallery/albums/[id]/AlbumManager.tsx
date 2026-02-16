"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { reconcileAlbumLinks } from "@/lib/gallery/albumLinks";
import { toast } from "sonner";
import { Star, Check, X, MessageSquare, GripVertical, Trash2, Upload } from "lucide-react";
import { MediaEmbedsEditor } from "@/components/media";
import { CropModal } from "@/components/gallery/CropModal";
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
  uploaded_by?: string;
}

/** A photo that has been cropped/selected but not yet saved to the database */
interface StagedPhoto {
  id: string; // client-side ID for DnD
  file: File;
  previewUrl: string; // object URL for preview
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
  isCollaborator?: boolean;
  currentUserId: string;
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
  readOnly,
}: {
  image: GalleryImage;
  isCover: boolean;
  onSetCover: () => void;
  /** When true, hides drag handle and set-as-cover button (collaborator viewing non-owned photo) */
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id, disabled: readOnly });

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

      {/* Drag handle — hidden for read-only collaborator photos */}
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1.5 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-white" />
        </div>
      )}

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

      {/* Set as Cover Button — hidden for read-only collaborator photos */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        {isCover ? (
          <div className="text-center text-white text-xs font-medium">
            Current Cover
          </div>
        ) : readOnly ? (
          <div className="text-center text-white/60 text-xs">View only</div>
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

// Sortable card for staged (not yet saved) photos
function SortableStagedCard({
  staged,
  onRemove,
}: {
  staged: StagedPhoto;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: staged.id });

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
      className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-amber-400 dark:border-amber-500 group"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={staged.previewUrl}
        alt="Staged photo"
        className="w-full h-full object-cover object-top"
      />

      {/* "Unsaved" badge */}
      <div className="absolute top-2 right-2">
        <span className="px-2 py-1 bg-amber-500/90 text-white text-xs rounded-full font-medium">
          Unsaved
        </span>
      </div>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 p-1.5 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4 text-white" />
      </div>

      {/* Remove button */}
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={onRemove}
          className="w-full px-3 py-1.5 bg-red-500/90 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
        >
          <X className="w-3 h-3" />
          Remove
        </button>
      </div>
    </div>
  );
}

export default function AlbumManager({
  album,
  images: initialImages,
  isAdmin,
  isCollaborator = false,
  currentUserId,
  mediaEmbedUrls: initialMediaEmbedUrls = [],
  venues = [],
  events = [],
  initialVenueId = null,
  initialEventId = null,
  initialCollaborators = [],
}: AlbumManagerProps) {
  const router = useRouter();
  const isOwner = album.created_by === currentUserId;
  // Collaborator-only: not owner, not admin, is collaborator
  const isCollaboratorOnly = isCollaborator && !isOwner && !isAdmin;

  const [albumName, setAlbumName] = useState(album.name);
  const [albumDescription, setAlbumDescription] = useState(album.description || "");
  const [albumYoutubeUrl, setAlbumYoutubeUrl] = useState(album.youtube_url || "");
  const [albumSpotifyUrl, setAlbumSpotifyUrl] = useState(album.spotify_url || "");
  const [mediaEmbedUrls, setMediaEmbedUrls] = useState<string[]>(initialMediaEmbedUrls);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(album.cover_image_url);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isModeratingComments, setIsModeratingComments] = useState(false);
  const [images, setImages] = useState(initialImages);
  // Sync images when server re-fetches after router.refresh()
  useEffect(() => { setImages(initialImages); }, [initialImages]);
  const [isReordering, setIsReordering] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  // Crop flow: process files one at a time through CropModal
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [currentCropFile, setCurrentCropFile] = useState<File | null>(null);

  // Staged photos: cropped/selected but not yet saved to the database
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);

  // Clean up object URLs when staged photos are removed
  useEffect(() => {
    return () => {
      stagedPhotos.forEach((sp) => URL.revokeObjectURL(sp.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Album linkage state (venue, event, collaborators)
  const [selectedVenueId, setSelectedVenueId] = useState(initialVenueId || "");
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || "");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(initialCollaborators);

  // Track unsaved changes — collaborators can only edit limited fields
  const hasStagedPhotos = stagedPhotos.length > 0;
  const hasUnsavedChanges = hasStagedPhotos || (isCollaboratorOnly
    ? (
        albumDescription !== (album.description || "") ||
        albumYoutubeUrl !== (album.youtube_url || "") ||
        albumSpotifyUrl !== (album.spotify_url || "")
      )
    : (
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
        ))
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

  // Upload all staged photos to storage + DB (called during save)
  const uploadStagedPhotos = async (): Promise<{ success: number; failed: number }> => {
    if (stagedPhotos.length === 0) return { success: 0, failed: 0 };

    const supabase = createClient();
    let success = 0;
    let failed = 0;

    // Get current max sort_order once
    const { data: maxSort } = await supabase
      .from("gallery_images")
      .select("sort_order")
      .eq("album_id", album.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();
    let nextSortOrder = (maxSort?.sort_order ?? -1) + 1;

    for (const staged of stagedPhotos) {
      try {
        const fileExt = staged.file.name.split(".").pop();
        const fileName = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

        const { error: storageError } = await supabase.storage
          .from("gallery-images")
          .upload(fileName, staged.file);
        if (storageError) throw storageError;

        const { data: { publicUrl } } = supabase.storage
          .from("gallery-images")
          .getPublicUrl(fileName);

        const { error: insertError } = await supabase
          .from("gallery_images")
          .insert({
            image_url: publicUrl,
            album_id: album.id,
            sort_order: nextSortOrder,
            uploaded_by: currentUserId,
            is_approved: true,
          });
        if (insertError) throw insertError;

        nextSortOrder++;
        success++;
      } catch (err) {
        console.error("Upload error:", err);
        failed++;
      }
    }

    // Clean up object URLs
    stagedPhotos.forEach((sp) => URL.revokeObjectURL(sp.previewUrl));
    setStagedPhotos([]);

    return { success, failed };
  };

  // Save album details
  const handleSaveDetails = async () => {
    // Collaborators skip name validation (they can't edit it)
    if (!isCollaboratorOnly && !albumName.trim()) {
      toast.error("Album name is required");
      return;
    }

    setIsSaving(true);
    setFieldErrors({});

    // ── Collaborator-only save path ──
    if (isCollaboratorOnly) {
      try {
        const res = await fetch(`/api/gallery-albums/${album.id}/collaborator-edit`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: albumDescription.trim() || null,
            youtube_url: albumYoutubeUrl || null,
            spotify_url: albumSpotifyUrl || null,
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          toast.error(payload?.error || "Failed to update album");
          setIsSaving(false);
          return;
        }
      } catch {
        toast.error("Network error. Please try again.");
        setIsSaving(false);
        return;
      }

      // Upload staged photos for collaborator
      const { success, failed } = await uploadStagedPhotos();
      if (success > 0) toast.success(`${success} photo${success > 1 ? "s" : ""} uploaded`);
      if (failed > 0) toast.error(`${failed} upload${failed > 1 ? "s" : ""} failed`);

      setIsSaving(false);
      toast.success("Album updated");
      router.refresh();
      return;
    }

    // ── Owner / Admin save path (unchanged) ──
    // Capture previous collaborator IDs before save (for notification delta)
    const prevCollaboratorIds = initialCollaborators.map((c) => c.id);

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

    // Reconcile album links (creator + venue + event; collaborators managed via invite flow)
    try {
      await reconcileAlbumLinks(supabase, album.id, {
        createdBy: album.created_by,
        venueId: venueIdValue,
        eventId: eventIdValue,
      });
    } catch (linkError) {
      console.error("Album link reconciliation error:", linkError);
      toast.error("Album saved but cross-page links failed. Try saving again.");
      setIsSaving(false);
      return;
    }

    // Sync collaborator invites: remove dropped, notify added
    const newCollaboratorIds = collaborators.map((c) => c.id);
    const addedIds = newCollaboratorIds.filter((id) => !prevCollaboratorIds.includes(id));
    const removedIds = prevCollaboratorIds.filter((id) => !newCollaboratorIds.includes(id));

    // Remove dropped collaborators (marks invite as declined, deletes link row)
    for (const removedId of removedIds) {
      try {
        await fetch(`/api/gallery-albums/${album.id}/remove-collaborator`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitee_id: removedId }),
        });
      } catch (err) {
        console.error("Remove collaborator request failed:", err);
      }
    }

    // Notify newly added collaborators (creates invite + notification + email)
    if (addedIds.length > 0) {
      try {
        const notifyRes = await fetch(`/api/gallery-albums/${album.id}/notify-collaborators`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            added_user_ids: addedIds,
            album_name: albumName.trim(),
            album_slug: finalSlug,
          }),
        });
        if (!notifyRes.ok) {
          const detail = await notifyRes.json().catch(() => null);
          console.error("Collaborator notification failed:", detail?.error || notifyRes.status);
          toast.error("Album saved, but collaborator notifications failed.");
        }
      } catch (err) {
        console.error("Collaborator notification request failed:", err);
      }
    }

    // Upload staged photos for owner/admin
    const { success: photoSuccess, failed: photoFailed } = await uploadStagedPhotos();
    if (photoSuccess > 0) toast.success(`${photoSuccess} photo${photoSuccess > 1 ? "s" : ""} uploaded`);
    if (photoFailed > 0) toast.error(`${photoFailed} upload${photoFailed > 1 ? "s" : ""} failed`);

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
    // Clear staged photos
    stagedPhotos.forEach((sp) => URL.revokeObjectURL(sp.previewUrl));
    setStagedPhotos([]);
    setUploadFiles([]);
  };

  // Leave collaboration (collaborator removes themselves)
  const handleLeaveCollaboration = async () => {
    if (!window.confirm("Leave this collaboration? The album will no longer appear on your profile or in My Albums.")) {
      return;
    }
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/gallery-albums/${album.id}/leave-collaboration`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("You have left this collaboration.");
        router.push("/dashboard/gallery");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to leave collaboration.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLeaving(false);
    }
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

  // Delete album — removes all photos (storage + DB rows), then the album itself
  const handleDeleteAlbum = async () => {
    const photoCount = images.length;
    const message = photoCount > 0
      ? `Permanently delete this album and its ${photoCount} photo${photoCount > 1 ? "s" : ""}? This cannot be undone.`
      : "Permanently delete this album? This cannot be undone.";

    if (!window.confirm(message)) {
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();

    // Delete photos from storage + DB before removing the album (FK is RESTRICT)
    if (photoCount > 0) {
      // Extract storage paths from public URLs
      const storagePaths = images
        .map((img) => {
          const match = img.image_url.match(/\/gallery-images\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter((p): p is string => p !== null);

      // Remove files from storage (best-effort; DB rows are the authority)
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("gallery-images")
          .remove(storagePaths);
        if (storageError) {
          console.warn("Storage cleanup partial failure:", storageError);
        }
      }

      // Delete all image DB rows for this album
      const { error: imgDeleteError } = await supabase
        .from("gallery_images")
        .delete()
        .eq("album_id", album.id);

      if (imgDeleteError) {
        setIsDeleting(false);
        toast.error("Failed to remove album photos. Please try again.");
        console.error(imgDeleteError);
        return;
      }
    }

    // Now delete the album itself
    const { error } = await supabase
      .from("gallery_albums")
      .delete()
      .eq("id", album.id);

    if (error) {
      setIsDeleting(false);
      toast.error("Failed to delete album.");
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

  // Start crop flow: queue all selected files, pop first into CropModal
  const startCropFlow = () => {
    if (uploadFiles.length === 0) return;
    const [first, ...rest] = uploadFiles;
    setCurrentCropFile(first);
    setCropQueue(rest);
  };

  // Stage a file as a preview (no upload yet)
  const stagePhoto = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const id = `staged-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setStagedPhotos((prev) => [...prev, { id, file, previewUrl }]);
  };

  // Handle crop completion for current file (cropped version) — stage only
  const handleCropComplete = (croppedFile: File) => {
    stagePhoto(croppedFile);
    advanceCropQueue();
  };

  // Handle "Save original" for current file — stage only
  const handleUseOriginal = () => {
    if (!currentCropFile) return;
    stagePhoto(currentCropFile);
    advanceCropQueue();
  };

  // Handle cancel for current file (skip it)
  const handleCropCancel = () => {
    advanceCropQueue();
  };

  // Move to next file in queue, or finish
  const advanceCropQueue = () => {
    if (cropQueue.length > 0) {
      const [next, ...rest] = cropQueue;
      setCurrentCropFile(next);
      setCropQueue(rest);
    } else {
      // All files processed — staged photos now visible, Save button active
      setCurrentCropFile(null);
      setCropQueue([]);
      setUploadFiles([]);
      toast.info("Photos staged. Click Save to upload them.");
    }
  };

  // Remove a staged photo before saving
  const removeStagedPhoto = (stagedId: string) => {
    setStagedPhotos((prev) => {
      const removed = prev.find((sp) => sp.id === stagedId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((sp) => sp.id !== stagedId);
    });
  };

  // Reorder staged photos via drag-and-drop
  const handleStagedDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setStagedPhotos((prev) => {
        const oldIndex = prev.findIndex((sp) => sp.id === active.id);
        const newIndex = prev.findIndex((sp) => sp.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    },
    []
  );

  // Get first visible image for fallback
  const firstVisibleImage = images.find((img) => img.is_published && !img.is_hidden);
  const displayCoverUrl = currentCoverUrl || firstVisibleImage?.image_url;

  // Upload Photos section — extracted so it can render in different positions
  // for collaborators (above album photos) vs owners/admins (below album photos)
  const uploadPhotosSection = (
    <div className={`p-6 rounded-lg ${
      isCollaboratorOnly
        ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700"
        : "bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-5 h-5 text-[var(--color-text-secondary)]" />
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Upload Photos
        </h3>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Select photos, crop or keep originals, then click Save to upload them to this album.
      </p>
      <div
        onDrop={(e) => {
          e.preventDefault();
          const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
            f.type.startsWith("image/")
          );
          setUploadFiles(prev => [...prev, ...droppedFiles]);
        }}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-[var(--color-border-default)] rounded-lg p-6 text-center hover:border-[var(--color-border-accent)] transition-colors cursor-pointer"
        onClick={() => document.getElementById("album-upload-input")?.click()}
      >
        <input
          id="album-upload-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files) {
              const maxSize = 10 * 1024 * 1024;
              const validFiles = Array.from(e.target.files).filter(f => {
                if (f.size > maxSize) {
                  toast.error(`${f.name} is too large (max 10MB)`);
                  return false;
                }
                return true;
              });
              setUploadFiles(prev => [...prev, ...validFiles]);
            }
            e.target.value = "";
          }}
          className="hidden"
        />
        <div className="text-3xl mb-2">📷</div>
        <p className="text-sm text-[var(--color-text-primary)] font-medium">
          Drop photos here or click to select
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          Max 10MB per photo. JPG, PNG, WebP supported.
        </p>
      </div>
      {uploadFiles.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {uploadFiles.length} file{uploadFiles.length > 1 ? "s" : ""} selected
          </p>
          <div className="flex flex-wrap gap-2">
            {uploadFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-bg-tertiary)] rounded text-xs text-[var(--color-text-secondary)]">
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadFiles(prev => prev.filter((_, i) => i !== idx));
                  }}
                  className="text-[var(--color-text-tertiary)] hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={startCropFlow}
            className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {`Prepare ${uploadFiles.length} Photo${uploadFiles.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );

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

        {/* Collaborator badge */}
        {isCollaboratorOnly && (
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
            Collaborator
          </span>
        )}

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

        {/* Publish/Unpublish button — hidden for collaborators */}
        {!isCollaboratorOnly && (
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
        )}

        {/* Save button (top) */}
        <button
          onClick={handleSaveDetails}
          disabled={isSaving || !hasUnsavedChanges}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] disabled:opacity-50 flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          {isSaving ? "Saving..." : "Save"}
        </button>

        {/* Cancel button (top, only when changes exist) */}
        {hasUnsavedChanges && (
          <button
            onClick={handleCancelEdits}
            className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}

        {/* Delete album button — hidden for collaborators */}
        {!isCollaboratorOnly && (
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
        )}

        {/* Leave collaboration button — collaborators only */}
        {isCollaboratorOnly && (
          <button
            onClick={handleLeaveCollaboration}
            disabled={isLeaving}
            className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 disabled:opacity-50"
          >
            {isLeaving ? "Leaving..." : "Leave Collaboration"}
          </button>
        )}

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
          {/* Album Name — hidden for collaborators (read-only in heading above) */}
          {!isCollaboratorOnly && (
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
          )}
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
          {/* YouTube & Spotify — available to collaborators and admins */}
          {(isCollaboratorOnly || isAdmin) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  YouTube URL <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
                </label>
                <input
                  type="url"
                  value={albumYoutubeUrl}
                  onChange={(e) => setAlbumYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-accent)]"
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                  Spotify URL <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
                </label>
                <input
                  type="url"
                  value={albumSpotifyUrl}
                  onChange={(e) => setAlbumSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/..."
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-border-accent)]"
                />
              </div>
            </div>
          )}
          {/* Venue & Event selectors — hidden for collaborators */}
          {!isCollaboratorOnly && (
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
          )}
          {/* Collaborators — hidden for collaborators */}
          {!isCollaboratorOnly && (
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Invite collaborators <span className="font-normal text-[var(--color-text-tertiary)]">(optional — they must accept before the album appears on their profile)</span>
              </label>
              <CollaboratorSelect
                value={collaborators}
                onChange={setCollaborators}
                ownerId={album.created_by}
                disabled={isSaving}
              />
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Invites are sent when you click Save.
              </p>
            </div>
          )}
          {isAdmin && (
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                Media Links <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>
              </label>
              <MediaEmbedsEditor value={mediaEmbedUrls} onChange={setMediaEmbedUrls} />
            </div>
          )}
          {/* Save / Cancel / Publish (bottom action row) */}
          <div className="flex flex-wrap gap-2 pt-2">
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
            {/* Publish button — hidden for collaborators */}
            {!isCollaboratorOnly && (
              <button
                onClick={handleTogglePublish}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  album.is_published
                    ? "bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]"
                    : "bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)]"
                }`}
              >
                {album.is_published ? "Unpublish" : "Publish"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upload Photos — shown FIRST for collaborators so it's visually primary */}
      {isCollaboratorOnly && uploadPhotosSection}

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

      {/* Staged Photos (unsaved) */}
      {stagedPhotos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
              Staged Photos ({stagedPhotos.length})
            </h3>
            <span className="text-sm text-amber-600 dark:text-amber-400 italic">
              Click Save to upload these photos
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Drag to reorder before saving. These photos will be added to the album when you click Save.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleStagedDragEnd}
          >
            <SortableContext
              items={stagedPhotos.map((sp) => sp.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {stagedPhotos.map((sp) => (
                  <SortableStagedCard
                    key={sp.id}
                    staged={sp}
                    onRemove={() => removeStagedPhoto(sp.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

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
          {isCollaboratorOnly
            ? "You can view all photos. Reordering and cover selection are managed by the album owner."
            : "Drag photos to reorder. Click \"Set as cover\" to choose the album cover."}
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
                    readOnly={isCollaboratorOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : !hasStagedPhotos ? (
          <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <div className="text-4xl mb-4">📷</div>
            <p className="text-[var(--color-text-primary)] font-medium">Add photos to finish this album.</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-2">
              Go to your gallery dashboard and select this album when uploading.
            </p>
          </div>
        ) : null}
      </div>

      {/* Upload Photos — shown here for owners/admins (collaborators get it above) */}
      {!isCollaboratorOnly && uploadPhotosSection}

      {/* CropModal — sequential crop flow for each selected file */}
      {currentCropFile && (
        <CropModal
          file={currentCropFile}
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
          onUseOriginal={handleUseOriginal}
        />
      )}

      {/* Comment Moderation Section — hidden for collaborators */}
      {!isCollaboratorOnly && (
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
      )}

      {/* Owner context for hidden albums (non-admin) */}
      {album.is_hidden && !isAdmin && (
        <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This album has been hidden by an admin and is not visible in the public gallery.
            Contact us if you think this is a mistake.
          </p>
        </div>
      )}

      {/* Collaborator Info */}
      {isCollaboratorOnly && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Collaborator view:</strong> You can edit the description, YouTube &amp; Spotify URLs, and upload photos.
            Album name, cover image, venue, event, publish status, and collaborator invites are managed by the album owner.
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
