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
    if (post.is_published && post.is_approved) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-400">
          Published
        </span>
      );
    }
    if (post.is_published && !post.is_approved) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400">
          Pending Approval
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400">
        Draft
      </span>
    );
  };

  return (
    <>
      {/* Info banner */}
      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <p className="text-blue-300 text-sm">
          <strong>How it works:</strong> When you submit a post for publication, it will be reviewed by an admin before appearing on the public blog. You&apos;ll see the status update here once it&apos;s approved.
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-white/10 bg-black/20">
        <table className="min-w-full text-left text-sm text-white">
          <thead className="border-b border-white/10 text-gold-400">
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
              <tr key={post.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-white">{post.title}</p>
                    <p className="text-neutral-500 text-xs">/{post.slug}</p>
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
                        className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {post.tags?.length > 2 && (
                      <span className="text-neutral-500 text-xs">
                        +{post.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-neutral-400 text-xs">
                  {new Date(post.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {post.is_published && post.is_approved && (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="text-neutral-400 hover:text-white text-xs"
                      >
                        View
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/blog/${post.id}/edit`}
                      className="text-[var(--color-gold)] hover:text-[var(--color-gold-400)] text-xs"
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
                <td colSpan={5} className="py-8 px-4 text-center text-neutral-400">
                  You haven&apos;t created any blog posts yet.{" "}
                  <Link href="/dashboard/blog/new" className="text-[var(--color-gold)] hover:text-[var(--color-gold-400)]">
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
          <div className="bg-neutral-900 border border-red-900/50 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-red-400 mb-4">Delete Post</h2>
            <p className="text-neutral-300 mb-6">
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
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
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
