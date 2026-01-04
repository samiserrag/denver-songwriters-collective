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
}

interface Props {
  posts: BlogPost[];
}

export default function UserBlogPostsTable({ posts }: Props) {
  const router = useRouter();
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; post: BlogPost | null }>({
    open: false,
    post: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteModal.post) return;
    setIsDeleting(true);

    const supabase = createClient();
    await supabase.from("blog_posts").delete().eq("id", deleteModal.post.id);

    setIsDeleting(false);
    setDeleteModal({ open: false, post: null });
    router.refresh();
  };

  const getStatusBadge = (post: BlogPost) => {
    if (post.is_published) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Published
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Draft
      </span>
    );
  };

  return (
    <>
      {/* Info banner */}
      <div className="mb-6 p-4 bg-[var(--color-accent-primary)]/10 border border-[var(--color-border-accent)] rounded-lg">
        <p className="text-[var(--color-text-secondary)] text-sm">
          <strong className="text-[var(--color-text-primary)]">Share your story:</strong> When you publish a post, it goes live immediately on the blog for the community to read.
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
        <table className="min-w-full text-left text-sm text-[var(--color-text-primary)]">
          <thead className="border-b border-[var(--color-border-default)] text-[var(--color-text-accent)]">
            <tr>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tags</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-[var(--color-border-default)]/30 hover:bg-[var(--color-bg-secondary)]">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{post.title}</p>
                    <p className="text-[var(--color-text-tertiary)] text-xs">/{post.slug}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {getStatusBadge(post)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {post.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
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
                <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs">
                  {new Date(post.created_at).toLocaleDateString("en-US", { timeZone: "America/Denver" })}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {post.is_published && (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs"
                      >
                        View
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/blog/${post.id}/edit`}
                      className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] text-xs"
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

            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-[var(--color-text-secondary)]">
                  You haven&apos;t created any blog posts yet.{" "}
                  <Link href="/dashboard/blog/new" className="text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)]">
                    Create your first post!
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Modal */}
      {deleteModal.open && deleteModal.post && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white border border-red-300 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Delete Post</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete &quot;{deleteModal.post.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-200 disabled:text-red-400 text-[var(--color-text-primary)] rounded-lg transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteModal({ open: false, post: null })}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg transition-colors"
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
