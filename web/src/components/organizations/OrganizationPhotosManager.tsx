"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import { Check, Loader2, Trash2, X, ZoomIn } from "lucide-react";
import Image from "next/image";

type OrganizationImageRow = {
  id: string;
  organization_id: string;
  image_url: string;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

type OrganizationImage = {
  id: string;
  image_url: string;
  storage_path: string | null;
  deleted_at: string | null;
  created_at: string;
  isLegacy: boolean;
};

type PhotosChangePayload = {
  logoImageUrl: string;
  coverImageUrl: string;
  galleryImageUrls: string[];
};

type Props = {
  organizationId?: string;
  organizationName: string;
  editorUserId?: string | null;
  logoImageUrl: string;
  coverImageUrl: string;
  galleryImageUrls: string[];
  onChange: (payload: PhotosChangePayload) => void;
};

function normalizeUrl(url: string): string {
  return url.split("?")[0]?.trim().toLowerCase() || "";
}

function buildLegacyImages(urls: string[]): OrganizationImage[] {
  return urls
    .filter((url) => url.trim().length > 0)
    .map((url, index) => ({
      id: `legacy-${index}-${normalizeUrl(url)}`,
      image_url: url,
      storage_path: null,
      deleted_at: null,
      created_at: new Date(0).toISOString(),
      isLegacy: true,
    }));
}

export function OrganizationPhotosManager({
  organizationId,
  organizationName,
  editorUserId,
  logoImageUrl,
  coverImageUrl,
  galleryImageUrls,
  onChange,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [images, setImages] = useState<OrganizationImage[]>(buildLegacyImages(galleryImageUrls));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingCoverId, setSettingCoverId] = useState<string | null>(null);
  const [settingLogoId, setSettingLogoId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyPhotoState = useCallback(
    (
      nextImages: OrganizationImage[],
      overrides?: {
        coverImageUrl?: string;
        logoImageUrl?: string;
      }
    ) => {
      const nextGalleryImageUrls = nextImages
        .filter((img) => !img.deleted_at)
        .map((img) => img.image_url);

      onChange({
        galleryImageUrls: nextGalleryImageUrls,
        coverImageUrl: overrides?.coverImageUrl ?? coverImageUrl,
        logoImageUrl: overrides?.logoImageUrl ?? logoImageUrl,
      });
    },
    [onChange, coverImageUrl, logoImageUrl]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      if (!organizationId) {
        const legacyImages = buildLegacyImages(galleryImageUrls);
        setImages(legacyImages);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await (supabase as any)
          .from("organization_images")
          .select("id, organization_id, image_url, storage_path, uploaded_by, created_at, deleted_at")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        if (cancelled) return;

        const uploadedImages: OrganizationImage[] = ((data || []) as OrganizationImageRow[]).map((row) => ({
          id: row.id,
          image_url: row.image_url,
          storage_path: row.storage_path,
          deleted_at: row.deleted_at,
          created_at: row.created_at,
          isLegacy: false,
        }));

        const uploadedByNormalizedUrl = new Set(
          uploadedImages.map((img) => normalizeUrl(img.image_url)).filter(Boolean)
        );

        const legacyOnly = buildLegacyImages(galleryImageUrls).filter(
          (img) => !uploadedByNormalizedUrl.has(normalizeUrl(img.image_url))
        );

        setImages([...uploadedImages, ...legacyOnly]);
      } catch (err) {
        console.error("[OrganizationPhotosManager] load images error:", err);
        if (!cancelled) {
          setError("Could not load photos. You can still save text changes.");
          setImages(buildLegacyImages(galleryImageUrls));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadImages();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const activeImages = useMemo(() => images.filter((img) => !img.deleted_at), [images]);

  const handleUpload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!organizationId) {
        toast.error("Create this organization first, then upload photos.");
        return null;
      }

      const hasNoCover = !coverImageUrl;
      const isFirstImage = activeImages.length === 0;

      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const storagePath = `organizations/${organizationId}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(storagePath, file, { upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("avatars").getPublicUrl(storagePath);

        const { data: inserted, error: insertError } = await (supabase as any)
          .from("organization_images")
          .insert({
            organization_id: organizationId,
            image_url: publicUrl,
            storage_path: storagePath,
            uploaded_by: editorUserId || null,
          })
          .select("id, organization_id, image_url, storage_path, uploaded_by, created_at, deleted_at")
          .single();

        if (insertError) {
          await supabase.storage.from("avatars").remove([storagePath]);
          throw insertError;
        }

        const nextImage: OrganizationImage = {
          id: inserted.id,
          image_url: inserted.image_url,
          storage_path: inserted.storage_path,
          deleted_at: inserted.deleted_at,
          created_at: inserted.created_at,
          isLegacy: false,
        };

        const nextImages = [...activeImages, nextImage];
        setImages(nextImages);

        if (hasNoCover && isFirstImage) {
          applyPhotoState(nextImages, { coverImageUrl: nextImage.image_url });
          toast.success("Photo uploaded and set as cover.");
        } else {
          applyPhotoState(nextImages);
          toast.success("Photo uploaded.");
        }

        return nextImage.image_url;
      } catch (err) {
        console.error("[OrganizationPhotosManager] upload error:", err);
        toast.error("Failed to upload photo.");
        return null;
      }
    },
    [organizationId, coverImageUrl, activeImages, supabase, editorUserId, applyPhotoState]
  );

  const handleDelete = useCallback(
    async (image: OrganizationImage) => {
      setDeletingId(image.id);
      try {
        if (!image.isLegacy) {
          const { error: updateError } = await (supabase as any)
            .from("organization_images")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", image.id);

          if (updateError) {
            throw updateError;
          }

          if (image.storage_path) {
            await supabase.storage.from("avatars").remove([image.storage_path]);
          }
        }

        const nextImages = activeImages.filter((item) => item.id !== image.id);
        setImages(nextImages);

        const nextCover =
          normalizeUrl(coverImageUrl) === normalizeUrl(image.image_url)
            ? nextImages[0]?.image_url || ""
            : coverImageUrl;

        const nextLogo =
          normalizeUrl(logoImageUrl) === normalizeUrl(image.image_url)
            ? ""
            : logoImageUrl;

        applyPhotoState(nextImages, {
          coverImageUrl: nextCover,
          logoImageUrl: nextLogo,
        });

        toast.success("Photo removed.");
      } catch (err) {
        console.error("[OrganizationPhotosManager] delete error:", err);
        toast.error("Failed to remove photo.");
      } finally {
        setDeletingId(null);
      }
    },
    [activeImages, coverImageUrl, logoImageUrl, applyPhotoState, supabase]
  );

  const handleSetCover = useCallback(
    (image: OrganizationImage) => {
      setSettingCoverId(image.id);
      applyPhotoState(activeImages, { coverImageUrl: image.image_url });
      setTimeout(() => setSettingCoverId(null), 150);
    },
    [activeImages, applyPhotoState]
  );

  const handleSetLogo = useCallback(
    (image: OrganizationImage) => {
      setSettingLogoId(image.id);
      applyPhotoState(activeImages, { logoImageUrl: image.image_url });
      setTimeout(() => setSettingLogoId(null), 150);
    },
    [activeImages, applyPhotoState]
  );

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border-default)] p-4 bg-[var(--color-bg-tertiary)]/50 md:col-span-2">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Photos</h4>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Upload multiple photos. The first uploaded photo becomes the default cover if no cover is set. You can change cover/logo any time.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          Uploads are saved immediately. Use the form Save action to persist cover/logo/gallery selection on the organization card.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {!organizationId && (
        <div className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          Save this organization first, then return here to upload photos.
        </div>
      )}

      <div className="max-w-xs">
        <ImageUpload
          onUpload={handleUpload}
          aspectRatio={4 / 3}
          maxSizeMB={10}
          shape="square"
          placeholderText={organizationId ? "Add Photo" : "Create First"}
          className="w-full"
        />
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">Loading photos...</p>
      ) : activeImages.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {activeImages.map((image) => {
            const isCover = normalizeUrl(coverImageUrl) === normalizeUrl(image.image_url);
            const isLogo = normalizeUrl(logoImageUrl) === normalizeUrl(image.image_url);
            const isDeleting = deletingId === image.id;
            const isSettingCover = settingCoverId === image.id;
            const isSettingLogo = settingLogoId === image.id;

            return (
              <div
                key={image.id}
                className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 group transition-all ${
                  isCover
                    ? "border-[var(--color-border-accent)] ring-2 ring-[var(--color-accent-primary)]/30"
                    : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/50"
                }`}
              >
                <Image
                  src={image.image_url}
                  alt={`${organizationName} photo`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                />

                <div className="absolute top-1 left-1 flex flex-wrap gap-1">
                  {isCover && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]">
                      Cover
                    </span>
                  )}
                  {isLogo && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-600 text-white">
                      Logo
                    </span>
                  )}
                </div>

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLightboxImage(image.image_url)}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    title="View full size"
                  >
                    <ZoomIn className="w-4 h-4 text-white" />
                  </button>

                  {!isCover && (
                    <button
                      type="button"
                      onClick={() => handleSetCover(image)}
                      disabled={isSettingCover}
                      className="p-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] rounded-full transition-colors disabled:opacity-50"
                      title="Set as cover"
                    >
                      {isSettingCover ? (
                        <Loader2 className="w-4 h-4 text-[var(--color-text-on-accent)] animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-[var(--color-text-on-accent)]" />
                      )}
                    </button>
                  )}

                  {!isLogo && (
                    <button
                      type="button"
                      onClick={() => handleSetLogo(image)}
                      disabled={isSettingLogo}
                      className="px-2 py-1 bg-sky-600 hover:bg-sky-500 rounded text-[10px] font-medium text-white disabled:opacity-50"
                      title="Set as logo"
                    >
                      {isSettingLogo ? "..." : "Logo"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(image)}
                    disabled={isDeleting}
                    className="p-2 bg-red-600/90 hover:bg-red-500 rounded-full transition-colors disabled:opacity-50"
                    title="Remove photo"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-[var(--color-accent-primary)] transition-colors"
              aria-label="Close lightbox"
            >
              <X className="w-6 h-6" />
            </button>
            <Image
              src={lightboxImage}
              alt="Full-size organization photo"
              width={1600}
              height={1200}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              priority
            />
          </div>
        </div>
      )}

      {/* Keep parity with other photo sections that maintain a hidden input ref. */}
      <input ref={fileInputRef} type="file" className="hidden" aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
