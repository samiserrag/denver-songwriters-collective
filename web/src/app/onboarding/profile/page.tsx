"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronRight } from "lucide-react";

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

  // Tipping
  const [venmoHandle, setVenmoHandle] = useState("");
  const [cashappHandle, setCashappHandle] = useState("");
  const [paypalUrl, setPaypalUrl] = useState("");

  // Collaboration
  const [openToCollabs, setOpenToCollabs] = useState(false);
  const [interestedInCowriting, setInterestedInCowriting] = useState(false);

  // Accordion state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

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
          setVenmoHandle(profile.venmo_handle || "");
          setCashappHandle(profile.cashapp_handle || "");
          setPaypalUrl(profile.paypal_url || "");
          setOpenToCollabs(profile.open_to_collabs || false);
          setInterestedInCowriting(profile.interested_in_cowriting || false);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in.");
        setSaving(false);
        return;
      }

      const updates = {
        full_name: name || null,
        is_songwriter: isSongwriter,
        is_studio: isStudio,
        is_host: isHost,
        is_fan: isFan,
        bio: bio || null,
        instagram_url: instagramUrl || null,
        spotify_url: spotifyUrl || null,
        youtube_url: youtubeUrl || null,
        website_url: websiteUrl || null,
        tiktok_url: tiktokUrl || null,
        venmo_handle: venmoHandle || null,
        cashapp_handle: cashappHandle || null,
        paypal_url: paypalUrl || null,
        open_to_collabs: openToCollabs,
        interested_in_cowriting: interestedInCowriting,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        setError("Something went wrong. Please try again.");
        setSaving(false);
        return;
      }

      router.refresh();
      router.push("/dashboard?welcome=1");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
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
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
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
            {/* What brings you here */}
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection("identity")}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="font-medium text-[var(--color-text-primary)]">
                  What brings you here?
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
                    Check all that apply — or none, we don&apos;t judge
                  </p>
                  {[
                    {
                      label: "I write/perform music",
                      checked: isSongwriter,
                      onChange: setIsSongwriter,
                    },
                    {
                      label: "I run a recording studio",
                      checked: isStudio,
                      onChange: setIsStudio,
                    },
                    { label: "I host open mics", checked: isHost, onChange: setIsHost },
                    {
                      label: "I'm here to support local music",
                      checked: isFan,
                      onChange: setIsFan,
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

            {/* Tell people about yourself */}
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

            {/* Social links */}
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

            {/* Tipping */}
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

            {/* Collaboration */}
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
