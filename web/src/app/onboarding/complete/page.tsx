"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function OnboardingComplete() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRole(profile.role);
        setDisplayName(profile.full_name);
      }
    }
    loadProfile();
  }, [supabase, router]);

  const roleLabels: Record<string, string> = {
    performer: "Performer",
    host: "Open Mic Host",
    studio: "Studio",
    fan: "Supporter",
    admin: "Admin",
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center px-4 py-12">
      {/* Progress indicator - complete */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-3 h-3 rounded-full bg-[var(--color-accent-primary)]" />
        <div className="w-12 h-0.5 bg-[var(--color-accent-primary)]" />
        <div className="w-3 h-3 rounded-full bg-[var(--color-accent-primary)]" />
        <div className="w-12 h-0.5 bg-[var(--color-accent-primary)]" />
        <div className="w-3 h-3 rounded-full bg-[var(--color-accent-primary)]" />
      </div>

      <div className="max-w-lg w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl md:text-4xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-4">
          You&apos;re All Set{displayName ? `, ${displayName}` : ""}!
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mb-8">
          Welcome to the Denver Songwriters Collective community.
          {role && ` You've joined as a ${roleLabels[role] || role}.`}
        </p>

        <div className="bg-white/5 rounded-2xl border border-white/10 p-6 mb-8">
          <h2 className="text-xl text-[var(--color-text-primary)] mb-4">What&apos;s Next?</h2>
          <div className="space-y-4 text-left">
            {role === "performer" && (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-xl">🎤</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Find an Open Mic</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Browse our directory of open mics across Denver and sign up to perform.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">📅</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Check Out Events</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Discover showcases, songwriting workshops, and networking events.
                    </p>
                  </div>
                </div>
              </>
            )}
            {role === "host" && (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">List Your Open Mic</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Add your venue to our directory and reach Denver&apos;s music community.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">👥</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Manage Sign-ups</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Let performers RSVP for slots and display the lineup on a screen.
                    </p>
                  </div>
                </div>
              </>
            )}
            {role === "studio" && (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-xl">🎧</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Showcase Your Studio</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Add your services and availability for Denver musicians.
                    </p>
                  </div>
                </div>
              </>
            )}
            {role === "fan" && (
              <>
                <div className="flex items-start gap-3">
                  <span className="text-xl">🎵</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Discover Local Artists</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Explore performers in the Denver area and support their music.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xl">💜</span>
                  <div>
                    <h3 className="font-medium text-[var(--color-text-primary)]">Support the Community</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Attend open mics, tip performers, and help grow the scene.
                    </p>
                  </div>
                </div>
              </>
            )}
            {!role && (
              <div className="flex items-start gap-3">
                <span className="text-xl">🎵</span>
                <div>
                  <h3 className="font-medium text-[var(--color-text-primary)]">Explore the Community</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Check out open mics, events, and connect with local musicians.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/open-mics"
            className="px-6 py-3 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold transition-colors"
          >
            Browse Open Mics
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-white/20 hover:border-white/40 text-[var(--color-text-primary)] font-semibold transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
