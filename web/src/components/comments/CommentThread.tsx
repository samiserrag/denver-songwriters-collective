"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { GuestCommentForm, type GuestCommentType } from "./GuestCommentForm";

const MAX_COMMENT_LENGTH = 500;
const POST_COOLDOWN_MS = 2000;

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  user_id?: string;
  author_id?: string;
  parent_id: string | null;
  is_deleted: boolean;
  is_hidden: boolean;
  author: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  // Guest comment fields
  guest_name?: string | null;
  guest_verified?: boolean;
  replies?: Comment[];
}

export interface CommentThreadProps {
  /** Table name for comments */
  tableName: "gallery_photo_comments" | "gallery_album_comments" | "blog_comments" | "open_mic_comments" | "profile_comments" | "event_comments";
  /** Foreign key column name (e.g., "image_id", "album_id", "post_id", "event_id", "profile_id") */
  foreignKey: string;
  /** ID of the entity being commented on */
  targetId: string;
  /** User ID of the entity owner (for moderation) */
  entityOwnerId?: string;
  /** Additional owner ID (e.g., image uploader for photo comments) */
  secondaryOwnerId?: string;
  /** Show avatars in comments */
  showAvatars?: boolean;
  /** Max height of comment container */
  maxHeight?: string;
  /** Guest comment type for enabling guest comments (optional, disables guest comments if not provided) */
  guestCommentType?: GuestCommentType;
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

/** Organize flat comments into threaded structure */
function organizeIntoThreads(comments: Comment[]): Comment[] {
  const topLevel: Comment[] = [];
  const childrenMap = new Map<string, Comment[]>();

  // Group replies by parent
  for (const comment of comments) {
    if (comment.parent_id) {
      const children = childrenMap.get(comment.parent_id) || [];
      children.push(comment);
      childrenMap.set(comment.parent_id, children);
    } else {
      topLevel.push({ ...comment, replies: [] });
    }
  }

  // Attach replies to parents
  for (const parent of topLevel) {
    parent.replies = childrenMap.get(parent.id) || [];
    // Sort replies chronologically
    parent.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // Sort top-level chronologically
  topLevel.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return topLevel;
}

export function CommentThread({
  tableName,
  foreignKey,
  targetId,
  entityOwnerId,
  secondaryOwnerId,
  showAvatars = false,
  maxHeight = "max-h-96",
  guestCommentType,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Guest delete state
  const [guestDeleteComment, setGuestDeleteComment] = useState<Comment | null>(null);
  const [guestDeleteEmail, setGuestDeleteEmail] = useState("");
  const [guestDeleteCode, setGuestDeleteCode] = useState("");
  const [guestDeleteStep, setGuestDeleteStep] = useState<"email" | "code">("email");
  const [guestDeleteVerificationId, setGuestDeleteVerificationId] = useState<string | null>(null);
  const [guestDeleteLoading, setGuestDeleteLoading] = useState(false);

  const supabase = createClient();

  // Determine user ID column based on table
  const userIdColumn = tableName === "blog_comments" || tableName === "profile_comments" ? "author_id" : "user_id";
  const profileJoinKey = tableName === "blog_comments"
    ? "blog_comments_author_id_fkey"
    : tableName === "profile_comments"
    ? "profile_comments_author_id_fkey"
    : `${tableName}_user_id_fkey`;

  // Fetch current user and admin status
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
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

    // Build query based on table columns
    const query = supabase
      .from(tableName)
      .select(`
        id,
        content,
        created_at,
        edited_at,
        ${userIdColumn},
        parent_id,
        is_deleted,
        is_hidden,
        guest_name,
        guest_verified,
        author:profiles!${profileJoinKey}(id, full_name, avatar_url)
      `)
      .eq(foreignKey, targetId)
      .order("created_at", { ascending: true });

    // Filter out deleted/hidden for non-managers (done client-side for simplicity)
    const { data, error } = await query;

    if (error) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
      setLoading(false);
      return;
    }

    // Normalize and filter
    const normalizedComments: Comment[] = (data || []).map((c: any) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      edited_at: c.edited_at ?? null,
      user_id: c[userIdColumn],
      author_id: c[userIdColumn],
      parent_id: c.parent_id,
      is_deleted: c.is_deleted ?? false,
      is_hidden: c.is_hidden ?? false,
      author: Array.isArray(c.author) ? c.author[0] ?? null : c.author,
      guest_name: c.guest_name,
      guest_verified: c.guest_verified ?? false,
    }));

    // Filter visible comments (show deleted/hidden only to managers)
    const visibleComments = normalizedComments.filter((c) => {
      // Always show to author
      if (c.user_id === currentUserId || c.author_id === currentUserId) return true;
      // Always show to admin
      if (isAdmin) return true;
      // Always show to entity owner
      if (entityOwnerId === currentUserId) return true;
      if (secondaryOwnerId === currentUserId) return true;
      // Hide deleted/hidden from others
      return !c.is_deleted && !c.is_hidden;
    });

    // Organize into threads
    const threadedComments = organizeIntoThreads(visibleComments);
    setComments(threadedComments);
    setLoading(false);
  }, [supabase, tableName, foreignKey, targetId, userIdColumn, profileJoinKey, currentUserId, isAdmin, entityOwnerId, secondaryOwnerId]);

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

  // Post a new comment
  async function handleSubmit(e: React.FormEvent, parentId: string | null = null) {
    e.preventDefault();
    const content = parentId ? replyContent.trim() : newComment.trim();
    if (!content || !currentUserId || cooldown) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);

    const insertData: Record<string, unknown> = {
      [foreignKey]: targetId,
      [userIdColumn]: currentUserId,
      content,
      parent_id: parentId,
    };

    const { error } = await supabase
      .from(tableName)
      .insert(insertData);

    if (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment");
    } else {
      if (parentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }
      fetchComments();
      setCooldown(true);
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown(false);
      }, POST_COOLDOWN_MS);
    }
    setSubmitting(false);
  }

  // Delete (soft delete) a comment
  async function handleDelete(commentId: string) {
    const { error } = await supabase
      .from(tableName)
      .update({ is_deleted: true })
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    } else {
      toast.success("Comment deleted");
      fetchComments();
    }
  }

  // Hide/unhide a comment (owner moderation)
  async function handleToggleHidden(commentId: string, currentlyHidden: boolean) {
    const { error } = await supabase
      .from(tableName)
      .update({
        is_hidden: !currentlyHidden,
        hidden_by: !currentlyHidden ? currentUserId : null,
      })
      .eq("id", commentId);

    if (error) {
      console.error("Error toggling comment visibility:", error);
      toast.error("Failed to update comment");
    } else {
      toast.success(currentlyHidden ? "Comment unhidden" : "Comment hidden");
      fetchComments();
    }
  }

  // Edit a comment
  async function handleEdit(e: React.FormEvent, commentId: string) {
    e.preventDefault();
    const content = editContent.trim();
    if (!content || !currentUserId) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, content }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to edit comment");
      } else {
        toast.success("Comment updated");
        setEditingId(null);
        setEditContent("");
        fetchComments();
      }
    } catch (error) {
      console.error("Error editing comment:", error);
      toast.error("Failed to edit comment");
    }

    setSubmitting(false);
  }

  // Start editing a comment
  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setEditContent(comment.content);
    // Cancel any reply in progress
    setReplyingTo(null);
    setReplyContent("");
  }

  // Cancel editing
  function cancelEditing() {
    setEditingId(null);
    setEditContent("");
  }

  // Guest delete functions
  function openGuestDeleteModal(comment: Comment) {
    setGuestDeleteComment(comment);
    setGuestDeleteEmail("");
    setGuestDeleteCode("");
    setGuestDeleteStep("email");
    setGuestDeleteVerificationId(null);
  }

  function closeGuestDeleteModal() {
    setGuestDeleteComment(null);
    setGuestDeleteEmail("");
    setGuestDeleteCode("");
    setGuestDeleteStep("email");
    setGuestDeleteVerificationId(null);
  }

  async function handleGuestDeleteRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (!guestDeleteComment || !guestDeleteEmail.trim()) return;

    setGuestDeleteLoading(true);
    try {
      const response = await fetch("/api/guest/comment-delete/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment_id: guestDeleteComment.id,
          table_name: tableName,
          guest_email: guestDeleteEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send verification code");
      } else {
        toast.success("Verification code sent to your email");
        setGuestDeleteVerificationId(data.verification_id);
        setGuestDeleteStep("code");
      }
    } catch (error) {
      console.error("Guest delete request error:", error);
      toast.error("Failed to send verification code");
    }
    setGuestDeleteLoading(false);
  }

  async function handleGuestDeleteVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!guestDeleteVerificationId || !guestDeleteCode.trim()) return;

    setGuestDeleteLoading(true);
    try {
      const response = await fetch("/api/guest/comment-delete/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: guestDeleteVerificationId,
          code: guestDeleteCode.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Invalid code");
      } else {
        toast.success("Comment deleted");
        closeGuestDeleteModal();
        fetchComments();
      }
    } catch (error) {
      console.error("Guest delete verify error:", error);
      toast.error("Failed to verify code");
    }
    setGuestDeleteLoading(false);
  }

  // Check permissions
  function canDelete(comment: Comment): boolean {
    if (!currentUserId) return false;
    const authorId = comment.user_id || comment.author_id;
    if (authorId === currentUserId) return true;
    if (isAdmin) return true;
    return false;
  }

  function canGuestDelete(comment: Comment): boolean {
    // Guest comments can be deleted by the guest (via email verification)
    // Only show if not logged in OR if the logged-in user isn't the admin
    const authorId = comment.user_id || comment.author_id;
    if (authorId) return false; // Not a guest comment
    if (!comment.guest_name) return false; // No guest name
    return true;
  }

  function canEdit(comment: Comment): boolean {
    if (!currentUserId) return false;
    const authorId = comment.user_id || comment.author_id;
    // Only the author can edit (not admin, not moderator)
    // Guest comments cannot be edited (no way to re-authenticate)
    if (!authorId) return false; // Guest comment
    if (authorId === currentUserId) return true;
    return false;
  }

  function canModerate(): boolean {
    if (!currentUserId) return false;
    if (isAdmin) return true;
    if (entityOwnerId === currentUserId) return true;
    if (secondaryOwnerId === currentUserId) return true;
    return false;
  }

  // Get total comment count (including replies)
  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  // Render a single comment
  function renderComment(comment: Comment, isReply = false) {
    const authorId = comment.user_id || comment.author_id;
    const isAuthor = authorId === currentUserId;
    const isDeleted = comment.is_deleted;
    const isHidden = comment.is_hidden;
    const isGuestComment = !authorId && comment.guest_name;
    const displayName = isGuestComment
      ? `${comment.guest_name} (guest)`
      : comment.author?.full_name || "Member";
    const avatarInitial = isGuestComment
      ? comment.guest_name?.[0] ?? "G"
      : comment.author?.full_name?.[0] ?? "?";

    return (
      <div key={comment.id} className={`group ${isReply ? "ml-6 pl-3 border-l-2 border-[var(--color-border-default)]" : ""}`}>
        <div className={`flex gap-2 text-sm ${isDeleted || isHidden ? "opacity-50" : ""}`}>
          {showAvatars && (
            <div className="flex-shrink-0">
              {comment.author?.avatar_url && !isGuestComment ? (
                <Image
                  src={comment.author.avatar_url}
                  alt={comment.author.full_name ?? "Member"}
                  width={32}
                  height={32}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                  <span className="text-[var(--color-text-accent)] text-xs">
                    {avatarInitial}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-[var(--color-text-primary)]">
                {displayName}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-xs">
                {formatTimeAgo(comment.created_at)}
              </span>
              {comment.edited_at && !isDeleted && (
                <span className="text-xs text-[var(--color-text-tertiary)] italic">(edited)</span>
              )}
              {isDeleted && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">deleted</span>
              )}
              {isHidden && !isDeleted && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">hidden</span>
              )}
            </div>

            {/* Show edit form or content */}
            {editingId === comment.id ? (
              <form onSubmit={(e) => handleEdit(e, comment.id)} className="mt-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                  maxLength={MAX_COMMENT_LENGTH}
                  disabled={submitting}
                  autoFocus
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 disabled:opacity-50 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={submitting || !editContent.trim()}
                    className="px-3 py-1.5 text-sm bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className={`text-[var(--color-text-secondary)] break-words ${isDeleted ? "line-through" : ""}`}>
                {isDeleted ? "[deleted]" : comment.content}
              </p>
            )}

            {/* Actions row - hide if editing */}
            {!isDeleted && editingId !== comment.id && (currentUserId || canGuestDelete(comment)) && (
              <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Edit button - shows first for author's own comments */}
                {canEdit(comment) && (
                  <button
                    onClick={() => startEditing(comment)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)]"
                  >
                    Edit
                  </button>
                )}
                {/* Reply button */}
                {!isReply && currentUserId && (
                  <button
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)]"
                  >
                    Reply
                  </button>
                )}
                {/* Hide/Unhide button (for moderators) */}
                {canModerate() && !isAuthor && (
                  <button
                    onClick={() => handleToggleHidden(comment.id, isHidden)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-amber-400"
                  >
                    {isHidden ? "Unhide" : "Hide"}
                  </button>
                )}
                {/* Delete button for logged-in users */}
                {canDelete(comment) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
                {/* Delete button for guest comments (opens verification modal) */}
                {canGuestDelete(comment) && !canDelete(comment) && (
                  <button
                    onClick={() => openGuestDeleteModal(comment)}
                    className="text-xs text-[var(--color-text-tertiary)] hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && currentUserId && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-2 ml-6 flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              placeholder="Write a reply..."
              maxLength={MAX_COMMENT_LENGTH}
              disabled={submitting || cooldown}
              autoFocus
              className="flex-1 px-3 py-1.5 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={submitting || cooldown || !replyContent.trim()}
              className="px-3 py-1.5 text-sm bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "..." : "Reply"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setReplyContent("");
              }}
              className="px-2 py-1.5 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
      <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
        Comments {totalCount > 0 && `(${totalCount})`}
      </h4>

      {/* Comments list */}
      <div className={`space-y-3 ${maxHeight} overflow-y-auto`}>
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)] italic">
            No comments yet — be the first to say something.
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      {/* Comment input */}
      {currentUserId ? (
        <form onSubmit={(e) => handleSubmit(e, null)} className="mt-3 flex gap-2">
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
      ) : guestCommentType ? (
        <div className="mt-3">
          <GuestCommentForm
            type={guestCommentType}
            targetId={targetId}
            onSuccess={fetchComments}
          />
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
          <a href="/login" className="text-[var(--color-text-accent)] hover:underline">Sign in</a> to leave a comment.
        </p>
      )}

      {/* Guest Delete Modal */}
      {guestDeleteComment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              Delete Your Comment
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {guestDeleteStep === "email"
                ? "Enter the email you used when posting this comment. We'll send you a verification code."
                : "Enter the 6-digit code sent to your email."}
            </p>

            {guestDeleteStep === "email" ? (
              <form onSubmit={handleGuestDeleteRequestCode} className="space-y-4">
                <input
                  type="email"
                  value={guestDeleteEmail}
                  onChange={(e) => setGuestDeleteEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={guestDeleteLoading}
                  autoFocus
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 disabled:opacity-50"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeGuestDeleteModal}
                    disabled={guestDeleteLoading}
                    className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={guestDeleteLoading || !guestDeleteEmail.trim()}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {guestDeleteLoading ? "Sending..." : "Send Code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleGuestDeleteVerifyCode} className="space-y-4">
                <input
                  type="text"
                  value={guestDeleteCode}
                  onChange={(e) => setGuestDeleteCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))}
                  placeholder="ABC123"
                  disabled={guestDeleteLoading}
                  autoFocus
                  maxLength={6}
                  className="w-full px-3 py-2 text-sm bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 disabled:opacity-50 text-center tracking-widest font-mono text-lg"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setGuestDeleteStep("email")}
                    disabled={guestDeleteLoading}
                    className="px-4 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={guestDeleteLoading || guestDeleteCode.length !== 6}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {guestDeleteLoading ? "Deleting..." : "Delete Comment"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
