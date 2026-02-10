"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS } from "@/lib/profile/options";
import { consumePendingRedirect } from "@/lib/auth/pendingRedirect";
import {
  getRelevantSections,
  type SectionKey,
} from "./sectionVisibility";

// =============================================================================
// Conditional Step Logic
// =============================================================================

/**
 * Check if a section should be displayed based on current identity flags.
 */
function isSectionVisible(section: SectionKey, relevantSections: SectionKey[]): boolean {
  return relevantSections.includes(section);
}

export default function OnboardingProfile() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Required
  const [name, setName] = useState("");

  // Identity flags
  const [isSongwriter, setIsSongwriter] = useState(false);
  const [isStudio, setIsStudio] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isFan, setIsFan] = useState(false);

  // About
  const [bio, setBio] = useState("");

  // Social links
  const [instagramUrl, setInstagramUrl] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [bandcampUrl, setBandcampUrl] = useState("");

  // Tipping
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashappHandle, setCashappHandle] = useState("");
  const [paypalUrl, setPaypalUrl] = useState("");

  // Collaboration
  const [openToCollabs, setOpenToCollabs] = useState(false);
  const [interestedInCowriting, setInterestedInCowriting] = useState(false);

  // Instruments & Genres
  const [instruments, setInstruments] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [customInstrument, setCustomInstrument] = useState("");
  const [customGenre, setCustomGenre] = useState("");

  // Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // Compute which sections are relevant based on current identity flags
  const relevantSections = useMemo(() => {
    return getRelevantSections({
      is_songwriter: isSongwriter,
      is_host: isHost,
      is_studio: isStudio,
      is_fan: isFan,
    });
  }, [isSongwriter, isHost, isStudio, isFan]);

  // Load existing profile data
  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profile) {
          setName(profile.full_name || "");
          setIsSongwriter(profile.is_songwriter || false);
          setIsStudio(profile.is_studio || false);
          setIsHost(profile.is_host || false);
          setIsFan(profile.is_fan || false);
          setBio(profile.bio || "");
          setInstagramUrl(profile.instagram_url || "");
          setSpotifyUrl(profile.spotify_url || "");
          setYoutubeUrl(profile.youtube_url || "");
          setWebsiteUrl(profile.website_url || "");
          setTiktokUrl(profile.tiktok_url || "");
          setBandcampUrl(profile.bandcamp_url || "");
          setVenmoHandle(profile.venmo_handle || "");
          setCashappHandle(profile.cashapp_handle || "");
          setPaypalUrl(profile.paypal_url || "");
          setOpenToCollabs(profile.open_to_collabs || false);
          setInterestedInCowriting(profile.interested_in_cowriting || false);
          setInstruments(profile.instruments || []);
          setGenres(profile.genres || []);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [supabase, router]);

  const toggleSection = (section: string) => {
    const newSections = new Set(openSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setOpenSections(newSections);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      console.log("[Onboarding] Saving profile via API route");

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim() || null,
          is_songwriter: isSongwriter,
          is_host: isHost,
          is_studio: isStudio,
          is_fan: isFan,
          bio: bio || null,
          instagram_url: instagramUrl || null,
          spotify_url: spotifyUrl || null,
          youtube_url: youtubeUrl || null,
          website_url: websiteUrl || null,
          tiktok_url: tiktokUrl || null,
          bandcamp_url: bandcampUrl || null,
          venmo_handle: venmoHandle || null,
          cashapp_handle: cashappHandle || null,
          paypal_url: paypalUrl || null,
          open_to_collabs: openToCollabs,
          interested_in_cowriting: interestedInCowriting,
          instruments: instruments.length > 0 ? instruments : null,
          genres: genres.length > 0 ? genres : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      console.log("[Onboarding] Profile updated successfully, checking for pending redirect");

      // Check for pending redirect (e.g., invite link that started this signup)
      const pendingRedirect = consumePendingRedirect();
      const targetUrl = pendingRedirect || "/dashboard?welcome=1";

      console.log(`[Onboarding] Redirecting to: ${targetUrl}`);

      // Use window.location for a hard redirect to ensure proxy re-runs with fresh state
      window.location.href = targetUrl;
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    setError(null);

    try {
      console.log("[Onboarding] Skipping via API route, saving all provided data");

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name.trim() || null,
          is_songwriter: isSongwriter,
          is_host: isHost,
          is_studio: isStudio,
          is_fan: isFan,
          bio: bio || null,
          instagram_url: instagramUrl || null,
          spotify_url: spotifyUrl || null,
          youtube_url: youtubeUrl || null,
          website_url: websiteUrl || null,
          tiktok_url: tiktokUrl || null,
          bandcamp_url: bandcampUrl || null,
          venmo_handle: venmoHandle || null,
          cashapp_handle: cashappHandle || null,
          paypal_url: paypalUrl || null,
          open_to_collabs: openToCollabs,
          interested_in_cowriting: interestedInCowriting,
          instruments: instruments.length > 0 ? instruments : null,
          genres: genres.length > 0 ? genres : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save profile');
      }

      console.log("[Onboarding] Profile updated, checking for pending redirect");

      // Check for pending redirect (e.g., invite link that started this signup)
      const pendingRedirect = consumePendingRedirect();
      const targetUrl = pendingRedirect || "/dashboard";

      console.log(`[Onboarding] Redirecting to: ${targetUrl}`);

      // Use window.location for a hard redirect to ensure proxy re-runs with fresh state
      window.location.href = targetUrl;
    } catch (err) {
      console.error("Unexpected error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-[var(--font-family-serif)] text-[var(--color-text-primary)] mb-3">
            Welcome to the Collective!
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)]">
            You&apos;re in. Now let&apos;s get you set up.
          </p>
        </div>

        {/* Privacy note */}
        <div className="text-center mb-8 px-4">
          <p className="text-sm text-[var(--color-text-tertiary)] leading-relaxed">
            Your email stays private — we only use it to notify you about things you sign up
            for.
            <br />
            No spam, no sharing, and you can delete your account anytime.
          </p>
        </div>

        {/* Main card */}
        <div className="bg-[var(--color-bg-surface)] rounded-2xl p-6 md:p-8 shadow-lg border border-[var(--color-border)]">
          {/* Name field - THE STAR OF THE SHOW */}
          <div className="mb-6">
            <label className="block text-lg font-medium text-[var(--color-text-primary)] mb-2">
              What should we call you?
            </label>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-3">
              This is the only thing we actually need
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-5 py-4 text-xl bg-[var(--color-bg-input)] border-2 border-[var(--color-border-input)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-accent-primary)] focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Primary actions - RIGHT AFTER NAME */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-6 py-4 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] text-lg font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Let's go!"}
            </button>
            <button
              onClick={handleSkip}
              disabled={saving}
              className="flex-1 px-6 py-4 bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] text-lg font-medium rounded-xl border border-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              I&apos;ll finish this later
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded-lg text-red-800 dark:text-red-400 text-center">
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 bg-[var(--color-bg-surface)] text-sm text-[var(--color-text-tertiary)]">
                Optional stuff (if you&apos;re feeling it)
              </span>
            </div>
          </div>

          {/* Community encouragement */}
          <p className="text-center text-sm text-[var(--color-text-secondary)] mb-6 px-2">
            The more you share, the easier it is for artists, fans, and venues to find each
            other.
            <span className="block text-[var(--color-text-tertiary)] mt-1">
              We&apos;re building a community here — your profile helps make that happen.
            </span>
          </p>

          {/* Collapsible sections */}
          <div className="space-y-3">
            {/* How you identify */}
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("identity")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  How you identify
                  <span className="text-[var(--color-text-tertiary)] font-normal ml-1">
                    (you can change this later)
                  </span>
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("identity") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("identity") && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-[var(--color-text-tertiary)] mb-2">
                    These choices help personalize your experience and how you appear to others.
                    They don&apos;t grant permissions.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isSongwriter}
                      onChange={(e) => setIsSongwriter(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-[var(--color-border-input)] bg-[var(--color-bg-input)] checked:bg-[var(--color-accent-primary)] checked:border-[var(--color-accent-primary)] transition-colors accent-[var(--color-accent-primary)]"
                    />
                    <div>
                      <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                        I&apos;m a songwriter, musician, or singer
                      </span>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        I write, perform, or record music
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isHost}
                      onChange={(e) => setIsHost(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-[var(--color-border-input)] bg-[var(--color-bg-input)] checked:bg-[var(--color-accent-primary)] checked:border-[var(--color-accent-primary)] transition-colors accent-[var(--color-accent-primary)]"
                    />
                    <div>
                      <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                        I host open mics
                      </span>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        I host or co-host open mic nights
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isStudio}
                      onChange={(e) => setIsStudio(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-[var(--color-border-input)] bg-[var(--color-bg-input)] checked:bg-[var(--color-accent-primary)] checked:border-[var(--color-accent-primary)] transition-colors accent-[var(--color-accent-primary)]"
                    />
                    <div>
                      <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                        I run a recording studio
                      </span>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        I offer recording, mixing, or production services
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isFan}
                      onChange={(e) => setIsFan(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-[var(--color-border-input)] bg-[var(--color-bg-input)] checked:bg-[var(--color-accent-primary)] checked:border-[var(--color-accent-primary)] transition-colors accent-[var(--color-accent-primary)]"
                    />
                    <div>
                      <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">
                        I&apos;m a music fan and supporter
                      </span>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        I love live music and supporting local artists
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* Instruments & Genres - visible for Songwriter or Fan */}
            {isSectionVisible("instruments", relevantSections) && (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("instruments")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  Instruments & Genres
                  <span className="text-[var(--color-text-tertiary)] font-normal ml-1">
                    (you can change this later)
                  </span>
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("instruments") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("instruments") && (
                <div className="px-4 pb-4 space-y-6">
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Optional—helps people discover you.
                  </p>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Your profile is public by default — you can change this anytime in Profile settings.
                  </p>

                  {/* Instruments */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                      Instruments & Skills
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {INSTRUMENT_OPTIONS.map((instrument) => (
                        <label
                          key={instrument}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                            instruments.includes(instrument)
                              ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={instruments.includes(instrument)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInstruments((prev) => [...prev, instrument]);
                              } else {
                                setInstruments((prev) => prev.filter((i) => i !== instrument));
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{instrument}</span>
                        </label>
                      ))}
                    </div>

                    {/* Custom instrument input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customInstrument}
                        onChange={(e) => setCustomInstrument(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = customInstrument.trim();
                            if (trimmed) {
                              const isDuplicate = instruments.some(
                                (i) => i.toLowerCase() === trimmed.toLowerCase()
                              );
                              if (!isDuplicate) {
                                setInstruments((prev) => [...prev, trimmed]);
                              }
                              setCustomInstrument("");
                            }
                          }
                        }}
                        placeholder="Add your own..."
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder-[var(--color-placeholder)] text-sm focus:outline-none focus:border-[var(--color-border-accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = customInstrument.trim();
                          if (trimmed) {
                            const isDuplicate = instruments.some(
                              (i) => i.toLowerCase() === trimmed.toLowerCase()
                            );
                            if (!isDuplicate) {
                              setInstruments((prev) => [...prev, trimmed]);
                            }
                            setCustomInstrument("");
                          }
                        }}
                        className="px-4 py-2 rounded-lg border border-[var(--color-border-accent)] text-[var(--color-text-accent)] text-sm hover:bg-[var(--color-accent-primary)]/10 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Custom instruments as removable chips */}
                    {instruments.filter((i) => !INSTRUMENT_OPTIONS.includes(i)).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Your custom entries:</p>
                        <div className="flex flex-wrap gap-2">
                          {instruments
                            .filter((i) => !INSTRUMENT_OPTIONS.includes(i))
                            .map((instrument) => (
                              <span
                                key={instrument}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] text-sm"
                              >
                                {instrument}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInstruments((prev) => prev.filter((i) => i !== instrument));
                                  }}
                                  className="ml-1 hover:text-red-500 transition-colors"
                                  aria-label={`Remove ${instrument}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Genres */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                      Genres
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {GENRE_OPTIONS.map((genre) => (
                        <label
                          key={genre}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                            genres.includes(genre)
                              ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={genres.includes(genre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGenres((prev) => [...prev, genre]);
                              } else {
                                setGenres((prev) => prev.filter((g) => g !== genre));
                              }
                            }}
                            className="sr-only"
                          />
                          <span>{genre}</span>
                        </label>
                      ))}
                    </div>

                    {/* Custom genre input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customGenre}
                        onChange={(e) => setCustomGenre(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = customGenre.trim();
                            if (trimmed) {
                              const isDuplicate = genres.some(
                                (g) => g.toLowerCase() === trimmed.toLowerCase()
                              );
                              if (!isDuplicate) {
                                setGenres((prev) => [...prev, trimmed]);
                              }
                              setCustomGenre("");
                            }
                          }
                        }}
                        placeholder="Add your own..."
                        className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-input)] text-[var(--color-text-primary)] placeholder-[var(--color-placeholder)] text-sm focus:outline-none focus:border-[var(--color-border-accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = customGenre.trim();
                          if (trimmed) {
                            const isDuplicate = genres.some(
                              (g) => g.toLowerCase() === trimmed.toLowerCase()
                            );
                            if (!isDuplicate) {
                              setGenres((prev) => [...prev, trimmed]);
                            }
                            setCustomGenre("");
                          }
                        }}
                        className="px-4 py-2 rounded-lg border border-[var(--color-border-accent)] text-[var(--color-text-accent)] text-sm hover:bg-[var(--color-accent-primary)]/10 transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    {/* Custom genres as removable chips */}
                    {genres.filter((g) => !GENRE_OPTIONS.includes(g)).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Your custom entries:</p>
                        <div className="flex flex-wrap gap-2">
                          {genres
                            .filter((g) => !GENRE_OPTIONS.includes(g))
                            .map((genre) => (
                              <span
                                key={genre}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] text-sm"
                              >
                                {genre}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGenres((prev) => prev.filter((g2) => g2 !== genre));
                                  }}
                                  className="ml-1 hover:text-red-500 transition-colors"
                                  aria-label={`Remove ${genre}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Tell people about yourself - visible for all identities */}
            {isSectionVisible("about", relevantSections) && (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("about")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  Tell people about yourself
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("about") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("about") && (
                <div className="px-4 pb-4">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A few words about you, your music, your vibe..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-accent-primary)] focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>
            )}

            {/* Social links - visible for Songwriter, Host, Studio */}
            {isSectionVisible("social", relevantSections) && (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("social")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  Where can people find you?
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("social") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("social") && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-[var(--color-text-tertiary)] mb-2">
                    These help fans discover your music and venues book you for gigs.
                  </p>
                  {[
                    {
                      label: "Instagram",
                      value: instagramUrl,
                      onChange: setInstagramUrl,
                      placeholder: "https://instagram.com/you",
                    },
                    {
                      label: "Spotify",
                      value: spotifyUrl,
                      onChange: setSpotifyUrl,
                      placeholder: "https://open.spotify.com/artist/...",
                    },
                    {
                      label: "Bandcamp",
                      value: bandcampUrl,
                      onChange: setBandcampUrl,
                      placeholder: "https://yourname.bandcamp.com",
                    },
                    {
                      label: "YouTube",
                      value: youtubeUrl,
                      onChange: setYoutubeUrl,
                      placeholder: "https://youtube.com/@you",
                    },
                    {
                      label: "TikTok",
                      value: tiktokUrl,
                      onChange: setTiktokUrl,
                      placeholder: "https://tiktok.com/@you",
                    },
                    {
                      label: "Website",
                      value: websiteUrl,
                      onChange: setWebsiteUrl,
                      placeholder: "https://yoursite.com",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-sm text-[var(--color-text-tertiary)] mb-1">
                        {item.label}
                      </label>
                      <input
                        type="url"
                        value={item.value}
                        onChange={(e) => item.onChange(e.target.value)}
                        placeholder={item.placeholder}
                        className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-accent-primary)] focus:outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Tipping - visible for Songwriter only */}
            {isSectionVisible("tipping", relevantSections) && (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("tipping")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  Let people support you
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("tipping") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("tipping") && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-sm text-[var(--color-text-tertiary)] mb-2">
                    Got a tip jar? Fans love showing appreciation — make it easy for them.
                  </p>
                  {[
                    {
                      label: "Venmo",
                      value: venmoHandle,
                      onChange: setVenmoHandle,
                      placeholder: "@your-venmo",
                    },
                    {
                      label: "Cash App",
                      value: cashappHandle,
                      onChange: setCashappHandle,
                      placeholder: "$yourcashtag",
                    },
                    {
                      label: "PayPal",
                      value: paypalUrl,
                      onChange: setPaypalUrl,
                      placeholder: "https://paypal.me/you",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-sm text-[var(--color-text-tertiary)] mb-1">
                        {item.label}
                      </label>
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => item.onChange(e.target.value)}
                        placeholder={item.placeholder}
                        className="w-full px-3 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:border-[var(--color-accent-primary)] focus:outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* Collaboration - visible for Songwriter only */}
            {isSectionVisible("collab", relevantSections) && (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("collab")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  Collaboration preferences
                </span>
                <span className="text-[var(--color-text-tertiary)]">
                  {openSections.has("collab") ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </span>
              </button>
              {openSections.has("collab") && (
                <div className="px-4 pb-4 space-y-3">
                  {[
                    {
                      label: "Open to collaborations",
                      checked: openToCollabs,
                      onChange: setOpenToCollabs,
                    },
                    {
                      label: "Interested in co-writing",
                      checked: interestedInCowriting,
                      onChange: setInterestedInCowriting,
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => item.onChange(e.target.checked)}
                        className="w-5 h-5 rounded border-2 border-[var(--color-border-input)] bg-[var(--color-bg-input)] checked:bg-[var(--color-accent-primary)] checked:border-[var(--color-accent-primary)] transition-colors accent-[var(--color-accent-primary)]"
                      />
                      <span className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-6">
            You can update any of this anytime in your profile settings.
          </p>
        </div>
      </div>
    </div>
  );
}
