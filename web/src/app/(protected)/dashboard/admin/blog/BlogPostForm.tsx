"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  is_published: boolean;
  tags: string[];
}

interface Props {
  authorId: string;
  post?: BlogPost;
}

export default function BlogPostForm({ authorId, post }: Props) {
  const router = useRouter();
  const isEditing = !!post;

  const [formData, setFormData] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    cover_image_url: post?.cover_image_url ?? "",
    tags: post?.tags?.join(", ") ?? "",
    is_published: post?.is_published ?? false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title,
      // Only auto-generate slug if it hasn't been manually edited or is empty
      slug: prev.slug === generateSlug(prev.title) || prev.slug === ""
        ? generateSlug(title)
        : prev.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();

    const tagsArray = formData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const postData = {
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      excerpt: formData.excerpt || null,
      content: formData.content,
      cover_image_url: formData.cover_image_url || null,
      tags: tagsArray,
      is_published: formData.is_published,
      published_at: formData.is_published && !post?.is_published
        ? new Date().toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (isEditing) {
      result = await supabase
        .from("blog_posts")
        .update(postData)
        .eq("id", post.id);
    } else {
      result = await supabase
        .from("blog_posts")
        .insert({
          ...postData,
          author_id: authorId,
        });
    }

    if (result.error) {
      console.error("Save error:", result.error);
      setError(result.error.message);
      setSaving(false);
      return;
    }

    router.push("/dashboard/admin/blog");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm text-neutral-300 mb-2">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={handleTitleChange}
          required
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="Your blog post title"
        />
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm text-neutral-300 mb-2">
          URL Slug <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-neutral-500">/blog/</span>
          <input
            type="text"
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            required
            className="flex-1 px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
            placeholder="your-post-slug"
          />
        </div>
      </div>

      {/* Excerpt */}
      <div>
        <label htmlFor="excerpt" className="block text-sm text-neutral-300 mb-2">
          Excerpt <span className="text-neutral-500">(optional)</span>
        </label>
        <textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none resize-none"
          placeholder="A brief summary that appears in listings..."
        />
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm text-neutral-300 mb-2">
          Content <span className="text-red-400">*</span>
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          Supports basic markdown: ## for headers, - for lists, {">"} for quotes, **bold**, *italic*
        </p>
        <textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
          required
          rows={20}
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none font-mono text-sm"
          placeholder="Write your blog post content here..."
        />
      </div>

      {/* Cover Image URL */}
      <div>
        <label htmlFor="cover_image_url" className="block text-sm text-neutral-300 mb-2">
          Cover Image URL <span className="text-neutral-500">(optional)</span>
        </label>
        <input
          type="url"
          id="cover_image_url"
          value={formData.cover_image_url}
          onChange={(e) => setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }))}
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="https://..."
        />
        {formData.cover_image_url && (
          <div className="mt-2">
            <img
              src={formData.cover_image_url}
              alt="Cover preview"
              className="max-h-40 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm text-neutral-300 mb-2">
          Tags <span className="text-neutral-500">(comma-separated)</span>
        </label>
        <input
          type="text"
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="tips, community, open mic"
        />
      </div>

      {/* Publish Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="is_published"
          checked={formData.is_published}
          onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
          className="w-5 h-5 rounded bg-neutral-800 border-neutral-600 text-teal-500 focus:ring-teal-500"
        />
        <label htmlFor="is_published" className="text-neutral-300">
          Publish immediately
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 text-white rounded-lg transition-colors"
        >
          {saving ? "Saving..." : isEditing ? "Update Post" : "Create Post"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/admin/blog")}
          className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
