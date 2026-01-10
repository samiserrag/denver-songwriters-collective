"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { GuestCommentForm } from "@/components/comments/GuestCommentForm";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  // Guest comment fields
  guest_name?: string | null;
  guest_verified?: boolean;
  replies?: Comment[];
}

interface BlogCommentsProps {
  postId: string;
}

const MAX_COMMENT_LENGTH = 500;
const POST_COOLDOWN_MS = 2000;

/** Organize flat comments into threaded structure */
function organizeIntoThreads(comments: Comment[]): Comment[] {
  const topLevel: Comment[] = [];
  const childrenMap = new Map<string, Comment[]>();

  for (const comment of comments) {
    if (comment.parent_id) {
      const children = childrenMap.get(comment.parent_id) || [];
      children.push(comment);
      childrenMap.set(comment.parent_id, children);
    } else {
      topLevel.push({ ...comment, replies: [] });
    }
  }

  for (const parent of topLevel) {
    parent.replies = childrenMap.get(parent.id) || [];
    parent.replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return topLevel;
}

export default function BlogComments({ postId }: BlogCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createSupabaseBrowserClient();

  // Fetch user auth + profile
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", session.user.id)
          .single();
        setUserProfile(profile);
      }
    };
    getUser();
  }, [supabase]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("blog_comments")
      .select(`
        id,
        content,
        created_at,
        parent_id,
        guest_name,
        guest_verified,
        author:profiles!blog_comments_author_id_fkey(id, full_name, avatar_url)
      `)
      .eq("post_id", postId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching comments:", fetchError);
    } else {
      const normalized = (data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        parent_id: c.parent_id,
        author: Array.isArray(c.author) ? c.author[0] : c.author,
        guest_name: c.guest_name,
        guest_verified: c.guest_verified ?? false,
      }));
      const threaded = organizeIntoThreads(normalized);
      setComments(threaded);
    }
    setLoading(false);
  }, [supabase, postId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Cleanup cooldown timer
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    const content = parentId ? replyContent.trim() : newComment.trim();
    if (!userId || !content || cooldown) return;

    if (content.length > MAX_COMMENT_LENGTH) {
      setError(`Comment too long (max ${MAX_COMMENT_LENGTH} characters)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("blog_comments")
        .insert({
          post_id: postId,
          author_id: userId,
          content,
          parent_id: parentId,
        });

      if (insertError) throw insertError;

      if (parentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }

      // Start cooldown
      setCooldown(true);
      cooldownTimerRef.current = setTimeout(() => setCooldown(false), POST_COOLDOWN_MS);

      // Refetch to show new comment (once approved)
      fetchComments();
    } catch (err) {
      console.error("Error posting comment:", err);
      setError("Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      timeZone: "America/Denver",
    });
  };

  // Get total count including replies
  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  // Render a single comment
  function renderComment(comment: Comment, isReply = false) {
    const isGuestComment = !comment.author && comment.guest_name;
    const displayName = isGuestComment
      ? `${comment.guest_name} (guest)`
      : comment.author?.full_name ?? "Member";
    const avatarInitial = isGuestComment
      ? comment.guest_name?.[0] ?? "G"
      : comment.author?.full_name?.[0] ?? "?";

    return (
      <div key={comment.id} className={`group ${isReply ? "ml-6 pl-4 border-l-2 border-[var(--color-border-default)]" : ""}`}>
        <div className="flex items-start gap-3">
          {comment.author?.avatar_url && !isGuestComment ? (
            <Image
              src={comment.author.avatar_url}
              alt={comment.author.full_name ?? "Member"}
              width={isReply ? 32 : 40}
              height={isReply ? 32 : 40}
              className="rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className={`${isReply ? "w-8 h-8" : "w-10 h-10"} rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center flex-shrink-0`}>
              <span className="text-[var(--color-text-accent)]">
                {avatarInitial}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[var(--color-text-primary)] font-medium">
                {displayName}
              </span>
              <span className="text-[var(--color-text-tertiary)] text-sm">
                {formatDate(comment.created_at)}
              </span>
            </div>
            <p className="text-[var(--color-text-secondary)] mt-1 break-words">{comment.content}</p>

            {/* Reply button (only for top-level comments) */}
            {!isReply && userId && (
              <button
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="mt-1 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Reply
              </button>
            )}
          </div>
        </div>

        {/* Reply form */}
        {replyingTo === comment.id && userId && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-3 ml-12 flex gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              placeholder="Write a reply..."
              maxLength={MAX_COMMENT_LENGTH}
              disabled={isSubmitting || cooldown}
              autoFocus
              className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-placeholder)] focus:outline-none focus:border-[var(--color-border-accent)]/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting || cooldown || !replyContent.trim()}
              className="px-3 py-2 text-sm bg-[var(--color-accent-primary)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-accent-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "..." : cooldown ? "Wait" : "Reply"}
            </button>
            <button
              type="button"
              onClick={() => { setReplyingTo(null); setReplyContent(""); }}
              className="px-2 py-2 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-4 space-y-4">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section id="comments" className="mt-12 pt-8 border-t border-white/10">
      <h3 className="text-xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6">
        Comments ({totalCount})
      </h3>

      {/* Comment form */}
      {userId ? (
        <form onSubmit={(e) => handleSubmit(e, null)} className="mb-8">
          <div className="flex items-start gap-3">
            {userProfile?.avatar_url ? (
              <Image
                src={userProfile.avatar_url}
                alt={userProfile.full_name ?? "You"}
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--color-text-accent)]">
                  {userProfile?.full_name?.[0] ?? "?"}
                </span>
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                placeholder="Share your thoughts..."
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                disabled={isSubmitting || cooldown}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-secondary)] placeholder-[var(--color-placeholder)] focus:outline-none focus:border-[var(--color-border-accent)]/50 resize-none disabled:opacity-50"
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || cooldown || !newComment.trim()}
                  className="px-4 py-2 bg-[var(--color-accent-primary)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-accent-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Posting..." : cooldown ? "Wait..." : "Post Comment"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8">
          <GuestCommentForm
            type="blog"
            targetId={postId}
            onSuccess={fetchComments}
          />
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <p className="text-[var(--color-text-tertiary)] text-center py-8">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-[var(--color-text-tertiary)] text-center py-8">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}
    </section>
  );
}
