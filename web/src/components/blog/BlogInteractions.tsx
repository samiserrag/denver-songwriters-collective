"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface BlogInteractionsProps {
  postId: string;
  initialLikeCount: number;
  initialHasLiked: boolean;
}

export default function BlogInteractions({
  postId,
  initialLikeCount,
  initialHasLiked,
}: BlogInteractionsProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    };
    getUser();
  }, [supabase]);

  const handleLike = async () => {
    if (!userId) {
      // Redirect to login
      window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
      return;
    }

    setIsLoading(true);

    try {
      if (hasLiked) {
        // Unlike
        await supabase
          .from("blog_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        setLikeCount((prev) => prev - 1);
        setHasLiked(false);
      } else {
        // Like
        await supabase.from("blog_likes").insert({
          post_id: postId,
          user_id: userId,
        });
        setLikeCount((prev) => prev + 1);
        setHasLiked(true);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 py-6 border-y border-white/10">
      <button
        onClick={handleLike}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
          hasLiked
            ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)] border border-[var(--color-gold)]/40"
            : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-[var(--color-gold)]/40 hover:text-[var(--color-gold)]"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <svg
          className={`w-5 h-5 transition-transform ${hasLiked ? "scale-110" : ""}`}
          fill={hasLiked ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
          />
        </svg>
        <span className="font-medium">{likeCount}</span>
        <span className="text-sm">{likeCount === 1 ? "Like" : "Likes"}</span>
      </button>
    </div>
  );
}
