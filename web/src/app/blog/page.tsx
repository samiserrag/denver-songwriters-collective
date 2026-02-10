import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";

export const metadata: Metadata = {
  title: "Blog | The Colorado Songwriters Collective",
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

  const { data: posts, error: postsError } = await supabase
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

  const hasLoadError = Boolean(postsError);

  return (
    <>
      {/* Hero Section */}
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-3 drop-shadow-lg">
            Collective Blog
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-6 max-w-2xl mx-auto drop-shadow">
            Stories from the local songwriting scene
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/happenings"
              className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] font-semibold rounded-full hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              See happenings
            </Link>
            <Link
              href="/dashboard/blog"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/20 backdrop-blur text-white font-semibold rounded-full hover:bg-white/30 transition-colors border border-white/30"
            >
              Share your story
            </Link>
          </div>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-10">
          {hasLoadError ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-[var(--color-text-secondary)] text-lg">
                We are having trouble loading blog posts right now.
              </p>
              <p className="text-[var(--color-text-tertiary)] text-sm">
                Please refresh this page or try again in a few minutes.
              </p>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post as BlogPost} />
              ))}

              {/* Share Your Story CTA Card */}
              <Link
                href="/dashboard/blog"
                className="group block rounded-xl border border-dashed border-[var(--color-border-accent)]/40 bg-gradient-to-br from-[var(--color-accent-primary)]/10 to-transparent overflow-hidden hover:border-[var(--color-border-accent)] transition-colors"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
                  <svg className="w-12 h-12 text-[var(--color-text-accent)]/50 group-hover:text-[var(--color-text-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="p-4 space-y-2">
                  <h2 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors">
                    Share Your Story
                  </h2>
                  <p className="text-[var(--color-text-secondary)] text-sm line-clamp-2">
                    Got advice, insights, or a journey to share? Add your voice to the community.
                  </p>
                  <span className="inline-flex items-center gap-1 text-[var(--color-text-accent)] text-sm font-medium pt-1">
                    Write a post
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="text-center py-16 space-y-6">
              <p className="text-[var(--color-text-secondary)] text-lg">
                No blog posts yet. Be the first to share your story!
              </p>
              <Link
                href="/dashboard/blog"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Write the First Post
              </Link>
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

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] overflow-hidden transition-shadow transition-colors duration-200 ease-out hover:shadow-md hover:border-[var(--color-accent-primary)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
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
      <div className="p-4 space-y-2 text-center">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-sm tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] border border-[var(--color-border-accent)]/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <h2 className="text-lg md:text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] tracking-tight group-hover:text-[var(--color-text-accent)] transition-colors line-clamp-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-[var(--color-text-secondary)] text-sm line-clamp-2 text-left mx-auto max-w-prose">
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center justify-center gap-2 pt-1">
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
              <span className="text-[var(--color-text-accent)] text-sm">
                {author?.full_name?.[0] ?? "?"}
              </span>
            </div>
          )}
          <div className="text-sm">
            <p className="text-[var(--color-text-primary)]">{author?.full_name ?? "Anonymous"}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
