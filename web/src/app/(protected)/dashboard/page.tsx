import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import { WelcomeToast } from "./WelcomeToast";
import { Suspense } from "react";
import type { Database } from "@/lib/supabase/database.types";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageContainer className="py-24 text-center text-red-400">
        <p>Not authenticated.</p>
      </PageContainer>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const p = profile as DBProfile | null;

  return (
    <>
      <Suspense fallback={null}>
        <WelcomeToast />
      </Suspense>
      <HeroSection minHeight="md">
        <PageContainer>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <PerformerAvatar
              src={p?.avatar_url ?? undefined}
              alt={p?.full_name ?? "User"}
              size="lg"
            />
            <div>
              <h1 className="text-gradient-gold text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-3">
                Welcome, {p?.full_name ?? "User"}
              </h1>
              <p className="text-neutral-300 text-lg">
                Role: <span className="text-gold-400">{p?.role}</span>
              </p>
            </div>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-12 space-y-10">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              Quick Actions
            </h2>

            <ul className="space-y-3 text-neutral-300 text-lg">
              <li>
                <a href="/events" className="text-gold-400 hover:underline">
                  Browse Events
                </a>
              </li>
              <li>
                <a href="/performers" className="text-gold-400 hover:underline">
                  Explore Performers
                </a>
              </li>
              <li>
                <a href="/studios" className="text-gold-400 hover:underline">
                  Find Studios
                </a>
              </li>

              {p?.role === "performer" && (
                <li>
                  <a href="/events" className="text-gold-400 hover:underline">
                    Claim an Open Mic Slot
                  </a>
                </li>
              )}

              {p?.role === "studio" && (
                <li>
                  <a href="/studios" className="text-gold-400 hover:underline">
                    Manage Your Services (coming soon)
                  </a>
                </li>
              )}

              {p?.role === "host" && (
                <li>
                  <a href="/events/manage" className="text-gold-400 hover:underline">
                    Host Dashboard (coming soon)
                  </a>
                </li>
              )}

              {p?.role === "admin" && (
                <li>
                  <a href="/dashboard/admin" className="text-gold-400 hover:underline">
                    Admin Panel
                  </a>
                </li>
              )}
            </ul>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
