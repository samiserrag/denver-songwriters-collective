import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";

export const metadata: Metadata = {
  title: "Blog | Denver Songwriters Collective",
  description: "Stories, tips, and insights from the Denver songwriting community.",
};

export const dynamic = "force-dynamic";

interface BlogPostAuthor {
  full_name: string | null;
  avatar_url: string | null;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  tags: string[];
  author: BlogPostAuthor | BlogPostAuthor[] | null;
}

export default async function BlogPage() {
  const supabase = await createSupabaseServerClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select(`
      id,
      slug,
      title,
      excerpt,
      cover_image_url,
      published_at,
      tags,
      author:profiles!blog_posts_author_id_fkey(full_name, avatar_url)
    `)
    .eq("is_published", true)
    .eq("is_approved", true)
    .order("published_at", { ascending: false });

  return (
    <>
      {/* Hero Header with Background Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image
          src="/images/open-mic-hero-optimized.jpg"
          alt="Denver Songwriters Blog"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-background)] via-[var(--color-background)]/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center px-4">
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] drop-shadow-lg">
              Blog
            </h1>
            <p className="text-lg text-[var(--color-gold)] mt-2 drop-shadow">
              Stories, tips, and insights from the Denver songwriting community.{" "}
              <Link href="/dashboard/blog" className="underline hover:text-white transition-colors">Share your own!</Link>
            </p>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {posts && posts.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post as BlogPost} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-neutral-400 text-lg">
                No blog posts yet. Check back soon!
              </p>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  // Handle array response from Supabase join
  const authorData = post.author;
  const author = Array.isArray(authorData) ? authorData[0] : authorData;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-2xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] overflow-hidden hover:border-[var(--color-gold)]/30 transition-colors"
    >
      {post.cover_image_url && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-6 space-y-3">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 className="text-xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] group-hover:text-[var(--color-gold)] transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-neutral-400 text-sm line-clamp-3">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 pt-2">
          {author?.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt={author.full_name ?? "Author"}
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--color-gold)]/20 flex items-center justify-center">
              <span className="text-[var(--color-gold)] text-sm">
                {author?.full_name?.[0] ?? "?"}
              </span>
            </div>
          )}
          <div className="text-sm">
            <p className="text-neutral-300">{author?.full_name ?? "Anonymous"}</p>
            {formattedDate && (
              <p className="text-neutral-500 text-xs">{formattedDate}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
