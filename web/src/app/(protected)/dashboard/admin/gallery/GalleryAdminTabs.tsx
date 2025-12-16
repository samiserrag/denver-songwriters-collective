"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
  album_id: string | null;
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
  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");

  // Upload state
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadVenue, setUploadVenue] = useState("");
  const [uploadEvent, setUploadEvent] = useState("");
  const [uploadAlbum, setUploadAlbum] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Album form state
  const [albumName, setAlbumName] = useState("");
  const [albumSlug, setAlbumSlug] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumCover, setAlbumCover] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadUrl) return;

    setIsUploading(true);
    const supabase = createClient();

    await supabase.from("gallery_images").insert({
      uploaded_by: userId,
      image_url: uploadUrl,
      caption: uploadCaption || null,
      venue_id: uploadVenue || null,
      event_id: uploadEvent || null,
      album_id: uploadAlbum || null,
      is_approved: true, // Admin uploads are auto-approved
    });

    setUploadUrl("");
    setUploadCaption("");
    setUploadVenue("");
    setUploadEvent("");
    setUploadAlbum("");
    setIsUploading(false);
    router.refresh();
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumName) return;

    setIsCreatingAlbum(true);
    const supabase = createClient();

    const slug = albumSlug || albumName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    await supabase.from("gallery_albums").insert({
      name: albumName,
      slug,
      description: albumDescription || null,
      cover_image_url: albumCover || null,
      created_by: userId,
      is_published: true,
    });

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
    router.refresh();
  };

  const handleToggleAlbumPublished = async (albumId: string, currentValue: boolean) => {
    const supabase = createClient();
    await supabase.from("gallery_albums").update({ is_published: !currentValue }).eq("id", albumId);
    router.refresh();
  };

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border-default)]">
        {(["photos", "albums", "upload"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-[var(--color-text-accent)] border-b-2 border-[var(--color-border-accent)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {tab === "photos" && `Photos (${images.length})`}
            {tab === "albums" && `Albums (${albums.length})`}
            {tab === "upload" && "Upload Photo"}
          </button>
        ))}
      </div>

      {/* Photos Tab */}
      {activeTab === "photos" && (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(["all", "pending", "approved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === f
                    ? "bg-[var(--color-accent-primary)] text-[var(--color-background)]"
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
                  <div className="relative w-full aspect-square">
                    <Image
                      src={image.image_url}
                      alt={image.caption ?? "Gallery image"}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover"
                    />
                  </div>

                  {/* Status badges */}
                  <div className="absolute top-2 left-2 flex gap-1">
                    {!image.is_approved && (
                      <span className="px-2 py-0.5 bg-yellow-600 text-black text-xs rounded-full">
                        Pending
                      </span>
                    )}
                    {image.is_featured && (
                      <span className="px-2 py-0.5 bg-[var(--color-accent-primary)] text-[var(--color-background)] text-xs rounded-full">
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Info overlay */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                    {image.caption && (
                      <p className="text-white text-xs truncate mb-1">{image.caption}</p>
                    )}
                    <p className="text-neutral-300 text-xs">
                      by {uploader?.full_name ?? "Unknown"}
                    </p>
                    {(event || venue) && (
                      <p className="text-neutral-400 text-xs truncate">
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
                              ? "bg-[var(--color-accent-primary)] text-[var(--color-background)]"
                              : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                          }`}
                        >
                          {image.is_featured ? "Unfeature" : "Feature"}
                        </button>
                        <button
                          onClick={() => handleReject(image.id)}
                          className="px-2 py-1 bg-red-900 hover:bg-red-800 text-red-300 text-xs rounded"
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

      {/* Albums Tab */}
      {activeTab === "albums" && (
        <div>
          {/* Create Album Form */}
          <form onSubmit={handleCreateAlbum} className="mb-8 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">Create New Album</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={albumName}
                onChange={(e) => {
                  setAlbumName(e.target.value);
                  if (!albumSlug) setAlbumSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                }}
                placeholder="Album name"
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
                required
              />
              <input
                type="text"
                value={albumSlug}
                onChange={(e) => setAlbumSlug(e.target.value)}
                placeholder="URL slug"
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <input
                type="text"
                value={albumDescription}
                onChange={(e) => setAlbumDescription(e.target.value)}
                placeholder="Description (optional)"
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
              <input
                type="url"
                value={albumCover}
                onChange={(e) => setAlbumCover(e.target.value)}
                placeholder="Cover image URL (optional)"
                className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>
            <button
              type="submit"
              disabled={isCreatingAlbum || !albumName}
              className="mt-4 px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] disabled:bg-[var(--color-accent-primary)]/50 text-[var(--color-background)] rounded-lg transition-colors"
            >
              {isCreatingAlbum ? "Creating..." : "Create Album"}
            </button>
          </form>

          {/* Albums List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map((album) => (
              <div
                key={album.id}
                className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden"
              >
                {album.cover_image_url ? (
                  <div className="relative w-full h-32">
                    <Image
                      src={album.cover_image_url}
                      alt={album.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                    <span className="text-[var(--color-text-tertiary)]">No cover</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-[var(--color-text-primary)]">{album.name}</h3>
                      <p className="text-[var(--color-text-tertiary)] text-xs">/{album.slug}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        album.is_published
                          ? "bg-green-900/50 text-green-400"
                          : "bg-yellow-900/50 text-yellow-400"
                      }`}
                    >
                      {album.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  {album.description && (
                    <p className="text-[var(--color-text-secondary)] text-sm mb-3 line-clamp-2">
                      {album.description}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleAlbumPublished(album.id, album.is_published)}
                      className="px-3 py-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-xs rounded"
                    >
                      {album.is_published ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => handleDeleteAlbum(album.id)}
                      className="px-3 py-1 bg-red-900 hover:bg-red-800 text-red-300 text-xs rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {albums.length === 0 && (
            <p className="text-center text-[var(--color-text-secondary)] py-8">
              No albums yet. Create one above!
            </p>
          )}
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === "upload" && (
        <form onSubmit={handleUpload} className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Image URL <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              type="url"
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              required
            />
            {uploadUrl && (
              <img
                src={uploadUrl}
                alt="Preview"
                className="mt-2 max-h-40 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Caption</label>
            <input
              type="text"
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Describe the photo..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Venue</label>
              <select
                value={uploadVenue}
                onChange={(e) => setUploadVenue(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="">Select venue...</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Event</label>
              <select
                value={uploadEvent}
                onChange={(e) => setUploadEvent(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="">Select event...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Album</label>
            <select
              value={uploadAlbum}
              onChange={(e) => setUploadAlbum(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            >
              <option value="">No album</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isUploading || !uploadUrl}
            className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] disabled:bg-[var(--color-accent-primary)]/50 text-[var(--color-background)] rounded-lg transition-colors"
          >
            {isUploading ? "Uploading..." : "Upload Photo"}
          </button>
        </form>
      )}
    </div>
  );
}
