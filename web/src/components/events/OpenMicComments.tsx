"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Comment = Database["public"]["Tables"]["open_mic_comments"]["Row"] & {
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

interface OpenMicCommentsProps {
  eventId: string;
}

export function OpenMicComments({ eventId }: OpenMicCommentsProps) {
  const supabase = createSupabaseBrowserClient();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadComments() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      // Load comments with user info
      const { data, error } = await supabase
        .from("open_mic_comments")
        .select(`
          *,
          user:profiles!open_mic_comments_user_id_fkey(full_name, avatar_url)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading comments:", error);
      } else {
        setComments(data as Comment[] ?? []);
      }
      setLoading(false);
    }
    loadComments();
  }, [supabase, eventId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newComment.trim()) return;

    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase
      .from("open_mic_comments")
      .insert({
        event_id: eventId,
        user_id: userId,
        content: newComment.trim(),
      })
      .select(`
        *,
        user:profiles!open_mic_comments_user_id_fkey(full_name, avatar_url)
      `)
      .single();

    if (error) {
      setError("Failed to post comment. Please try again.");
      console.error("Error posting comment:", error);
    } else if (data) {
      setComments([data as Comment, ...comments]);
      setNewComment("");
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    const { error } = await supabase
      .from("open_mic_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
    } else {
      setComments(comments.filter(c => c.id !== commentId));
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  }

  return (
    <div className="mt-8">
      <h2 className="font-[var(--font-family-serif)] text-xl text-[var(--color-text-primary)] mb-4">
        Community Thoughts
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-6">
        Share your experience at this open mic. What makes it special?
      </p>

      {/* Comment Form */}
      {userId ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this open mic..."
            rows={3}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-primary)]/40 focus:outline-none focus:border-[var(--color-border-accent)]/50 resize-none"
            disabled={submitting}
          />
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="px-5 py-2 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <p className="text-[var(--color-text-secondary)]">
            <a href="/login" className="text-[var(--color-text-accent)] hover:underline">Log in</a> to share your thoughts about this open mic.
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--color-border-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-center py-8">
          No comments yet. Be the first to share your experience!
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 rounded-xl bg-[var(--color-background)]/50 border border-white/5"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {comment.user?.avatar_url ? (
                  <img
                    src={comment.user.avatar_url}
                    alt={comment.user.full_name ?? "User"}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                    <span className="text-[var(--color-text-accent)] font-medium">
                      {comment.user?.full_name?.[0]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {comment.user?.full_name ?? "Anonymous"}
                    </span>
                    <span className="text-[var(--color-text-secondary)] text-xs">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>

                {/* Delete button (own comments only) */}
                {userId === comment.user_id && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-[var(--color-text-secondary)] hover:text-red-400 transition-colors p-1"
                    title="Delete comment"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
