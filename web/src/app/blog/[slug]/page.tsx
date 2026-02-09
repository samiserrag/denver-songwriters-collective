import type { Metadata } from "next";
import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";
import BlogInteractions from "@/components/blog/BlogInteractions";
import BlogComments from "@/components/blog/BlogComments";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";

// Generate dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, cover_image_url, author:profiles!blog_posts_author_id_fkey(full_name)")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    return {
      title: "Post Not Found | The Colorado Songwriters Collective",
      description: "This blog post could not be found.",
    };
  }

  const authorName = (post.author as any)?.full_name ?? "The Colorado Songwriters Collective";
  const title = `${post.title} | The Colorado Songwriters Collective`;
  const description = post.excerpt
    ? post.excerpt.slice(0, 155) + (post.excerpt.length > 155 ? "..." : "")
    : `Read "${post.title}" by ${authorName} on The Colorado Songwriters Collective blog.`;

  const canonicalUrl = `${siteUrl}/blog/${slug}`;
  const ogImageUrl = `${siteUrl}/og/blog/${slug}`;

  return {
    title,
    description,
    authors: [{ name: authorName }],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "The Colorado Songwriters Collective",
      type: "article",
      locale: "en_US",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${post.title} - The Colorado Songwriters Collective`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select(`
      id,
      slug,
      title,
      content,
      cover_image_url,
      published_at,
      tags,
      author:profiles!blog_posts_author_id_fkey(full_name, avatar_url, bio, slug)
    `)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_approved", true)
    .single();

  if (!post) {
    notFound();
  }

  // Get current user for like status
  const { data: { user: sessionUser } } = await supabase.auth.getUser();
  const currentUserId = sessionUser?.id;

  // Fetch like count, user's like status, and gallery images (comments fetched client-side)
  const [likesRes, userLikeRes, galleryRes] = await Promise.all([
    supabase
      .from("blog_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id),
    currentUserId
      ? supabase
          .from("blog_likes")
          .select("id")
          .eq("post_id", post.id)
          .eq("user_id", currentUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("blog_gallery_images")
      .select("id, image_url, caption, sort_order")
      .eq("post_id", post.id)
      .order("sort_order", { ascending: true }),
  ]);

  const likeCount = (likesRes as any).count ?? 0;
  const hasLiked = !!userLikeRes.data;
  const galleryImages = galleryRes.data ?? [];

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/Denver",
      })
    : null;

  // Helper to render inline markdown (bold, italic)
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Handle **bold** and *italic* (but not list markers)
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Match **bold**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Add text before the match
        if (boldMatch.index > 0) {
          parts.push(remaining.slice(0, boldMatch.index));
        }
        // Add the bold text
        parts.push(<strong key={`bold-${keyIndex++}`} className="font-semibold text-[var(--color-text-primary)]">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      // No more matches, add the rest
      parts.push(remaining);
      break;
    }

    return parts.length === 1 ? parts[0] : parts;
  };

  // Simple markdown-like rendering (paragraphs, headers, lists)
  const renderContent = (content: string) => {
    // Split by single or double newlines to handle both formats
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: "ul" | "ol" | null = null;
    let blockIndex = 0;

    const flushList = () => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        const listClass = listType === "ul"
          ? "list-disc list-outside ml-6 space-y-2 my-4 text-[var(--color-text-secondary)]"
          : "list-decimal list-outside ml-6 space-y-2 my-4 text-[var(--color-text-secondary)]";
        elements.push(
          <ListTag key={`list-${blockIndex++}`} className={listClass}>
            {currentList.map((item, j) => (
              <li key={j}>{renderInlineMarkdown(item)}</li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines (they just separate blocks)
      if (trimmedLine === "") {
        flushList();
        continue;
      }

      // Headers
      if (trimmedLine.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={`h3-${blockIndex++}`} className="text-xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mt-8 mb-4">
            {renderInlineMarkdown(trimmedLine.replace("### ", ""))}
          </h3>
        );
        continue;
      }
      if (trimmedLine.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={`h2-${blockIndex++}`} className="text-2xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mt-10 mb-4">
            {renderInlineMarkdown(trimmedLine.replace("## ", ""))}
          </h2>
        );
        continue;
      }
      if (trimmedLine.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={`h1-${blockIndex++}`} className="text-3xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mt-12 mb-6">
            {renderInlineMarkdown(trimmedLine.replace("# ", ""))}
          </h1>
        );
        continue;
      }

      // Bullet lists (support both * and -)
      if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        currentList.push(trimmedLine.replace(/^[*-] /, ""));
        continue;
      }

      // Numbered lists
      if (/^\d+\. /.test(trimmedLine)) {
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        currentList.push(trimmedLine.replace(/^\d+\. /, ""));
        continue;
      }

      // Blockquote
      if (trimmedLine.startsWith("> ")) {
        flushList();
        // Collect consecutive blockquote lines
        let quoteContent = trimmedLine.replace(/^> ?/, "");
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith("> ")) {
          i++;
          quoteContent += "\n" + lines[i].trim().replace(/^> ?/, "");
        }
        elements.push(
          <blockquote
            key={`quote-${blockIndex++}`}
            className="border-l-4 border-[var(--color-border-accent)] pl-4 my-6 text-[var(--color-text-tertiary)] italic"
          >
            {renderInlineMarkdown(quoteContent)}
          </blockquote>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${blockIndex++}`} className="text-[var(--color-text-secondary)] leading-relaxed my-4">
          {renderInlineMarkdown(trimmedLine)}
        </p>
      );
    }

    // Flush any remaining list
    flushList();

    return elements;
  };

  // Handle array response from Supabase join
  const authorData = post.author;
  const author = Array.isArray(authorData) ? authorData[0] : authorData;

  return (
    <article className="min-h-screen">
      {/* Hero with cover image - constrained width for smaller display */}
      {post.cover_image_url && (
        <div className="max-w-2xl mx-auto px-4 pt-8">
          <div className="relative aspect-[4/3] w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- Blog cover images from user uploads; dimensions vary, next/image requires controlled sizing */}
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        </div>
      )}

      <PageContainer typography>
        <div className="max-w-3xl mx-auto py-12">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="text-sm px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] border border-[var(--color-border-accent)]/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6">
            {post.title}
          </h1>

          {/* Author info */}
          <div className="flex items-center gap-4 pb-8 mb-8 border-b border-[var(--color-border-subtle)]">
            {author?.slug ? (
              <Link href={`/songwriters/${author.slug}`} className="flex items-center gap-4 group">
                {author.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Author avatar from user uploads; fixed size but external domain
                  <img
                    src={author.avatar_url}
                    alt={author.full_name ?? "Author"}
                    className="w-12 h-12 rounded-full object-cover group-hover:ring-2 ring-[var(--color-accent-primary)] transition-all"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center group-hover:ring-2 ring-[var(--color-accent-primary)] transition-all">
                    <span className="text-[var(--color-text-accent)] text-lg">
                      {author.full_name?.[0] ?? "?"}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[var(--color-text-primary)] font-medium group-hover:text-[var(--color-text-accent)] transition-colors">
                    {author.full_name ?? "Anonymous"}
                  </p>
                  {formattedDate && (
                    <p className="text-[var(--color-text-tertiary)] text-sm">{formattedDate}</p>
                  )}
                </div>
              </Link>
            ) : (
              <>
                {author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Author avatar from user uploads; fixed size but external domain
                  <img
                    src={author.avatar_url}
                    alt={author?.full_name ?? "Author"}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                    <span className="text-[var(--color-text-accent)] text-lg">
                      {author?.full_name?.[0] ?? "?"}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[var(--color-text-primary)] font-medium">
                    {author?.full_name ?? "Anonymous"}
                  </p>
                  {formattedDate && (
                    <p className="text-[var(--color-text-tertiary)] text-sm">{formattedDate}</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Content */}
          <div className="prose max-w-none">
            {renderContent(post.content)}
          </div>

          {/* Photo Gallery */}
          {galleryImages.length > 0 && (
            <div className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
              <h3 className="text-lg font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-6">
                Photo Gallery
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {galleryImages.map((image: { id: string; image_url: string; caption: string | null }) => (
                  <div key={image.id} className="group relative">
                    <div className="aspect-square rounded-lg overflow-hidden bg-[var(--color-bg-tertiary)]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Gallery images from user uploads; dimensions vary per image */}
                      <img
                        src={image.image_url}
                        alt={image.caption || "Gallery image"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    {image.caption && (
                      <p className="mt-2 text-sm text-[var(--color-text-tertiary)] text-center">
                        {image.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Like button */}
          <BlogInteractions
            postId={post.id}
            initialLikeCount={likeCount}
            initialHasLiked={hasLiked}
          />

          {/* Author bio */}
          {author?.bio && (
            <div className="mt-12 pt-8 border-t border-[var(--color-border-subtle)]">
              <h3 className="text-lg font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
                About the Author
              </h3>
              {author.slug ? (
                <Link href={`/songwriters/${author.slug}`} className="flex items-start gap-4 group">
                  {author.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Author avatar from user uploads; fixed size but external domain
                    <img
                      src={author.avatar_url}
                      alt={author.full_name ?? "Author"}
                      className="w-16 h-16 rounded-full object-cover group-hover:ring-2 ring-[var(--color-accent-primary)] transition-all"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center group-hover:ring-2 ring-[var(--color-accent-primary)] transition-all">
                      <span className="text-[var(--color-text-accent)] text-xl">
                        {author.full_name?.[0] ?? "?"}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[var(--color-text-primary)] font-medium mb-2 group-hover:text-[var(--color-text-accent)] transition-colors">
                      {author.full_name}
                    </p>
                    <p className="text-[var(--color-text-secondary)] text-sm">{author.bio}</p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-start gap-4">
                  {author.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Author avatar from user uploads; fixed size but external domain
                    <img
                      src={author.avatar_url}
                      alt={author.full_name ?? "Author"}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
                      <span className="text-[var(--color-text-accent)] text-xl">
                        {author.full_name?.[0] ?? "?"}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-[var(--color-text-primary)] font-medium mb-2">
                      {author.full_name}
                    </p>
                    <p className="text-[var(--color-text-secondary)] text-sm">{author.bio}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments section */}
          <BlogComments postId={post.id} />
        </div>
      </PageContainer>
    </article>
  );
}
