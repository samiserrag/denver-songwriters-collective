import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, HeroSection } from "@/components/layout";
import { Button } from "@/components/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFriendsOfCollective } from "@/lib/friends-of-the-collective";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { toFriendView, type OrganizationRecord } from "@/lib/organizations";

const FRIENDS_PAGE_PUBLIC = process.env.NEXT_PUBLIC_FRIENDS_PAGE_PUBLIC === "true";

export const metadata: Metadata = {
  title: "Friends of the Collective | The Colorado Songwriters Collective",
  description:
    "A growing directory of Colorado organizations, collectives, and community spaces that support songwriters.",
  robots: "noindex, nofollow",
};

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function getFriendImageUrl(friend: {
  coverImageUrl?: string;
  logoImageUrl?: string;
  websiteUrl: string;
}): string | null {
  if (friend.coverImageUrl) return friend.coverImageUrl;
  if (friend.logoImageUrl) return friend.logoImageUrl;
  try {
    return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(friend.websiteUrl)}`;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

async function enforcePrivateAccessUntilLaunch() {
  if (FRIENDS_PAGE_PUBLIC) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") notFound();
}

async function loadOrganizationsForPage(isPublicMode: boolean) {
  const serviceClient = createServiceRoleClient();
  let query = (serviceClient as any)
    .from("organizations")
    .select(
      "id, slug, name, website_url, city, organization_type, short_blurb, why_it_matters, tags, featured, is_active, visibility, logo_image_url, cover_image_url, gallery_image_urls, fun_note, sort_order"
    )
    .eq("is_active", true)
    .order("featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (isPublicMode) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query;
  if (error) {
    // Graceful fallback while migration may still be pending in some environments.
    console.error("Friends organizations query failed, using fallback:", error);
    return getFriendsOfCollective();
  }

  return ((data || []) as OrganizationRecord[]).map(toFriendView);
}

export default async function FriendsOfTheCollectivePage() {
  await enforcePrivateAccessUntilLaunch();

  const friends = await loadOrganizationsForPage(FRIENDS_PAGE_PUBLIC);
  const featured = friends.filter((friend) => friend.featured);
  const standard = friends.filter((friend) => !friend.featured);

  return (
    <>
      <HeroSection minHeight="sm" showVignette showBottomFade>
        <div className="text-center px-6 py-8">
          <h1 className="font-[var(--font-family-display)] font-bold text-4xl md:text-5xl lg:text-6xl text-white tracking-tight mb-3 drop-shadow-lg">
            Friends of the Collective
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-2 max-w-3xl mx-auto drop-shadow">
            A living list of Colorado organizations and communities that help songwriters grow, connect, and stay visible.
          </p>
          <p className="text-sm md:text-base text-white/80 max-w-3xl mx-auto">
            This page celebrates collaborators. It is not a ranking.
          </p>
        </div>
      </HeroSection>

      <PageContainer>
        <div className="py-10 space-y-10 max-w-6xl mx-auto">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                Why This Exists
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                Songwriters need an ecosystem, not just one stage. We want to recognize the people and organizations doing that work across Colorado.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                How We Curate
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                We prioritize organizations that consistently create opportunities, education, connection, and real support for songwriters.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
              <h2 className="text-lg font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-2">
                Suggest an Addition
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
                Know an organization we should include? Send it to us and we will review it.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/feedback">Suggest an Organization</Link>
              </Button>
            </div>
          </section>

          {friends.length === 0 ? (
            <section className="rounded-3xl border border-[var(--color-border-accent)]/40 bg-[var(--color-bg-secondary)] p-8 text-center">
              <h2 className="text-2xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)] mb-3">
                Directory Coming Online
              </h2>
              <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-6">
                We are assembling this list now. If you already have organizations in mind, send them through feedback and we will start publishing them.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/feedback">Submit Recommendations</Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/partners">Partnership Opportunities</Link>
                </Button>
              </div>
            </section>
          ) : (
            <>
              {featured.length > 0 && (
                <section className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                      Featured Friends
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {featured.map((friend) => {
                      const imageUrl = getFriendImageUrl(friend);
                      return (
                      <article
                        key={friend.id}
                        className="rounded-2xl border border-[var(--color-border-accent)]/40 bg-[var(--color-bg-secondary)] p-6 space-y-4"
                      >
                        <div className="space-y-1">
                          <h3 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                            {friend.name}
                          </h3>
                          <p className="text-xs tracking-wide uppercase text-[var(--color-text-tertiary)]">
                            {friend.organizationType || "Community Organization"}
                            {friend.city ? ` • ${friend.city}` : ""}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          {friend.shortBlurb}
                        </p>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${friend.name} cover`}
                            className="w-full h-36 object-cover rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-36 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <span className="text-sm text-[var(--color-text-tertiary)]">
                              Image coming soon
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                          {friend.whyItMatters}
                        </p>
                        {friend.funNote && (
                          <p className="text-sm italic text-[var(--color-text-secondary)]">
                            {friend.funNote}
                          </p>
                        )}
                        {friend.tags && friend.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {friend.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-1 rounded-full text-xs border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="pt-2 flex items-center justify-between gap-3">
                          <a
                            href={friend.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-text-accent)] hover:underline"
                          >
                            Visit Site
                          </a>
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            {hostnameFromUrl(friend.websiteUrl)}
                          </span>
                        </div>
                        <div className="pt-1">
                          <Link
                            href="/dashboard/my-organizations"
                            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)] underline-offset-2 hover:underline"
                          >
                            Represent this organization? Claim or update this profile.
                          </Link>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                </section>
              )}

              {standard.length > 0 && (
                <section className="space-y-5">
                  <h2 className="text-2xl md:text-3xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                    Community Directory
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {standard.map((friend) => {
                      const imageUrl = getFriendImageUrl(friend);
                      return (
                      <article
                        key={friend.id}
                        className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 space-y-4"
                      >
                        <div className="space-y-1">
                          <h3 className="text-xl font-[var(--font-family-serif)] font-semibold text-[var(--color-text-primary)]">
                            {friend.name}
                          </h3>
                          <p className="text-xs tracking-wide uppercase text-[var(--color-text-tertiary)]">
                            {friend.organizationType || "Community Organization"}
                            {friend.city ? ` • ${friend.city}` : ""}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                          {friend.shortBlurb}
                        </p>
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={`${friend.name} cover`}
                            className="w-full h-36 object-cover rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-36 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] flex items-center justify-center">
                            <span className="text-sm text-[var(--color-text-tertiary)]">
                              Image coming soon
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                          {friend.whyItMatters}
                        </p>
                        {friend.funNote && (
                          <p className="text-sm italic text-[var(--color-text-secondary)]">
                            {friend.funNote}
                          </p>
                        )}
                        {friend.tags && friend.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {friend.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2.5 py-1 rounded-full text-xs border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="pt-2 flex items-center justify-between gap-3">
                          <a
                            href={friend.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--color-text-accent)] hover:underline"
                          >
                            Visit Site
                          </a>
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            {hostnameFromUrl(friend.websiteUrl)}
                          </span>
                        </div>
                        <div className="pt-1">
                          <Link
                            href="/dashboard/my-organizations"
                            className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-accent)] underline-offset-2 hover:underline"
                          >
                            Represent this organization? Claim or update this profile.
                          </Link>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </>
  );
}
