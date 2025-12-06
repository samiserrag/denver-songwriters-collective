import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer } from "@/components/layout";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    return { title: "Post Not Found | Denver Songwriters Collective" };
  }

  return {
    title: `${post.title} | Denver Songwriters Collective`,
    description: post.excerpt ?? undefined,
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
      author:profiles!blog_posts_author_id_fkey(full_name, avatar_url, bio)
    `)
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!post) {
    notFound();
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Simple markdown-like rendering (paragraphs, headers, lists)
  const renderContent = (content: string) => {
    return content.split("\n\n").map((block, i) => {
      // Headers
      if (block.startsWith("### ")) {
        return (
          <h3 key={i} className="text-xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mt-8 mb-4">
            {block.replace("### ", "")}
          </h3>
        );
      }
      if (block.startsWith("## ")) {
        return (
          <h2 key={i} className="text-2xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mt-10 mb-4">
            {block.replace("## ", "")}
          </h2>
        );
      }
      if (block.startsWith("# ")) {
        return (
          <h1 key={i} className="text-3xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mt-12 mb-6">
            {block.replace("# ", "")}
          </h1>
        );
      }

      // Bullet lists
      if (block.includes("\n- ") || block.startsWith("- ")) {
        const items = block.split("\n").filter((line) => line.startsWith("- "));
        return (
          <ul key={i} className="list-disc list-inside space-y-2 my-4 text-neutral-300">
            {items.map((item, j) => (
              <li key={j}>{item.replace("- ", "")}</li>
            ))}
          </ul>
        );
      }

      // Numbered lists
      if (/^\d+\. /.test(block)) {
        const items = block.split("\n").filter((line) => /^\d+\. /.test(line));
        return (
          <ol key={i} className="list-decimal list-inside space-y-2 my-4 text-neutral-300">
            {items.map((item, j) => (
              <li key={j}>{item.replace(/^\d+\. /, "")}</li>
            ))}
          </ol>
        );
      }

      // Blockquote
      if (block.startsWith("> ")) {
        return (
          <blockquote
            key={i}
            className="border-l-4 border-[var(--color-gold)] pl-4 my-6 text-neutral-400 italic"
          >
            {block.replace(/^> /gm, "")}
          </blockquote>
        );
      }

      // Regular paragraph
      return (
        <p key={i} className="text-neutral-300 leading-relaxed my-4">
          {block}
        </p>
      );
    });
  };

  // Handle array response from Supabase join
  const authorData = post.author;
  const author = Array.isArray(authorData) ? authorData[0] : authorData;

  return (
    <article className="min-h-screen">
      {/* Hero with cover image */}
      {post.cover_image_url && (
        <div className="relative w-full h-[40vh] md:h-[50vh]">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/50 to-transparent" />
        </div>
      )}

      <PageContainer>
        <div className="max-w-3xl mx-auto py-12">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-[var(--color-gold)] transition-colors mb-8"
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
                  className="text-xs px-2 py-1 rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-6">
            {post.title}
          </h1>

          {/* Author info */}
          <div className="flex items-center gap-4 pb-8 mb-8 border-b border-white/10">
            {author?.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.full_name ?? "Author"}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                <span className="text-[var(--color-gold)] text-lg">
                  {author?.full_name?.[0] ?? "?"}
                </span>
              </div>
            )}
            <div>
              <p className="text-[var(--color-warm-white)] font-medium">
                {author?.full_name ?? "Anonymous"}
              </p>
              {formattedDate && (
                <p className="text-neutral-500 text-sm">{formattedDate}</p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            {renderContent(post.content)}
          </div>

          {/* Author bio */}
          {author?.bio && (
            <div className="mt-12 pt-8 border-t border-white/10">
              <h3 className="text-lg font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-4">
                About the Author
              </h3>
              <div className="flex items-start gap-4">
                {author.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.full_name ?? "Author"}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
                    <span className="text-[var(--color-gold)] text-xl">
                      {author.full_name?.[0] ?? "?"}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-[var(--color-warm-white)] font-medium mb-2">
                    {author.full_name}
                  </p>
                  <p className="text-neutral-400 text-sm">{author.bio}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    </article>
  );
}
