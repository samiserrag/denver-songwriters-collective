"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface EventCommentsProps {
  eventId: string;
}

export function EventComments({ eventId }: EventCommentsProps) {
  const supabase = createClient();

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      const res = await fetch(`/api/events/${eventId}/comments`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setComments(data);
      }
    };
    init();
  }, [eventId, supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setComments([...comments, data]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { timeZone: "America/Denver" });
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Comments ({comments.length})
      </h3>

      <div className="space-y-4 mb-6">
        {comments.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-sm">
            No comments yet. Be the first!
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="p-4 bg-[var(--color-bg-secondary)]/50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-[var(--color-bg-tertiary)] rounded-full flex items-center justify-center text-sm text-[var(--color-text-primary)] overflow-hidden">
                  {comment.user?.avatar_url ? (
                    <img
                      src={comment.user.avatar_url}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span>
                      {comment.user?.full_name?.[0]?.toUpperCase() || "?"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[var(--color-text-primary)] text-sm font-medium">
                    {comment.user?.full_name || "Anonymous"}
                  </p>
                  <p className="text-[var(--color-text-tertiary)] text-xs">
                    {formatDate(comment.created_at)}
                  </p>
                </div>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:border-gold-400 focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
            className="px-4 py-2 bg-gold-400 hover:bg-gold-300 text-[var(--color-text-on-accent)] font-medium rounded-lg disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Comment"}
          </button>
        </form>
      ) : (
        <p className="text-[var(--color-text-tertiary)] text-sm">
          <a
            href="/login"
            className="text-gold-400 hover:text-gold-300 underline"
          >
            Log in
          </a>{" "}
          to leave a comment.
        </p>
      )}
    </div>
  );
}
