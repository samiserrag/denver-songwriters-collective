"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import BulkUploadGrid from "@/components/gallery/BulkUploadGrid";
import { AlbumPhotoManager } from "@/components/gallery/AlbumPhotoManager";
import { Pencil, FolderOpen, X, Check } from "lucide-react";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_hidden: boolean;
  is_published: boolean;
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
  is_hidden: boolean;
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
  const [filter, setFilter] = useState<"all" | "visible" | "hidden" | "unassigned">("all");

  // Album form state
  const [albumName, setAlbumName] = useState("");
  const [albumSlug, setAlbumSlug] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumCover, setAlbumCover] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Album management state
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editAlbumName, setEditAlbumName] = useState("");
  const [editAlbumDescription, setEditAlbumDescription] = useState("");

  // Unassigned photo assignment state
  const [selectedUnassignedPhotos, setSelectedUnassignedPhotos] = useState<Set<string>>(new Set());
  const [assignToAlbumId, setAssignToAlbumId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Calculate counts
  const unassignedImages = images.filter((img) => !img.album_id);
  const getAlbumPhotoCount = (albumId: string) =>
    images.filter((img) => img.album_id === albumId).length;

  const filteredImages = images.filter((img) => {
    if (filter === "visible") return !img.is_hidden;
    if (filter === "hidden") return img.is_hidden;
    if (filter === "unassigned") return !img.album_id;
    return true;
  });

  const handleHide = async (imageId: string) => {
    const supabase = createClient();
    await supabase.from("gallery_images").update({ is_hidden: true }).eq("id", imageId);
    toast.success("Photo hidden");
    router.refresh();
  };

  const handleUnhide = async (imageId: string) => {
    const supabase = createClient();
    await supabase.from("gallery_images").update({ is_hidden: false }).eq("id", imageId);
    toast.success("Photo visible");
    router.refresh();
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Delete this photo permanently? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase.from("gallery_images").delete().eq("id", imageId);
    toast.success("Photo deleted");
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

    const { error } = await supabase.from("gallery_albums").insert({
      name: albumName.trim(),
      slug: finalSlug,
      description: albumDescription.trim() || null,
      cover_image_url: albumCover || null,
      created_by: userId,
      is_published: false, // Start as draft
    });

    if (error) {
      toast.error("Failed to create album");
      console.error(error);
    } else {
      const slugNote = finalSlug !== baseSlug ? ` (slug: ${finalSlug})` : "";
      toast.success(`Album created!${slugNote}`);
    }

    setAlbumName("");
    setAlbumSlug("");
    setAlbumDescription("");
    setAlbumCover("");
    setIsCreatingAlbum(false);
    router.refresh();
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm("Delete this album? Photos in it will be unassigned, not deleted.")) return;
    const supabase = createClient();
    await supabase.from("gallery_albums").delete().eq("id", albumId);
    toast.success("Album deleted");
    router.refresh();
  };

  const handleToggleAlbumPublished = async (albumId: string, currentValue: boolean) => {
    const supabase = createClient();
    await supabase.from("gallery_albums").update({ is_published: !currentValue }).eq("id", albumId);
    toast.success(currentValue ? "Album unpublished" : "Album published");
    router.refresh();
  };

  const handleToggleAlbumHidden = async (albumId: string, currentHidden: boolean) => {
    const supabase = createClient();
    await supabase.from("gallery_albums").update({ is_hidden: !currentHidden }).eq("id", albumId);
    toast.success(currentHidden ? "Album visible" : "Album hidden");
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

  // Toggle photo selection for assignment
  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedUnassignedPhotos((prev) => {
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
    if (!assignToAlbumId || selectedUnassignedPhotos.size === 0) return;

    setIsAssigning(true);
    const supabase = createClient();
    const photoIds = Array.from(selectedUnassignedPhotos);

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
      await supabase
        .from("gallery_images")
        .update({
          album_id: assignToAlbumId,
          sort_order: nextSortOrder++,
        })
        .eq("id", photoId);
    }

    toast.success(`${photoIds.length} photo(s) added to album`);
    setSelectedUnassignedPhotos(new Set());
    setAssignToAlbumId("");
    setIsAssigning(false);
    router.refresh();
  }, [assignToAlbumId, selectedUnassignedPhotos, router]);

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

          {/* Albums List */}
          <div className="space-y-4">
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

              return (
                <div
                  key={album.id}
                  className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* Cover Image */}
                    {album.cover_image_url ? (
                      <div className="relative w-full md:w-48 h-32 flex-shrink-0">
                        <Image
                          src={album.cover_image_url}
                          alt={album.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 200px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full md:w-48 h-32 flex-shrink-0 bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-[var(--color-text-tertiary)]" />
                      </div>
                    )}

                    {/* Album Info */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
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
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-[var(--color-text-primary)]">{album.name}</h3>
                                <button
                                  onClick={() => startEditAlbum(album)}
                                  className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                  title="Edit album"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p className="text-[var(--color-text-tertiary)] text-xs">/{album.slug}</p>
                              {album.description && (
                                <p className="text-[var(--color-text-secondary)] text-sm mt-1 line-clamp-2">
                                  {album.description}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {photoCount} {photoCount === 1 ? "photo" : "photos"}
                          </span>
                          {album.is_hidden && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                              Hidden
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              album.is_published
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {album.is_published ? "Published" : "Draft"}
                          </span>
                        </div>
                      </div>

                      {/* Album Actions */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => setExpandedAlbumId(isExpanded ? null : album.id)}
                          className={`px-3 py-1.5 text-xs rounded transition-colors ${
                            isExpanded
                              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)]"
                          }`}
                        >
                          {isExpanded ? "Close Photos" : "Manage Photos"}
                        </button>
                        <button
                          onClick={() => handleToggleAlbumPublished(album.id, album.is_published)}
                          className="px-3 py-1.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-xs rounded transition-colors"
                        >
                          {album.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() => handleToggleAlbumHidden(album.id, album.is_hidden)}
                          className={`px-3 py-1.5 text-xs rounded transition-colors ${
                            album.is_hidden
                              ? "bg-yellow-100 hover:bg-yellow-200 text-yellow-700"
                              : "bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          {album.is_hidden ? "Unhide" : "Hide"}
                        </button>
                        <button
                          onClick={() => handleDeleteAlbum(album.id)}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Album Photo Manager (expandable) */}
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

          {/* Unassigned Photos Section */}
          {unassignedImages.length > 0 && (
            <div className="mt-8 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
                    Unassigned Photos ({unassignedImages.length})
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Click photos to select, then add them to an album.
                  </p>
                </div>

                {/* Assignment controls */}
                {selectedUnassignedPhotos.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[var(--color-text-accent)] font-medium">
                      {selectedUnassignedPhotos.size} selected
                    </span>
                    <select
                      value={assignToAlbumId}
                      onChange={(e) => setAssignToAlbumId(e.target.value)}
                      disabled={isAssigning}
                      className="px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                    >
                      <option value="">Add to album...</option>
                      {albums.map((album) => (
                        <option key={album.id} value={album.id}>
                          {album.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={assignPhotosToAlbum}
                      disabled={!assignToAlbumId || isAssigning}
                      className="px-3 py-1.5 text-sm bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {isAssigning ? "Adding..." : "Add"}
                    </button>
                    <button
                      onClick={() => setSelectedUnassignedPhotos(new Set())}
                      disabled={isAssigning}
                      className="px-3 py-1.5 text-sm border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {unassignedImages.map((image) => {
                  const isSelected = selectedUnassignedPhotos.has(image.id);
                  return (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => togglePhotoSelection(image.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-[var(--color-accent-primary)] ring-2 ring-[var(--color-accent-primary)]/30"
                          : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]"
                      }`}
                    >
                      <Image
                        src={image.image_url}
                        alt={image.caption || "Unassigned photo"}
                        fill
                        sizes="100px"
                        className="object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--color-accent-primary)] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-[var(--color-text-on-accent)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === "photos" && (
        <div>
          {/* Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "visible", "hidden", "unassigned"] as const).map((f) => (
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
                {f === "visible" && `Visible (${images.filter((i) => !i.is_hidden).length})`}
                {f === "hidden" && `Hidden (${images.filter((i) => i.is_hidden).length})`}
                {f === "unassigned" && `Unassigned (${unassignedImages.length})`}
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
                    image.is_hidden ? "border-red-400 opacity-60" : "border-[var(--color-border-default)]"
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
                    {image.is_hidden && (
                      <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                        Hidden
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
                    {image.is_hidden ? (
                      <button
                        onClick={() => handleUnhide(image.id)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                      >
                        Unhide
                      </button>
                    ) : (
                      <button
                        onClick={() => handleHide(image.id)}
                        className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded"
                      >
                        Hide
                      </button>
                    )}
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
                      onClick={() => handleDelete(image.id)}
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded"
                    >
                      Delete
                    </button>
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
