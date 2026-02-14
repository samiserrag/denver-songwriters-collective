"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { reconcileAlbumLinks } from "@/lib/gallery/albumLinks";
import CollaboratorSelect, { type Collaborator } from "@/components/gallery/CollaboratorSelect";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import BulkUploadGrid from "@/components/gallery/BulkUploadGrid";
import { AlbumPhotoManager } from "@/components/gallery/AlbumPhotoManager";
import { Pencil, FolderOpen, X, Check } from "lucide-react";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  album_id: string | null;
  sort_order?: number;
  uploader: { id: string; full_name: string | null }[] | { id: string; full_name: string | null } | null;
  event: { id: string; title: string }[] | { id: string; title: string } | null;
  venue: { id: string; name: string }[] | { id: string; name: string } | null;
}

interface Album {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_published: boolean;
  created_at: string;
}

interface Props {
  images: GalleryImage[];
  albums: Album[];
  venues: { id: string; name: string }[];
  events: { id: string; title: string }[];
  userId: string;
}

type Tab = "photos" | "albums" | "upload";

// Helper to normalize array joins
function normalizeRelation<T>(data: T | T[] | null): T | null {
  if (data === null) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export default function GalleryAdminTabs({ images, albums, venues, events, userId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("albums");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  // Album form state
  const [albumName, setAlbumName] = useState("");
  const [albumSlug, setAlbumSlug] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumCover, setAlbumCover] = useState("");
  const [albumVenueId, setAlbumVenueId] = useState("");
  const [albumEventId, setAlbumEventId] = useState("");
  const [albumCollaborators, setAlbumCollaborators] = useState<Collaborator[]>([]);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Album management state
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editAlbumName, setEditAlbumName] = useState("");
  const [editAlbumDescription, setEditAlbumDescription] = useState("");

  // Calculate counts
  const getAlbumPhotoCount = (albumId: string) =>
    images.filter((img) => img.album_id === albumId).length;

  const filteredImages = images.filter((img) => {
    if (filter === "pending") return !img.is_approved;
    if (filter === "approved") return img.is_approved;
    return true;
  });

  const handleApprove = async (imageId: string) => {
    const supabase = createClient();
    await supabase.from("gallery_images").update({ is_approved: true }).eq("id", imageId);
    router.refresh();
  };

  const handleReject = async (imageId: string) => {
    const supabase = createClient();
    await supabase.from("gallery_images").delete().eq("id", imageId);
    router.refresh();
  };

  const handleToggleFeatured = async (imageId: string, currentValue: boolean) => {
    const supabase = createClient();
    await supabase.from("gallery_images").update({ is_featured: !currentValue }).eq("id", imageId);
    router.refresh();
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumName.trim()) {
      toast.error("Album name is required");
      return;
    }

    setIsCreatingAlbum(true);
    const supabase = createClient();

    // Generate base slug from input or name
    const baseSlug = (albumSlug.trim() || albumName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check for existing slugs and auto-increment if needed
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

    const venueIdValue = albumVenueId || null;
    const eventIdValue = albumEventId || null;

    const { data, error } = await supabase.from("gallery_albums").insert({
      name: albumName.trim(),
      slug: finalSlug,
      description: albumDescription.trim() || null,
      cover_image_url: albumCover || null,
      created_by: userId,
      is_published: false, // Start as draft
      venue_id: venueIdValue,
      event_id: eventIdValue,
    }).select("id").single();

    if (error) {
      toast.error("Failed to create album");
      console.error(error);
    } else {
      // Reconcile album links (creator + venue + event + collaborators)
      try {
        await reconcileAlbumLinks(supabase, data.id, {
          createdBy: userId,
          venueId: venueIdValue,
          eventId: eventIdValue,
          collaboratorIds: albumCollaborators.map((c) => c.id),
        });
      } catch (linkError) {
        console.error("Album link reconciliation error:", linkError);
        toast.error("Album created but cross-page links failed. Edit the album to retry.");
      }

      const slugNote = finalSlug !== baseSlug ? ` (slug: ${finalSlug})` : "";
      toast.success(`Album created!${slugNote}`);
    }

    setAlbumName("");
    setAlbumSlug("");
    setAlbumDescription("");
    setAlbumCover("");
    setAlbumVenueId("");
    setAlbumEventId("");
    setAlbumCollaborators([]);
    setIsCreatingAlbum(false);
    router.refresh();
  };

  const handleDeleteAlbum = async (albumId: string) => {
    const photoCount = getAlbumPhotoCount(albumId);
    if (photoCount > 0) {
      toast.error(`Cannot delete album: it still has ${photoCount} photo${photoCount > 1 ? "s" : ""}. Remove or move all photos first.`);
      return;
    }
    if (!confirm("Delete this empty album? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("gallery_albums").delete().eq("id", albumId);
    if (error) {
      toast.error("Failed to delete album. It may still have photos.");
      console.error(error);
    } else {
      toast.success("Album deleted");
    }
    router.refresh();
  };

  const handleToggleAlbumPublished = async (albumId: string, currentValue: boolean) => {
    const supabase = createClient();
    await supabase.from("gallery_albums").update({ is_published: !currentValue }).eq("id", albumId);
    toast.success(currentValue ? "Album unpublished" : "Album published");
    router.refresh();
  };

  // Start editing album
  const startEditAlbum = (album: Album) => {
    setEditingAlbumId(album.id);
    setEditAlbumName(album.name);
    setEditAlbumDescription(album.description || "");
  };

  // Save album edit
  const saveAlbumEdit = async (albumId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("gallery_albums")
      .update({
        name: editAlbumName,
        description: editAlbumDescription || null,
      })
      .eq("id", albumId);

    if (error) {
      toast.error("Failed to update album");
    } else {
      toast.success("Album updated");
      setEditingAlbumId(null);
      router.refresh();
    }
  };

  // Album cover upload handler
  const handleAlbumCoverUpload = useCallback(async (file: File): Promise<string | null> => {
    const supabase = createClient();
    const fileExt = file.name.split('.').pop() || 'jpg';
    // Use userId folder to satisfy RLS policy
    const fileName = `${userId}/album-cover-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('gallery-images')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload cover image');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gallery-images')
      .getPublicUrl(fileName);

    toast.success('Cover image uploaded!');
    return publicUrl;
  }, [userId]);

  // Handle upload complete - refresh the photos list
  const handleUploadComplete = useCallback(() => {
    router.refresh();
    setActiveTab("albums");
  }, [router]);

  // Get album name by ID
  const getAlbumName = (albumId: string) => {
    const album = albums.find((a) => a.id === albumId);
    return album?.name || "Unknown Album";
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border-default)]">
        {(["albums", "photos", "upload"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-[var(--color-text-accent)] border-b-2 border-[var(--color-border-accent)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab === "albums" && `Albums (${albums.length})`}
            {tab === "photos" && `All Photos (${images.length})`}
            {tab === "upload" && "Upload Photos"}
          </button>
        ))}
      </div>

      {/* Albums Tab (now first) */}
      {activeTab === "albums" && (
        <div>
          {/* Create Album Form */}
          <form onSubmit={handleCreateAlbum} className="mb-8 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Create New Album</h3>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Cover Image Upload */}
              <div className="w-40 flex-shrink-0">
                <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Cover Image</label>
                <ImageUpload
                  currentImageUrl={albumCover || null}
                  onUpload={async (file) => {
                    const url = await handleAlbumCoverUpload(file);
                    if (url) {
                      setAlbumCover(url);
                    }
                    return url;
                  }}
                  onRemove={async () => {
                    setAlbumCover("");
                  }}
                  aspectRatio={3/2}
                  maxSizeMB={10}
                  shape="square"
                  placeholderText="Cover"
                />
              </div>

              {/* Album Details */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={albumName}
                    onChange={(e) => {
                      setAlbumName(e.target.value);
                      if (!albumSlug) setAlbumSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }}
                    placeholder="Album name"
                    className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                    required
                  />
                  <input
                    type="text"
                    value={albumSlug}
                    onChange={(e) => setAlbumSlug(e.target.value)}
                    placeholder="URL slug"
                    className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                  />
                </div>
                <input
                  type="text"
                  value={albumDescription}
                  onChange={(e) => setAlbumDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                />

                {/* Venue & Event selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Venue <span className="text-[var(--color-text-tertiary)]">(optional — appears on venue page)</span>
                    </label>
                    <select
                      value={albumVenueId}
                      onChange={(e) => setAlbumVenueId(e.target.value)}
                      disabled={isCreatingAlbum}
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm"
                    >
                      <option value="">No venue</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                      Event <span className="text-[var(--color-text-tertiary)]">(optional — appears on event page)</span>
                    </label>
                    <select
                      value={albumEventId}
                      onChange={(e) => setAlbumEventId(e.target.value)}
                      disabled={isCreatingAlbum}
                      className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] text-sm"
                    >
                      <option value="">No event</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Collaborators */}
                <div>
                  <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                    Collaborators <span className="text-[var(--color-text-tertiary)]">(optional — appears on their profiles)</span>
                  </label>
                  <CollaboratorSelect
                    value={albumCollaborators}
                    onChange={setAlbumCollaborators}
                    ownerId={userId}
                    disabled={isCreatingAlbum}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingAlbum || !albumName}
              className="mt-4 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-text-on-accent)] rounded-lg transition-colors"
            >
              {isCreatingAlbum ? "Creating..." : "Create Album"}
            </button>
          </form>

          {/* Albums Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map((album) => {
              const photoCount = getAlbumPhotoCount(album.id);
              const isExpanded = expandedAlbumId === album.id;
              const isEditing = editingAlbumId === album.id;
              const albumPhotos = images
                .filter((img) => img.album_id === album.id)
                .map((img) => ({
                  id: img.id,
                  image_url: img.image_url,
                  caption: img.caption,
                  sort_order: img.sort_order ?? 0,
                }));

              // Get first photo as fallback cover
              const fallbackCover = albumPhotos[0]?.image_url;

              return (
                <div
                  key={album.id}
                  className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden"
                >
                  {/* Cover Image - vertical card layout */}
                  <div className="relative aspect-[3/2] bg-[var(--color-bg-tertiary)]">
                    {(album.cover_image_url || fallbackCover) ? (
                      <Image
                        src={album.cover_image_url || fallbackCover}
                        alt={album.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FolderOpen className="w-12 h-12 text-[var(--color-text-tertiary)]" />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="absolute top-2 left-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          album.is_published
                            ? "bg-green-500/90 text-white"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                        }`}
                      >
                        {album.is_published ? "Published" : "Draft"}
                      </span>
                    </div>

                    {/* Photo count badge */}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-black/60 text-white">
                        {photoCount} {photoCount === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  </div>

                  {/* Album Info */}
                  <div className="p-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editAlbumName}
                          onChange={(e) => setEditAlbumName(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editAlbumDescription}
                          onChange={(e) => setEditAlbumDescription(e.target.value)}
                          placeholder="Description..."
                          className="w-full px-2 py-1 text-sm bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveAlbumEdit(album.id)}
                            className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Save
                          </button>
                          <button
                            onClick={() => setEditingAlbumId(null)}
                            className="px-2 py-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] text-xs rounded flex items-center gap-1"
                          >
                            <X className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-[var(--color-text-primary)] truncate">{album.name}</h3>
                          <button
                            onClick={() => startEditAlbum(album)}
                            className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
                            title="Edit album"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[var(--color-text-tertiary)] text-xs mb-2">/{album.slug}</p>
                        {album.description && (
                          <p className="text-[var(--color-text-secondary)] text-sm line-clamp-2 mb-3">
                            {album.description}
                          </p>
                        )}
                      </>
                    )}

                    {/* Album Actions */}
                    {!isEditing && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => setExpandedAlbumId(isExpanded ? null : album.id)}
                          className={`px-3 py-1.5 text-xs rounded transition-colors ${
                            isExpanded
                              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
                          }`}
                        >
                          {isExpanded ? "Hide Photos" : "Manage Photos"}
                        </button>
                        <button
                          onClick={() => handleToggleAlbumPublished(album.id, album.is_published)}
                          className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-xs rounded transition-colors"
                        >
                          {album.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Album Photo Manager (expandable) - full width below card */}
                  {isExpanded && (
                    <AlbumPhotoManager
                      albumId={album.id}
                      albumName={album.name}
                      photos={albumPhotos}
                      onUpdate={() => router.refresh()}
                      onClose={() => setExpandedAlbumId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {albums.length === 0 && (
            <p className="text-center text-[var(--color-text-secondary)] py-8">
              No albums yet. Create one above!
            </p>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && (
        <div>
          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "pending", "approved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === f
                    ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                    : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                }`}
              >
                {f === "all" && `All (${images.length})`}
                {f === "pending" && `Pending (${images.filter((i) => !i.is_approved).length})`}
                {f === "approved" && `Approved (${images.filter((i) => i.is_approved).length})`}
              </button>
            ))}
          </div>

          {/* Photos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredImages.map((image) => {
              const uploader = normalizeRelation(image.uploader);
              const event = normalizeRelation(image.event);
              const venue = normalizeRelation(image.venue);

              return (
                <div
                  key={image.id}
                  className={`relative rounded-lg overflow-hidden border ${
                    image.is_approved ? "border-[var(--color-border-default)]" : "border-yellow-600"
                  }`}
                >
                  <Image
                    src={image.image_url}
                    alt={image.caption ?? "Gallery image"}
                    width={400}
                    height={300}
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="w-full h-auto object-cover"
                  />

                  {/* Status badges */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {!image.is_approved && (
                      <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                        Pending
                      </span>
                    )}
                    {image.is_featured && (
                      <span className="px-2 py-0.5 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] text-xs rounded-full">
                        Featured
                      </span>
                    )}
                    {image.album_id && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full truncate max-w-[100px]">
                        {getAlbumName(image.album_id)}
                      </span>
                    )}
                  </div>

                  {/* Info overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    {image.caption && (
                      <p className="text-white text-xs truncate mb-1">{image.caption}</p>
                    )}
                    <p className="text-gray-300 text-xs">
                      by {uploader?.full_name ?? "Unknown"}
                    </p>
                    {(event || venue) && (
                      <p className="text-gray-400 text-xs truncate">
                        @ {event?.title ?? venue?.name}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {!image.is_approved && (
                      <>
                        <button
                          onClick={() => handleApprove(image.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(image.id)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {image.is_approved && (
                      <>
                        <button
                          onClick={() => handleToggleFeatured(image.id, image.is_featured)}
                          className={`px-2 py-1 text-xs rounded ${
                            image.is_featured
                              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                          }`}
                        >
                          {image.is_featured ? "Unfeature" : "Feature"}
                        </button>
                        <button
                          onClick={() => handleReject(image.id)}
                          className="px-2 py-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs rounded"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredImages.length === 0 && (
            <p className="text-center text-[var(--color-text-secondary)] py-8">No photos found.</p>
          )}
        </div>
      )}

      {/* Upload Tab - New Bulk Upload UX */}
      {activeTab === "upload" && (
        <BulkUploadGrid
          userId={userId}
          albums={albums.map((a) => ({ id: a.id, name: a.name }))}
          venues={venues}
          events={events}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}
