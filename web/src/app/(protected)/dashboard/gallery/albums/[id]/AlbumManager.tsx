"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Star, Check, Pencil, X } from "lucide-react";

interface Album {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
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

interface AlbumManagerProps {
  album: Album;
  images: GalleryImage[];
  isAdmin: boolean;
}

export default function AlbumManager({ album, images, isAdmin }: AlbumManagerProps) {
  const router = useRouter();
  const [isEditingName, setIsEditingName] = useState(false);
  const [albumName, setAlbumName] = useState(album.name);
  const [albumDescription, setAlbumDescription] = useState(album.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(album.cover_image_url);

  // Generate slug from name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  // Save album name/description
  const handleSaveDetails = async () => {
    if (!albumName.trim()) {
      toast.error("Album name is required");
      return;
    }

    setIsSaving(true);
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

    const { error } = await supabase
      .from("gallery_albums")
      .update({
        name: albumName.trim(),
        slug: finalSlug,
        description: albumDescription.trim() || null,
      })
      .eq("id", album.id);

    setIsSaving(false);

    if (error) {
      toast.error("Failed to update album");
      console.error(error);
    } else {
      toast.success("Album updated");
      setIsEditingName(false);
      router.refresh();
    }
  };

  // Toggle publish state
  const handleTogglePublish = async () => {
    const supabase = createClient();
    const newState = !album.is_published;

    const { error } = await supabase
      .from("gallery_albums")
      .update({ is_published: newState })
      .eq("id", album.id);

    if (error) {
      toast.error("Failed to update album");
    } else {
      toast.success(newState ? "Album published" : "Album set to draft");
      router.refresh();
    }
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

  // Get first visible image for fallback
  const firstVisibleImage = images.find((img) => img.is_published && !img.is_hidden);
  const displayCoverUrl = currentCoverUrl || firstVisibleImage?.image_url;

  return (
    <div className="space-y-8">
      {/* Album Details Card */}
      <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Cover Preview */}
          <div className="w-full md:w-48 flex-shrink-0">
            <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
              Album Cover
            </label>
            <div className="relative aspect-[3/2] rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)]">
              {displayCoverUrl ? (
                <Image
                  src={displayCoverUrl}
                  alt={album.name}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-tertiary)]">
                  <span className="text-4xl">📷</span>
                </div>
              )}
            </div>
            {!currentCoverUrl && firstVisibleImage && (
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Using first photo as cover
              </p>
            )}
          </div>

          {/* Album Info */}
          <div className="flex-1 space-y-4">
            {isEditingName ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Album Name
                  </label>
                  <input
                    type="text"
                    value={albumName}
                    onChange={(e) => setAlbumName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={albumDescription}
                    onChange={(e) => setAlbumDescription(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-border-accent)] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDetails}
                    disabled={isSaving}
                    className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setAlbumName(album.name);
                      setAlbumDescription(album.description || "");
                      setIsEditingName(false);
                    }}
                    className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    {album.name}
                  </h2>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    title="Edit album"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--color-text-tertiary)]">/{album.slug}</p>
                {album.description && (
                  <p className="text-[var(--color-text-secondary)] mt-2">{album.description}</p>
                )}
              </div>
            )}

            {/* Status Badges and Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-sm text-[var(--color-text-secondary)]">
                {images.length} {images.length === 1 ? "photo" : "photos"}
              </span>

              {album.is_hidden && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  Hidden by Admin
                </span>
              )}

              <button
                onClick={handleTogglePublish}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  album.is_published
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                }`}
              >
                {album.is_published ? "Published" : "Draft"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Images Grid - Set as Cover */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Album Photos
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Click &quot;Set as cover&quot; on any photo to use it as the album cover.
        </p>

        {images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image) => {
              const isCover = currentCoverUrl === image.image_url;

              return (
                <div
                  key={image.id}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
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
                    className="object-cover"
                  />

                  {/* Cover Badge */}
                  {isCover && (
                    <div className="absolute top-2 left-2">
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
                        onClick={() => handleSetCover(image.image_url)}
                        className="w-full px-3 py-1.5 bg-white/90 hover:bg-white text-gray-900 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <Star className="w-3 h-3" />
                        Set as cover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
            <div className="text-4xl mb-4">📷</div>
            <p className="text-[var(--color-text-secondary)]">No photos in this album yet.</p>
            <p className="text-sm text-[var(--color-text-tertiary)] mt-1">
              Upload photos and add them to this album.
            </p>
          </div>
        )}
      </div>

      {/* Admin Info */}
      {isAdmin && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Admin view:</strong> You are viewing this album as an admin.
            {album.is_hidden && " This album is currently hidden from the public gallery."}
          </p>
        </div>
      )}
    </div>
  );
}
