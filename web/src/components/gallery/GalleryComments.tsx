"use client";

import { CommentThread } from "@/components/comments";

interface GalleryCommentsProps {
  type: "photo" | "album";
  targetId: string;
  /** For photo comments: image uploaded_by */
  imageUploaderId?: string;
  /** For photo comments: album owner if image is in an album */
  albumOwnerId?: string;
}

/**
 * Comments section for gallery photos and albums.
 * Now uses the shared CommentThread component for threading and moderation.
 */
export function GalleryComments({
  type,
  targetId,
  imageUploaderId,
  albumOwnerId,
}: GalleryCommentsProps) {
  const tableName = type === "photo" ? "gallery_photo_comments" : "gallery_album_comments";
  const foreignKey = type === "photo" ? "image_id" : "album_id";

  // For photos, the uploader is primary owner; album owner is secondary
  // For albums, the album owner is the entity owner
  const entityOwnerId = type === "photo" ? imageUploaderId : albumOwnerId;
  const secondaryOwnerId = type === "photo" ? albumOwnerId : undefined;

  // Map type to guest comment type
  const guestCommentType = type === "photo" ? "gallery_photo" : "gallery_album";

  return (
    <CommentThread
      tableName={tableName}
      foreignKey={foreignKey}
      targetId={targetId}
      entityOwnerId={entityOwnerId}
      secondaryOwnerId={secondaryOwnerId}
      showAvatars={false}
      maxHeight="max-h-48"
      guestCommentType={guestCommentType}
    />
  );
}
