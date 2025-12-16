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
            <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] drop-shadow-lg">
              Blog
            </h1>
            <p className="text-lg text-[var(--color-text-accent)] mt-2 drop-shadow">
              Stories, tips, and insights from the Denver songwriting community.{" "}
              <Link href="/dashboard/blog" className="underline hover:text-white transition-colors">Share your own!</Link>
            </p>
          </div>
        </div>
      </div>

      <PageContainer>
        <div className="py-12">
          {posts && posts.length > 0 ? (
            <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
      className="group block rounded-xl border border-white/10 bg-gradient-to-br from-[var(--color-indigo-950)] to-[var(--color-background)] overflow-hidden hover:border-[var(--color-border-accent)]/30 transition-colors"
    >
      {post.cover_image_url && (
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4 space-y-2">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] border border-[var(--color-border-accent)]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 className="text-base font-[var(--font-family-serif)] text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors line-clamp-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-neutral-400 text-xs line-clamp-2">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {author?.avatar_url ? (
            <Image
              src={author.avatar_url}
              alt={author.full_name ?? "Author"}
              width={24}
              height={24}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--color-accent-primary)]/20 flex items-center justify-center">
              <span className="text-[var(--color-text-accent)] text-xs">
                {author?.full_name?.[0] ?? "?"}
              </span>
            </div>
          )}
          <div className="text-xs">
            <p className="text-neutral-300">{author?.full_name ?? "Anonymous"}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
