"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const MAX_COMMENT_LENGTH = 500;
const POST_COOLDOWN_MS = 2000;

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: { full_name: string | null } | null;
}

interface GalleryCommentsProps {
  type: "photo" | "album";
  targetId: string;
  // For photo comments: image uploaded_by
  imageUploaderId?: string;
  // For photo comments: album owner if image is in an album
  albumOwnerId?: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Denver" });
}

export function GalleryComments({
  type,
  targetId,
  imageUploaderId,
  albumOwnerId,
}: GalleryCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();
  const tableName = type === "photo" ? "gallery_photo_comments" : "gallery_album_comments";
  const foreignKey = type === "photo" ? "image_id" : "album_id";

  // Fetch current user and admin status
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        // Check admin status
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setIsAdmin(profile?.role === "admin");
      }
    }
    fetchUser();
  }, [supabase]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        id,
        content,
        created_at,
        user_id,
        author:profiles!${tableName}_user_id_fkey(full_name)
      `)
      .eq(foreignKey, targetId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    } else {
      // Normalize author array join
      const normalizedComments = (data || []).map((c: any) => ({
        ...c,
        author: Array.isArray(c.author) ? c.author[0] ?? null : c.author,
      }));
      setComments(normalizedComments);
    }
    setLoading(false);
  }, [supabase, tableName, foreignKey, targetId]);

  useEffect(() => {
    // Data fetching on mount - this is the correct pattern for initial data load
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchComments();
  }, [fetchComments]);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  // Post a new comment with anti-spam cooldown
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed || !currentUserId || cooldown) return;

    // Enforce max length
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);
    const insertData = type === "photo"
      ? { image_id: targetId, user_id: currentUserId, content: trimmed }
      : { album_id: targetId, user_id: currentUserId, content: trimmed };

    const { error } = await supabase
      .from(tableName)
      .insert(insertData);

    if (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } else {
      setNewComment("");
      fetchComments();
      // Start cooldown to prevent spam
      setCooldown(true);
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown(false);
      }, POST_COOLDOWN_MS);
    }
    setSubmitting(false);
  }

  // Delete (soft delete) a comment with optimistic UI update
  async function handleDelete(commentId: string) {
    // Optimistically remove from UI immediately
    const previousComments = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));

    const { error } = await supabase
      .from(tableName)
      .update({ is_deleted: true })
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
      // Revert optimistic update on failure
      setComments(previousComments);
      toast.error("You don't have permission to delete this comment");
    } else {
      toast.success("Comment deleted");
    }
  }

  // Check if current user can delete a comment
  function canDelete(comment: Comment): boolean {
    if (!currentUserId) return false;
    // Author can delete
    if (comment.user_id === currentUserId) return true;
    // Admin can delete
    if (isAdmin) return true;
    // Image uploader can delete (for photo comments)
    if (type === "photo" && imageUploaderId === currentUserId) return true;
    // Album owner can delete
    if (albumOwnerId === currentUserId) return true;
    return false;
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
        Comments {comments.length > 0 && `(${comments.length})`}
      </h4>

      {/* Comments list */}
      <div className="space-y-3 max-h-48 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)] italic">
            No comments yet — be the first to say something.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="group flex gap-2 text-sm">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {comment.author?.full_name || "Member"}
                  </span>
                  <span className="text-[var(--color-text-tertiary)] text-xs">
                    {formatTimeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="text-[var(--color-text-secondary)] break-words">
                  {comment.content}
                </p>
              </div>
              {canDelete(comment) && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-tertiary)] hover:text-red-400 transition-opacity"
                  aria-label="Delete comment"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Comment input - only show if logged in */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Add a comment..."
            maxLength={MAX_COMMENT_LENGTH}
            disabled={submitting || cooldown}
            className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting || cooldown || !newComment.trim()}
            className="px-4 py-2 text-sm bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "..." : cooldown ? "Wait" : "Post"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
          <a href="/login" className="text-[var(--color-text-accent)] hover:underline">Sign in</a> to leave a comment.
        </p>
      )}
    </div>
  );
}
