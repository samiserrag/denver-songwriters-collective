"use client";

import { GalleryComments } from "@/components/gallery";

interface AlbumCommentsSectionProps {
  albumId: string;
  albumOwnerId: string | null;
}

export function AlbumCommentsSection({ albumId, albumOwnerId }: AlbumCommentsSectionProps) {
  return (
    <div className="mb-8 p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
      <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
        Album Discussion
      </h3>
      <GalleryComments
        type="album"
        targetId={albumId}
        albumOwnerId={albumOwnerId ?? undefined}
      />
    </div>
  );
}
