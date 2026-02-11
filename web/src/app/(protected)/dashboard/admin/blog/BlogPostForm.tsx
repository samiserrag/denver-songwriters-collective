"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { toast } from "sonner";
import { X } from "lucide-react";
import { escapeHtml } from "@/lib/highlight";

interface GalleryImage {
  id?: string;
  image_url: string;
  caption: string;
  sort_order: number;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  is_published: boolean;
  tags: string[];
  youtube_url?: string | null;
  spotify_url?: string | null;
}

interface Props {
  authorId: string;
  post?: BlogPost;
  initialGallery?: GalleryImage[];
  isAdmin?: boolean;
}

export default function BlogPostForm({ authorId, post, initialGallery = [], isAdmin = false }: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = !!post;

  const [formData, setFormData] = useState({
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    content: post?.content ?? "",
    cover_image_url: post?.cover_image_url ?? "",
    youtube_url: post?.youtube_url ?? "",
    spotify_url: post?.spotify_url ?? "",
    tags: post?.tags?.join(", ") ?? "",
    // Default to "submit for publication" for non-admins creating new posts
    // (most users want their post published, not saved as a draft)
    is_published: post?.is_published ?? !isAdmin,
  });

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(initialGallery);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  // Cover image upload handler
  const handleCoverUpload = useCallback(async (file: File): Promise<string | null> => {
    const supabase = createClient();

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${authorId}/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload cover image');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(fileName);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      setFormData(prev => ({ ...prev, cover_image_url: urlWithTimestamp }));
      toast.success('Cover image uploaded!');
      return urlWithTimestamp;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload cover image');
      return null;
    }
  }, [authorId]);

  const handleCoverRemove = useCallback(async () => {
    setFormData(prev => ({ ...prev, cover_image_url: "" }));
    toast.success('Cover image removed');
  }, []);

  // Gallery image upload handler
  const handleGalleryUpload = useCallback(async (file: File): Promise<string | null> => {
    const supabase = createClient();

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${authorId}/gallery-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('blog-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload gallery image');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('blog-images')
        .getPublicUrl(fileName);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Add to gallery
      setGalleryImages(prev => [
        ...prev,
        {
          image_url: urlWithTimestamp,
          caption: "",
          sort_order: prev.length,
        }
      ]);

      toast.success('Gallery image uploaded!');
      return urlWithTimestamp;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload gallery image');
      return null;
    }
  }, [authorId]);

  const removeGalleryImage = (index: number) => {
    setGalleryImages(prev => prev.filter((_, i) => i !== index));
  };

  const updateGalleryCaption = (index: number, caption: string) => {
    setGalleryImages(prev => prev.map((img, i) =>
      i === index ? { ...img, caption } : img
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setFieldErrors({});

    const tagsArray = formData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const payload = {
      title: formData.title,
      slug: formData.slug || generateSlug(formData.title),
      excerpt: formData.excerpt || null,
      content: formData.content,
      cover_image_url: formData.cover_image_url || null,
      youtube_url: formData.youtube_url || null,
      spotify_url: formData.spotify_url || null,
      tags: tagsArray,
      is_published: formData.is_published,
      gallery_images: galleryImages.map((img, index) => ({
        image_url: img.image_url,
        caption: img.caption || null,
        sort_order: index,
      })),
    };

    if (isAdmin) {
      const endpoint = isEditing ? `/api/admin/blog-posts/${post?.id}` : "/api/admin/blog-posts";
      const method = isEditing ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.error || "Failed to save post.");
        setFieldErrors(errorData?.fieldErrors || {});
        setSaving(false);
        return;
      }

      router.push("/dashboard/admin/blog");
      router.refresh();
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const postData = {
      title: payload.title,
      slug: payload.slug,
      excerpt: payload.excerpt,
      content: payload.content,
      cover_image_url: payload.cover_image_url,
      tags: payload.tags,
      is_published: payload.is_published,
      is_approved: true, // Trust members - auto-approve all posts (admins can hide if needed)
      published_at: formData.is_published && !post?.is_published
        ? new Date().toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    };

    let postId = post?.id;

    if (isEditing) {
      const result = await supabase
        .from("blog_posts")
        .update(postData)
        .eq("id", post.id);

      if (result.error) {
        console.error("Save error:", result.error);
        setError(result.error.message);
        setSaving(false);
        return;
      }
    } else {
      const result = await supabase
        .from("blog_posts")
        .insert({
          ...postData,
          author_id: authorId,
        })
        .select("id")
        .single();

      if (result.error) {
        console.error("Save error:", result.error);
        setError(result.error.message);
        setSaving(false);
        return;
      }

      postId = result.data.id;
    }

    // Save gallery images
    if (postId && galleryImages.length > 0) {
      // Delete existing gallery images if editing
      if (isEditing) {
        await supabase
          .from("blog_gallery_images")
          .delete()
          .eq("post_id", postId);
      }

      // Insert new gallery images
      const galleryData = galleryImages.map((img, index) => ({
        post_id: postId,
        image_url: img.image_url,
        caption: img.caption || null,
        sort_order: index,
      }));

      const { error: galleryError } = await supabase
        .from("blog_gallery_images")
        .insert(galleryData);

      if (galleryError) {
        console.error("Gallery save error:", galleryError);
      }
    }

    router.push("/dashboard/blog");
    router.refresh();
    setSaving(false);
  };

  // Simple markdown preview renderer
  const renderPreview = (content: string) => {
    return content.split("\n\n").map((block, i) => {
      const imgMatch = block.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        return (
          <div key={i} className="my-4 relative">
            <Image src={imgMatch[2]} alt={imgMatch[1]} width={800} height={450} className="max-w-full rounded-lg" style={{ width: '100%', height: 'auto' }} />
          </div>
        );
      }

      if (block.startsWith("### ")) {
        return <h3 key={i} className="text-xl font-semibold text-[var(--color-text-primary)] mt-6 mb-3">{block.replace("### ", "")}</h3>;
      }
      if (block.startsWith("## ")) {
        return <h2 key={i} className="text-2xl font-semibold text-[var(--color-text-primary)] mt-8 mb-4">{block.replace("## ", "")}</h2>;
      }
      if (block.startsWith("# ")) {
        return <h1 key={i} className="text-3xl font-bold text-[var(--color-text-primary)] mt-10 mb-5">{block.replace("# ", "")}</h1>;
      }

      if (block.startsWith("> ")) {
        return (
          <blockquote key={i} className="border-l-4 border-[var(--color-border-accent)] pl-4 my-4 text-[var(--color-text-secondary)] italic">
            {block.replace(/^> /gm, "")}
          </blockquote>
        );
      }

      if (block.includes("\n- ") || block.startsWith("- ")) {
        const items = block.split("\n").filter((line) => line.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-1 my-4 text-[var(--color-text-secondary)]">
            {items.map((item, j) => <li key={j}>{item.replace("- ", "")}</li>)}
          </ul>
        );
      }

      // Escape HTML first to prevent XSS, then apply markdown formatting
      let text = escapeHtml(block);
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
      text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

      return (
        <p key={i} className="text-[var(--color-text-secondary)] leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: text }} />
      );
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg text-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Non-admin notice */}
      {!isAdmin && (
        <div className="p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300">
          <p className="font-medium">Note: Your blog post will need admin approval before it&apos;s published publicly.</p>
          <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">Once approved, it will appear on the blog page for everyone to see.</p>
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Title <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={handleTitleChange}
          required
          className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-lg placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          placeholder="Your blog post title"
        />
      </div>

      {/* Slug */}
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          URL Slug <span className="text-red-600">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-tertiary)]">/blog/</span>
          <input
            type="text"
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            required
            className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            placeholder="your-post-slug"
          />
        </div>
      </div>

      {/* Cover Image Upload */}
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Cover Image
        </label>
        <div className="flex items-start gap-6">
          <div className="w-48">
            <ImageUpload
              currentImageUrl={formData.cover_image_url || null}
              onUpload={handleCoverUpload}
              onRemove={handleCoverRemove}
              aspectRatio={4/3}
              maxSizeMB={10}
              shape="square"
              placeholderText="Upload Cover"
            />
          </div>
          <div className="flex-1 text-sm text-[var(--color-text-tertiary)]">
            <p>Upload a cover image for your blog post.</p>
            <p className="mt-1">Recommended size: 1200×900 pixels (4:3 ratio)</p>
            <p className="mt-1">Max file size: 10MB</p>
          </div>
        </div>
      </div>

      {/* Excerpt */}
      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Excerpt <span className="text-[var(--color-text-tertiary)] font-normal">(shown in listings)</span>
        </label>
        <textarea
          id="excerpt"
          value={formData.excerpt}
          onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
          rows={2}
          className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none resize-none"
          placeholder="A compelling summary that makes readers want to click..."
        />
      </div>

      {isAdmin && (
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)] space-y-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Media Embeds</h3>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Paste a YouTube or Spotify link. Leave blank to clear.
          </p>
          <div>
            <label htmlFor="youtube_url" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              YouTube URL
            </label>
            <input
              type="url"
              id="youtube_url"
              value={formData.youtube_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, youtube_url: e.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            />
            {fieldErrors.youtube_url && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.youtube_url}</p>
            )}
          </div>
          <div>
            <label htmlFor="spotify_url" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Spotify URL
            </label>
            <input
              type="url"
              id="spotify_url"
              value={formData.spotify_url}
              onChange={(e) => setFormData((prev) => ({ ...prev, spotify_url: e.target.value }))}
              placeholder="https://open.spotify.com/playlist/..."
              className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
            />
            {fieldErrors.spotify_url && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.spotify_url}</p>
            )}
          </div>
        </div>
      )}

      {/* Content Editor */}
      <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 p-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
          <button
            type="button"
            onClick={() => insertFormatting("## ", "")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors"
            title="Heading"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("### ", "")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors"
            title="Subheading"
          >
            H3
          </button>
          <div className="w-px h-6 bg-[var(--color-border-default)] mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting("**", "**")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors font-bold"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("*", "*")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors italic"
            title="Italic"
          >
            I
          </button>
          <div className="w-px h-6 bg-[var(--color-border-default)] mx-1" />
          <button
            type="button"
            onClick={() => insertFormatting("\n- ", "")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors"
            title="Bullet List"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => insertFormatting("\n> ", "")}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors"
            title="Quote"
          >
            &quot; Quote
          </button>
          <div className="w-px h-6 bg-[var(--color-border-default)] mx-1" />
          <button
            type="button"
            onClick={insertImageAtCursor}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded transition-colors"
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
                ? "bg-[var(--color-accent-primary)] text-[var(--color-background)]"
                : "bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
            }`}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>

        {showPreview ? (
          <div className="p-6 bg-[var(--color-bg-tertiary)] min-h-[400px] max-h-[600px] overflow-y-auto prose prose-invert">
            {formData.cover_image_url && (
              <Image src={formData.cover_image_url} alt="Cover" width={800} height={192} className="w-full h-48 object-cover rounded-lg mb-6" />
            )}
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">{formData.title || "Untitled"}</h1>
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
            className="w-full px-4 py-4 bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none font-mono text-sm leading-relaxed resize-none"
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

      {/* Gallery Images */}
      <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Photo Gallery <span className="text-[var(--color-text-tertiary)] font-normal">(shown at bottom of post)</span>
        </label>

        {/* Existing gallery images */}
        {galleryImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
            {galleryImages.map((img, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Admin gallery preview; user-uploaded images with dynamic URLs */}
                  <img
                    src={img.image_url}
                    alt={img.caption || `Gallery image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeGalleryImage(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4 text-[var(--color-text-primary)]" />
                </button>
                <input
                  type="text"
                  value={img.caption}
                  onChange={(e) => updateGalleryCaption(index, e.target.value)}
                  placeholder="Add caption..."
                  className="mt-2 w-full px-2 py-1 text-xs rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}

        {/* Add gallery image */}
        <div className="w-32">
          <ImageUpload
            currentImageUrl={null}
            onUpload={handleGalleryUpload}
            aspectRatio={1}
            maxSizeMB={10}
            shape="square"
            placeholderText="Add Photo"
          />
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
          Add photos to create a gallery at the bottom of your post. Max 10MB per image.
        </p>
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="tags" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          Tags <span className="text-[var(--color-text-tertiary)] font-normal">(comma-separated)</span>
        </label>
        <input
          type="text"
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
          className="w-full px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-accent)] focus:outline-none"
          placeholder="tips, community, open mic, beginners"
        />
        {formData.tags && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.split(",").map((tag, i) => (
              tag.trim() && (
                <span
                  key={i}
                  className="px-2 py-1 bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-xs rounded-full border border-[var(--color-border-accent)]/30"
                >
                  {tag.trim()}
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Publish Toggle */}
      <div className="flex items-center gap-3 p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
        <input
          type="checkbox"
          id="is_published"
          checked={formData.is_published}
          onChange={(e) => setFormData((prev) => ({ ...prev, is_published: e.target.checked }))}
          className="w-5 h-5 rounded bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]"
        />
        <div>
          <label htmlFor="is_published" className="text-[var(--color-text-primary)] font-medium cursor-pointer">
            Publish now
          </label>
          <p className="text-[var(--color-text-tertiary)] text-sm">
            {formData.is_published ? "This post will be visible to everyone" : "Save as draft for later"}
          </p>
        </div>
      </div>


      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-[var(--color-border-default)]">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-accent-primary)]/50 text-[var(--color-background)] font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving..." : isEditing ? "Update Post" : "Create Post"}
        </button>
        <button
          type="button"
          onClick={() => router.push(isAdmin ? "/dashboard/admin/blog" : "/dashboard/blog")}
          className="px-6 py-3 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg transition-colors"
        >
          Cancel
        </button>
        {isEditing && (
          <a
            href={`/blog/${formData.slug}`}
            target="_blank"
            className="px-6 py-3 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            View Post →
          </a>
        )}
      </div>
    </form>
  );
}
