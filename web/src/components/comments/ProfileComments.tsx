"use client";

import { CommentThread } from "./CommentThread";

interface ProfileCommentsProps {
  profileId: string;
  profileOwnerId: string;
}

/**
 * Comments section for member profiles.
 * Supports threaded replies and owner moderation.
 */
export function ProfileComments({ profileId, profileOwnerId }: ProfileCommentsProps) {
  return (
    <section className="mt-12 pt-8 border-t border-[var(--color-border-default)]">
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-4">Comments</h2>
      <CommentThread
        tableName="profile_comments"
        foreignKey="profile_id"
        targetId={profileId}
        entityOwnerId={profileOwnerId}
        showAvatars={true}
        maxHeight="max-h-[500px]"
      />
    </section>
  );
}
