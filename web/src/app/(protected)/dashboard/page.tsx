import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageContainer, HeroSection } from "@/components/layout";
import { PerformerAvatar } from "@/components/performers";
import { WelcomeToast } from "./WelcomeToast";
import { Suspense } from "react";
import Link from "next/link";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type DBProfile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

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
                <Link href="/events" className="text-gold-400 hover:underline">Browse Events</Link>
              </li>
              <li>
                <Link href="/performers" className="text-gold-400 hover:underline">Explore Performers</Link>
              </li>
              <li>
                <Link href="/studios" className="text-gold-400 hover:underline">Find Studios</Link>
              </li>

              {p?.role === "performer" && (
                <li>
                  <Link href="/events" className="text-gold-400 hover:underline">Claim an Open Mic Slot</Link>
                </li>
              )}

              {p?.role === "studio" && (
                <li>
                  <Link href="/studios" className="text-gold-400 hover:underline">Manage Your Services (coming soon)</Link>
                </li>
              )}

              {p?.role === "host" && (
                <li>
                  <Link href="/events/manage" className="text-gold-400 hover:underline">Host Dashboard (coming soon)</Link>
                </li>
              )}

              {p?.role === "admin" && (
                <li>
                  <Link href="/dashboard/admin" className="text-gold-400 hover:underline">Admin Panel</Link>
                </li>
              )}

              <li className="pt-4 mt-4 border-t border-neutral-800">
                <Link href="/dashboard/settings" className="text-gold-400 hover:underline">Account Settings</Link>
              </li>
            </ul>
          </section>
        </div>
      </PageContainer>
    </>
  );
}
