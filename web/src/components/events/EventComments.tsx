"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const MAX_COMMENT_LENGTH = 2000;
const POST_COOLDOWN_MS = 2000;

interface CommentUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  slug: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  user_id: string | null;
  guest_name: string | null;
  guest_verified: boolean;
  is_deleted: boolean;
  is_hidden: boolean;
  user: CommentUser | null;
  replies?: Comment[];
}

interface EventCommentsProps {
  eventId: string;
  /** Event host user ID (for moderation) */
  hostId?: string;
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

// Guest comment flow states
type GuestFlowState = "idle" | "form" | "verification" | "success";

/**
 * Guest Comment Form Component
 *
 * Handles the email verification flow for guest comments.
 */
function GuestCommentForm({ eventId, onSuccess }: { eventId: string; onSuccess: () => void }) {
  const [guestFlow, setGuestFlow] = useState<GuestFlowState>("idle");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestComment, setGuestComment] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Request verification code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guest/event-comment/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim().toLowerCase(),
          content: guestComment.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      setVerificationId(data.verification_id);
      setGuestFlow("verification");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  // Verify code and post comment
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/guest/event-comment/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: verificationCode.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      setGuestFlow("success");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  // Reset flow
  const resetGuestFlow = () => {
    setGuestFlow("idle");
    setGuestName("");
    setGuestEmail("");
    setGuestComment("");
    setVerificationId("");
    setVerificationCode("");
    setError("");
  };

  // Idle state: show sign in link + guest option
  if (guestFlow === "idle") {
    return (
      <div className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <p className="text-[var(--color-text-secondary)] mb-3 text-center">
          Sign in to leave a comment
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href={`/login?redirectTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
            className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] transition-colors text-center"
          >
            Sign In
          </a>
          <button
            onClick={() => setGuestFlow("form")}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors"
          >
            Comment as Guest
          </button>
        </div>
      </div>
    );
  }

  // Form state: collect name, email, comment
  if (guestFlow === "form") {
    return (
      <form onSubmit={handleRequestCode} className="space-y-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">Comment as Guest</div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            required
            minLength={2}
            className="px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
          />
          <input
            type="email"
            placeholder="your@email.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            required
            className="px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
          />
        </div>

        <textarea
          placeholder="Share your thoughts..."
          value={guestComment}
          onChange={(e) => setGuestComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          rows={3}
          required
          maxLength={MAX_COMMENT_LENGTH}
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 resize-none"
        />

        <div className="flex justify-between items-center">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {guestComment.length}/{MAX_COMMENT_LENGTH}
          </span>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            We&apos;ll send a verification code to confirm your email.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !guestName.trim() || !guestEmail.trim() || !guestComment.trim()}
            className="flex-1 px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Sending..." : "Send Verification Code"}
          </button>
          <button
            type="button"
            onClick={resetGuestFlow}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Verification state: enter code
  if (guestFlow === "verification") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-3 p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">Enter Verification Code</div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          We sent a 6-digit code to <span className="font-medium">{guestEmail}</span>
        </p>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <input
          type="text"
          placeholder="ABC123"
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6))}
          required
          maxLength={6}
          autoFocus
          className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-sm text-[var(--color-text-primary)] text-center tracking-widest font-mono placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className="flex-1 px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Verifying..." : "Verify & Post Comment"}
          </button>
          <button
            type="button"
            onClick={resetGuestFlow}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg font-medium hover:bg-[var(--color-bg-primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  // Success state
  return (
    <div className="p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-emerald-300 font-semibold">Comment Posted!</p>
          <p className="text-emerald-400/80 text-sm">Thanks for sharing your thoughts.</p>
        </div>
      </div>
      <button
        onClick={resetGuestFlow}
        className="mt-3 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        Post another comment
      </button>
    </div>
  );
}

/**
 * Event Comments Component
 *
 * Phase 4.49b: Comments for all events (DSC + community)
 * Supports both member comments and guest comments (via verification)
 */
export function EventComments({ eventId, hostId }: EventCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();

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

  // Fetch comments via API
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load comments");
      }

      // Normalize the data - handle array author from supabase join
      const normalized: Comment[] = (data || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        parent_id: c.parent_id,
        user_id: c.user_id,
        guest_name: c.guest_name,
        guest_verified: c.guest_verified ?? false,
        is_deleted: c.is_deleted ?? false,
        is_hidden: c.is_hidden ?? false,
        user: Array.isArray(c.user) ? c.user[0] ?? null : c.user,
      }));

      // Organize into threads
      const threadedComments = organizeIntoThreads(normalized);
      setComments(threadedComments);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
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

  // Post a new comment via API
  async function handleSubmit(e: React.FormEvent, parentId: string | null = null) {
    e.preventDefault();
    const content = parentId ? replyContent.trim() : newComment.trim();
    if (!content || !currentUserId || cooldown) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      toast.error(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parent_id: parentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post comment");
      }

      if (parentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }

      // Refetch to show new comment
      fetchComments();

      // Start cooldown
      setCooldown(true);
      cooldownTimerRef.current = setTimeout(() => {
        setCooldown(false);
      }, POST_COOLDOWN_MS);
    } catch (err) {
      console.error("Error posting comment:", err);
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  // Delete (soft delete) a comment
  async function handleDelete(commentId: string) {
    const { error: deleteError } = await supabase
      .from("event_comments")
      .update({ is_deleted: true })
      .eq("id", commentId);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      toast.error("Failed to delete comment");
    } else {
      toast.success("Comment deleted");
      fetchComments();
    }
  }

  // Hide/unhide a comment (owner moderation)
  async function handleToggleHidden(commentId: string, currentlyHidden: boolean) {
    const { error: updateError } = await supabase
      .from("event_comments")
      .update({
        is_hidden: !currentlyHidden,
        hidden_by: !currentlyHidden ? currentUserId : null,
      })
      .eq("id", commentId);

    if (updateError) {
      console.error("Error toggling comment visibility:", updateError);
      toast.error("Failed to update comment");
    } else {
      toast.success(currentlyHidden ? "Comment unhidden" : "Comment hidden");
      fetchComments();
    }
  }

  // Check permissions
  function canDelete(comment: Comment): boolean {
    if (!currentUserId) return false;
    if (comment.user_id === currentUserId) return true;
    if (isAdmin) return true;
    return false;
  }

  function canModerate(): boolean {
    if (!currentUserId) return false;
    if (isAdmin) return true;
    if (hostId === currentUserId) return true;
    return false;
  }

  // Get total comment count (including replies)
  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  // Get display name and link for a comment
  function getCommentAuthor(comment: Comment): { name: string; link: string | null; isGuest: boolean } {
    if (comment.guest_name) {
      return { name: comment.guest_name, link: null, isGuest: true };
    }
    if (comment.user) {
      const profileUrl = `/songwriters/${comment.user.slug || comment.user.id}`;
      return { name: comment.user.full_name || "Member", link: profileUrl, isGuest: false };
    }
    return { name: "Anonymous", link: null, isGuest: false };
  }

  // Render a single comment
  function renderComment(comment: Comment, isReply = false) {
    const { name, link, isGuest } = getCommentAuthor(comment);
    const isAuthor = comment.user_id === currentUserId;
    const isDeleted = comment.is_deleted;
    const isHidden = comment.is_hidden;

    return (
      <div key={comment.id} className={`group ${isReply ? "ml-6 pl-3 border-l-2 border-[var(--color-border-default)]" : ""}`}>
        <div className={`flex gap-3 text-sm ${isDeleted || isHidden ? "opacity-50" : ""}`}>
          {/* Avatar */}
          <div className="flex-shrink-0">
            {!isGuest && comment.user?.avatar_url ? (
              <Image
                src={comment.user.avatar_url}
                alt={name}
                width={isReply ? 28 : 36}
                height={isReply ? 28 : 36}
                className="rounded-full object-cover object-top"
              />
            ) : (
              <div className={`${isReply ? "w-7 h-7" : "w-9 h-9"} rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center`}>
                <span className="text-[var(--color-text-accent)] text-xs font-medium">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              {link ? (
                <Link href={link} className="font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-accent)]">
                  {name}
                </Link>
              ) : (
                <span className="font-medium text-[var(--color-text-primary)]">{name}</span>
              )}
              {isGuest && (
                <span className="text-xs text-[var(--color-text-tertiary)]">(guest)</span>
              )}
              <span className="text-[var(--color-text-tertiary)] text-xs">
                {formatTimeAgo(comment.created_at)}
              </span>
              {isDeleted && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">deleted</span>
              )}
              {isHidden && !isDeleted && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">hidden</span>
              )}
            </div>
            <p className={`text-[var(--color-text-secondary)] break-words mt-1 ${isDeleted ? "line-through" : ""}`}>
              {isDeleted ? "[deleted]" : comment.content}
            </p>

            {/* Actions row */}
            {!isDeleted && currentUserId && (
              <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Reply button (only for top-level) */}
                {!isReply && (
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
                {/* Delete button */}
                {canDelete(comment) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
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
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-3 ml-9 flex gap-2">
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
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section id="comments" className="mt-8 pt-8 border-t border-[var(--color-border-default)]">
      <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-4">
        Comments {totalCount > 0 && <span className="text-[var(--color-text-secondary)] font-normal">({totalCount})</span>}
      </h2>

      {/* Error state */}
      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {/* Comments list */}
      <div className="space-y-4 mb-6">
        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)] italic">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>

      {/* Comment input */}
      {currentUserId ? (
        <form onSubmit={(e) => handleSubmit(e, null)} className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="Share your thoughts..."
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            disabled={submitting || cooldown}
            className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 resize-none disabled:opacity-50"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {newComment.length}/{MAX_COMMENT_LENGTH}
            </span>
            <button
              type="submit"
              disabled={submitting || cooldown || !newComment.trim()}
              className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] rounded-lg font-medium hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Posting..." : cooldown ? "Wait..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <GuestCommentForm eventId={eventId} onSuccess={fetchComments} />
      )}
    </section>
  );
}
