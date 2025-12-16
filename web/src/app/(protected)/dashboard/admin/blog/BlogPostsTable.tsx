"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  is_published: boolean;
  is_approved: boolean;
  published_at: string | null;
  created_at: string;
  tags: string[];
  author: { full_name: string | null }[] | { full_name: string | null } | null;
}

interface Props {
  posts: BlogPost[];
}

export default function BlogPostsTable({ posts }: Props) {
  const router = useRouter();
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; post: BlogPost | null }>({
    open: false,
    post: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "published" | "draft">("all");

  const getAuthorName = (author: BlogPost["author"]) => {
    if (!author) return "Unknown";
    const authorObj = Array.isArray(author) ? author[0] : author;
    return authorObj?.full_name ?? "Unknown";
  };

  const handleTogglePublish = async (post: BlogPost) => {
    setIsToggling(post.id);
    const supabase = createClient();

    const updates: { is_published: boolean; published_at?: string | null } = {
      is_published: !post.is_published,
    };

    // Set published_at when publishing for the first time
    if (!post.is_published && !post.published_at) {
      updates.published_at = new Date().toISOString();
    }

    await supabase
      .from("blog_posts")
      .update(updates)
      .eq("id", post.id);

    setIsToggling(null);
    router.refresh();
  };

  const handleToggleApproval = async (post: BlogPost) => {
    setIsApproving(post.id);
    const supabase = createClient();

    await supabase
      .from("blog_posts")
      .update({ is_approved: !post.is_approved })
      .eq("id", post.id);

    setIsApproving(null);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deleteModal.post) return;
    setIsDeleting(true);

    const supabase = createClient();
    await supabase.from("blog_posts").delete().eq("id", deleteModal.post.id);

    setIsDeleting(false);
    setDeleteModal({ open: false, post: null });
    router.refresh();
  };

  // Filter posts based on status
  const filteredPosts = posts.filter(post => {
    switch (filterStatus) {
      case "pending":
        return !post.is_approved;
      case "approved":
        return post.is_approved && !post.is_published;
      case "published":
        return post.is_published && post.is_approved;
      case "draft":
        return !post.is_published;
      default:
        return true;
    }
  });

  const pendingCount = posts.filter(p => !p.is_approved).length;

  return (
    <>
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filterStatus === "all"
              ? "bg-[var(--color-accent-primary)] text-[var(--color-background)]"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          All ({posts.length})
        </button>
        <button
          onClick={() => setFilterStatus("pending")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filterStatus === "pending"
              ? "bg-amber-600 text-white"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          Pending Approval ({pendingCount})
          {pendingCount > 0 && (
            <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setFilterStatus("published")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filterStatus === "published"
              ? "bg-green-600 text-white"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          Published
        </button>
        <button
          onClick={() => setFilterStatus("draft")}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            filterStatus === "draft"
              ? "bg-yellow-600 text-white"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
        >
          Drafts
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <table className="min-w-full text-left text-sm text-[var(--color-text-primary)]">
          <thead className="border-b border-[var(--color-border-default)] text-[var(--color-accent-primary)]">
            <tr>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Author</th>
              <th className="py-3 px-4">Approval</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((post) => (
              <tr key={post.id} className={`border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-tertiary)] ${!post.is_approved ? "bg-amber-500/5" : ""}`}>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{post.title}</p>
                    <p className="text-[var(--color-text-tertiary)] text-xs">/{post.slug}</p>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--color-text-secondary)]">
                  {getAuthorName(post.author)}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleToggleApproval(post)}
                    disabled={isApproving === post.id}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      post.is_approved
                        ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] hover:bg-[var(--color-accent-primary)]/30"
                        : "bg-amber-900/50 text-amber-400 hover:bg-amber-900"
                    }`}
                  >
                    {isApproving === post.id
                      ? "..."
                      : post.is_approved
                      ? "Approved"
                      : "Pending"}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleTogglePublish(post)}
                    disabled={isToggling === post.id}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      post.is_published
                        ? "bg-green-900/50 text-green-400 hover:bg-green-900"
                        : "bg-yellow-900/50 text-yellow-400 hover:bg-yellow-900"
                    }`}
                  >
                    {isToggling === post.id
                      ? "..."
                      : post.is_published
                      ? "Published"
                      : "Draft"}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {post.tags?.length > 2 && (
                      <span className="text-[var(--color-text-tertiary)] text-xs">
                        +{post.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--color-text-tertiary)] text-xs">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-xs"
                    >
                      View
                    </Link>
                    <Link
                      href={`/dashboard/admin/blog/${post.id}/edit`}
                      className="text-[var(--color-text-accent)] hover:text-[var(--color-gold-400)] text-xs"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteModal({ open: true, post })}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {filteredPosts.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-[var(--color-text-tertiary)]">
                  {filterStatus === "all"
                    ? "No blog posts yet. Create your first post!"
                    : `No ${filterStatus} posts found.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Modal */}
      {deleteModal.open && deleteModal.post && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[var(--color-bg-primary)] border border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-4">Delete Post</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete &quot;{deleteModal.post.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white rounded-lg transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, post: null })}
                className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
