"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface BlogCommentsProps {
  postId: string;
  initialComments: Comment[];
}

export default function BlogComments({ postId, initialComments }: BlogCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !newComment.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("blog_comments")
        .insert({
          post_id: postId,
          author_id: userId,
          content: newComment.trim(),
        })
        .select("id, content, created_at")
        .single();

      if (insertError) throw insertError;

      // Add the new comment to the list
      const newCommentObj: Comment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        author: {
          id: userId,
          full_name: userProfile?.full_name ?? null,
          avatar_url: userProfile?.avatar_url ?? null,
        },
      };

      setComments((prev) => [newCommentObj, ...prev]);
      setNewComment("");
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
    });
  };

  return (
    <div className="mt-12 pt-8 border-t border-white/10">
      <h3 className="text-xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-6">
        Comments ({comments.length})
      </h3>

      {/* Comment form */}
      {userId ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex items-start gap-3">
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt={userProfile.full_name ?? "You"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[var(--color-gold)]">
                  {userProfile?.full_name?.[0] ?? "?"}
                </span>
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Share your thoughts..."
                rows={3}
                className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-[var(--color-gold)]/50 resize-none"
              />
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-4 py-2 bg-[var(--color-gold)] text-neutral-900 rounded-lg font-medium hover:bg-[var(--color-gold)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg text-center">
          <p className="text-neutral-400 mb-3">Sign in to join the conversation</p>
          <a
            href={`/login?redirectTo=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
            className="inline-block px-4 py-2 bg-[var(--color-gold)] text-neutral-900 rounded-lg font-medium hover:bg-[var(--color-gold)]/90 transition-colors"
          >
            Sign In
          </a>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-neutral-500 text-center py-8">
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              {comment.author.avatar_url ? (
                <img
                  src={comment.author.avatar_url}
                  alt={comment.author.full_name ?? "User"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--color-gold)]">
                    {comment.author.full_name?.[0] ?? "?"}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[var(--color-warm-white)] font-medium">
                    {comment.author.full_name ?? "Anonymous"}
                  </span>
                  <span className="text-neutral-500 text-sm">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                <p className="text-neutral-300 mt-1">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
