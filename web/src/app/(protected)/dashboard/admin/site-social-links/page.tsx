import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { SiteSocialLinksSettings } from "@/components/admin/SiteSocialLinksSettings";

export const dynamic = "force-dynamic";

export default async function AdminSiteSocialLinksPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  const siteSettings = await getSiteSettings();

  return (
    <main className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard/admin"
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
        >
          ← Back to Admin Dashboard
        </Link>
        <h1 className="font-[var(--font-family-display)] text-3xl text-[var(--color-text-primary)]">
          Site Social Links
        </h1>
        <p className="text-[var(--color-text-secondary)] mt-2 mb-6">
          Manage global social links shown in the site header and footer.
        </p>

        <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
          <SiteSocialLinksSettings
            initialLinks={siteSettings.socialLinks}
            initialHeroImageUrl={siteSettings.heroImageUrl}
            initialEmailHeaderImageUrl={siteSettings.emailHeaderImageUrl}
            initialYoutubePlaylistUrl={siteSettings.youtubePlaylistUrl}
            initialSpotifyPlaylistUrl={siteSettings.spotifyPlaylistUrl}
          />
        </section>
      </div>
    </main>
  );
}
