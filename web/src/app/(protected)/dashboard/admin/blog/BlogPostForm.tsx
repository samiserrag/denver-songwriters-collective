"use client";

import { useState, useRef } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const [showPreview, setShowPreview] = useState(false);

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
      slug: prev.slug === generateSlug(prev.title) || prev.slug === ""
        ? generateSlug(title)
        : prev.slug,
    }));
  };

  // Insert formatting at cursor position
  const insertFormatting = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const selectedText = text.substring(start, end);

    const newText =
      text.substring(0, start) +
      before +
      selectedText +
      after +
      text.substring(end);

    setFormData((prev) => ({ ...prev, content: newText }));

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(
        selectedText ? newPos : start + before.length,
        selectedText ? newPos : start + before.length
      );
    }, 0);
  };

  const insertImageAtCursor = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      insertFormatting(`\n\n![Image description](${url})\n\n`);
    }
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

  // Simple markdown preview renderer
  const renderPreview = (content: string) => {
    return content.split("\n\n").map((block, i) => {
      // Images
      const imgMatch = block.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        return (
          <div key={i} className="my-4">
            <img src={imgMatch[2]} alt={imgMatch[1]} className="max-w-full rounded-lg" />
          </div>
        );
      }

      // Headers
      if (block.startsWith("### ")) {
        return <h3 key={i} className="text-xl font-semibold text-white mt-6 mb-3">{block.replace("### ", "")}</h3>;
      }
      if (block.startsWith("## ")) {
        return <h2 key={i} className="text-2xl font-semibold text-white mt-8 mb-4">{block.replace("## ", "")}</h2>;
      }
      if (block.startsWith("# ")) {
        return <h1 key={i} className="text-3xl font-bold text-white mt-10 mb-5">{block.replace("# ", "")}</h1>;
      }

      // Blockquote
      if (block.startsWith("> ")) {
        return (
          <blockquote key={i} className="border-l-4 border-[var(--color-gold)] pl-4 my-4 text-neutral-400 italic">
            {block.replace(/^> /gm, "")}
          </blockquote>
        );
      }

      // Bullet list
      if (block.includes("\n- ") || block.startsWith("- ")) {
        const items = block.split("\n").filter((line) => line.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-1 my-4 text-neutral-300">
            {items.map((item, j) => <li key={j}>{item.replace("- ", "")}</li>)}
          </ul>
        );
      }

      // Regular paragraph with bold/italic
      let text = block;
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

      return (
        <p key={i} className="text-neutral-300 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: text }} />
      );
    });
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
        <label htmlFor="title" className="block text-sm font-medium text-neutral-300 mb-2">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={handleTitleChange}
          required
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white text-lg placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="Your blog post title"
        />
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-neutral-300 mb-2">
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
            className="flex-1 px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
            placeholder="your-post-slug"
          />
        </div>
      </div>

      {/* Cover Image */}
      <div className="p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
        <label htmlFor="cover_image_url" className="block text-sm font-medium text-neutral-300 mb-2">
          Cover Image
        </label>
        <input
          type="url"
          id="cover_image_url"
          value={formData.cover_image_url}
          onChange={(e) => setFormData((prev) => ({ ...prev, cover_image_url: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="https://your-image-url.com/cover.jpg"
        />
        {formData.cover_image_url && (
          <div className="mt-3">
            <img
              src={formData.cover_image_url}
              alt="Cover preview"
              className="max-h-48 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>

      {/* Excerpt */}
      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-neutral-300 mb-2">
          Excerpt <span className="text-neutral-500 font-normal">(shown in listings)</span>
        </label>
        <textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none resize-none"
          placeholder="A compelling summary that makes readers want to click..."
        />
      </div>

      {/* Content Editor */}
      <div className="border border-neutral-700 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-2 bg-neutral-800 border-b border-neutral-700">
          <button
            type="button"
            onClick={() => insertFormatting("## ", "")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            title="Heading"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("### ", "")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            title="Subheading"
          >
            H3
          </button>
          <div className="w-px h-6 bg-neutral-600 mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting("**", "**")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors font-bold"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("*", "*")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors italic"
            title="Italic"
          >
            I
          </button>
          <div className="w-px h-6 bg-neutral-600 mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting("\n- ", "")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("\n> ", "")}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            title="Quote"
          >
            &quot; Quote
          </button>
          <div className="w-px h-6 bg-neutral-600 mx-1" />
          <button
            type="button"
            onClick={insertImageAtCursor}
            className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-white rounded transition-colors"
            title="Insert Image"
          >
            + Image
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              showPreview
                ? "bg-teal-600 text-white"
                : "bg-neutral-700 hover:bg-neutral-600 text-white"
            }`}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {/* Editor / Preview */}
        {showPreview ? (
          <div className="p-6 bg-neutral-900 min-h-[400px] max-h-[600px] overflow-y-auto prose prose-invert">
            {formData.cover_image_url && (
              <img src={formData.cover_image_url} alt="Cover" className="w-full h-48 object-cover rounded-lg mb-6" />
            )}
            <h1 className="text-3xl font-bold text-white mb-4">{formData.title || "Untitled"}</h1>
            {renderPreview(formData.content)}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            id="content"
            value={formData.content}
            onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
            required
            rows={20}
            className="w-full px-4 py-4 bg-neutral-900 text-white placeholder:text-neutral-500 focus:outline-none font-mono text-sm leading-relaxed resize-none"
            placeholder="Start writing your post...

Use the toolbar above or type markdown directly:

## This is a heading

Regular paragraph text here. Use **bold** for emphasis.

- Bullet point one
- Bullet point two

> This is a quote block"
          />
        )}
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-neutral-300 mb-2">
          Tags <span className="text-neutral-500 font-normal">(comma-separated)</span>
        </label>
        <input
          type="text"
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-white placeholder:text-neutral-500 focus:border-teal-500 focus:outline-none"
          placeholder="tips, community, open mic, beginners"
        />
        {formData.tags && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.split(",").map((tag, i) => (
              tag.trim() && (
                <span
                  key={i}
                  className="px-2 py-1 bg-teal-900/30 text-teal-400 text-xs rounded-full border border-teal-800"
                >
                  {tag.trim()}
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Publish Toggle */}
      <div className="flex items-center gap-3 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
        <input
          type="checkbox"
          id="is_published"
          checked={formData.is_published}
          onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
          className="w-5 h-5 rounded bg-neutral-800 border-neutral-600 text-teal-500 focus:ring-teal-500"
        />
        <div>
          <label htmlFor="is_published" className="text-white font-medium cursor-pointer">
            Publish immediately
          </label>
          <p className="text-neutral-500 text-sm">
            {formData.is_published ? "This post will be visible to everyone" : "Save as draft for later"}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-neutral-700">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-900 text-white font-medium rounded-lg transition-colors"
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
        {isEditing && (
          <a
            href={`/blog/${formData.slug}`}
            target="_blank"
            className="px-6 py-3 text-neutral-400 hover:text-white transition-colors"
          >
            View Post →
          </a>
        )}
      </div>
    </form>
  );
}
