"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import { PageContainer, HeroSection } from "@/components/layout";
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS } from "@/lib/profile/options";
import { ProfileCompleteness } from "@/components/profile";
import { toast } from "sonner";
import Link from "next/link";

type FormData = {
  full_name: string;
  bio: string;
  avatar_url: string;
  // Identity flags
  is_songwriter: boolean;
  is_host: boolean;
  is_studio: boolean;
  is_fan: boolean;
  // Social links
  instagram_url: string;
  facebook_url: string;
  twitter_url: string;
  tiktok_url: string;
  youtube_url: string;
  spotify_url: string;
  website_url: string;
  venmo_handle: string;
  cashapp_handle: string;
  paypal_url: string;
  open_to_collabs: boolean;
  specialties: string[];
  favorite_open_mic: string;
  // New member directory fields
  available_for_hire: boolean;
  interested_in_cowriting: boolean;
  genres: string[];
  instruments: string[];
  song_links: string[];
  // Featured song for profile display
  featured_song_url: string;
};

const initialFormData: FormData = {
  full_name: "",
  bio: "",
  avatar_url: "",
  // Identity flags
  is_songwriter: false,
  is_host: false,
  is_studio: false,
  is_fan: false,
  // Social links
  instagram_url: "",
  facebook_url: "",
  twitter_url: "",
  tiktok_url: "",
  youtube_url: "",
  spotify_url: "",
  website_url: "",
  venmo_handle: "",
  cashapp_handle: "",
  paypal_url: "",
  open_to_collabs: false,
  specialties: [],
  favorite_open_mic: "",
  // New member directory fields
  available_for_hire: false,
  interested_in_cowriting: false,
  genres: [],
  instruments: [],
  song_links: [],
  featured_song_url: "",
};

const SPECIALTY_OPTIONS = [
  "Vocals",
  "Guitar",
  "Piano/Keys",
  "Bass",
  "Drums",
  "Songwriting",
  "Production",
  "Mixing/Mastering",
  "Session Work",
  "Live Performance",
  "Music Theory",
  "Arrangement",
];

// INSTRUMENT_OPTIONS and GENRE_OPTIONS are imported from @/lib/profile/options

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [userId, setUserId] = useState<string | null>(null);
  const [customInstrument, setCustomInstrument] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  // Note: userRole is kept for admin check only. UX is driven by identity flags (formData.is_songwriter, etc.)

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFormData({
          full_name: profile.full_name || "",
          bio: profile.bio || "",
          avatar_url: profile.avatar_url || "",
          // Identity flags
          is_songwriter: profile.is_songwriter || false,
          is_host: profile.is_host || false,
          is_studio: profile.is_studio || false,
          is_fan: profile.is_fan || false,
          // Social links
          instagram_url: (profile as any).instagram_url || "",
          facebook_url: (profile as any).facebook_url || "",
          twitter_url: (profile as any).twitter_url || "",
          tiktok_url: (profile as any).tiktok_url || "",
          youtube_url: (profile as any).youtube_url || "",
          spotify_url: (profile as any).spotify_url || "",
          website_url: (profile as any).website_url || "",
          venmo_handle: (profile as any).venmo_handle || "",
          cashapp_handle: (profile as any).cashapp_handle || "",
          paypal_url: (profile as any).paypal_url || "",
          open_to_collabs: (profile as any).open_to_collabs || false,
          specialties: (profile as any).specialties || [],
          favorite_open_mic: (profile as any).favorite_open_mic || "",
          // New member directory fields
          available_for_hire: (profile as any).available_for_hire || false,
          interested_in_cowriting: (profile as any).interested_in_cowriting || false,
          genres: (profile as any).genres || [],
          instruments: (profile as any).instruments || [],
          song_links: (profile as any).song_links || [],
          featured_song_url: (profile as any).featured_song_url || "",
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [supabase, router]);

  const handleAvatarUpload = useCallback(async (file: File): Promise<string | null> => {
    if (!userId) return null;

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Failed to upload image');
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlWithTimestamp })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      toast.error('Failed to update profile');
      return null;
    }

    setFormData(prev => ({ ...prev, avatar_url: urlWithTimestamp }));
    toast.success('Avatar updated!');
    return urlWithTimestamp;
  }, [supabase, userId]);

  const handleAvatarRemove = useCallback(async () => {
    if (!userId) return;

    await supabase.storage
      .from('avatars')
      .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`]);

    await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    setFormData(prev => ({ ...prev, avatar_url: '' }));
    toast.success('Avatar removed');
  }, [supabase, userId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in.");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name || null,
          bio: formData.bio || null,
          // Identity flags
          is_songwriter: formData.is_songwriter,
          is_host: formData.is_host,
          is_studio: formData.is_studio,
          is_fan: formData.is_fan,
          // Social links
          instagram_url: formData.instagram_url || null,
          facebook_url: formData.facebook_url || null,
          twitter_url: formData.twitter_url || null,
          tiktok_url: formData.tiktok_url || null,
          youtube_url: formData.youtube_url || null,
          spotify_url: formData.spotify_url || null,
          website_url: formData.website_url || null,
          venmo_handle: formData.venmo_handle || null,
          cashapp_handle: formData.cashapp_handle || null,
          paypal_url: formData.paypal_url || null,
          open_to_collabs: formData.open_to_collabs,
          specialties: formData.specialties.length > 0 ? formData.specialties : null,
          favorite_open_mic: formData.favorite_open_mic || null,
          // New member directory fields
          available_for_hire: formData.available_for_hire,
          interested_in_cowriting: formData.interested_in_cowriting,
          genres: formData.genres.length > 0 ? formData.genres : null,
          instruments: formData.instruments.length > 0 ? formData.instruments : null,
          song_links: formData.song_links.length > 0 ? formData.song_links : null,
          featured_song_url: formData.featured_song_url || null,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        toast.error("Failed to save your profile. Please try again.");
        setSaving(false);
        return;
      }

      toast.success("Profile updated successfully!");
      router.refresh();
    } catch (err) {
      console.error("Unexpected error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageContainer className="py-24 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-border-accent)] border-t-transparent rounded-full animate-spin" />
      </PageContainer>
    );
  }

  return (
    <>
      <HeroSection minHeight="sm">
        <PageContainer>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[var(--color-text-accent)] text-[length:var(--font-size-heading-xl)] font-[var(--font-family-serif)] italic mb-2">
                Edit Profile
              </h1>
              <p className="text-[var(--color-text-secondary)]">Update your public profile information</p>
            </div>
            <Link
              href="/dashboard"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </PageContainer>
      </HeroSection>

      <PageContainer>
        <div className="py-8 max-w-2xl">
          {/* Profile Completeness Indicator */}
          <ProfileCompleteness profile={formData} />

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Profile Picture */}
            <section id="avatar-section">
              <h2 className="text-xl text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                Profile Picture
              </h2>
              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                <ImageUpload
                  currentImageUrl={formData.avatar_url || null}
                  onUpload={handleAvatarUpload}
                  onRemove={handleAvatarRemove}
                  aspectRatio={1}
                  maxSizeMB={5}
                  shape="circle"
                  placeholderText="Add Photo"
                  className="w-32 h-32 sm:w-40 sm:h-40"
                />
                <div className="text-center sm:text-left">
                  <p className="text-[var(--color-text-secondary)] text-sm mb-2">
                    Recommended: A clear photo of your face
                  </p>
                  <ul className="text-xs text-[var(--color-text-secondary)] space-y-1">
                    <li>JPG, PNG, WebP, or GIF</li>
                    <li>Max 5MB file size</li>
                    <li>Will be cropped to a square</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Basic Info */}
            <section id="basic-info-section">
              <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                Basic Info
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="How you want to be known"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Tell us about yourself (instruments, genres, experience...)"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-primary)]/40 focus:outline-none focus:border-[var(--color-border-accent)]/50 resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Identity */}
            <section id="identity-section">
              <h2 className="text-xl text-[var(--color-text-primary)] mb-2">
                How you identify
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                These choices help personalize your experience and how you appear to others.
                They don&apos;t grant permissions.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_songwriter}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_songwriter: e.target.checked }))}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                  />
                  <div>
                    <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">I&apos;m a songwriter, musician, or singer</span>
                    <p className="text-xs text-[var(--color-text-secondary)]">I write, perform, or record music</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_host}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_host: e.target.checked }))}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                  />
                  <div>
                    <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">I host open mics</span>
                    <p className="text-xs text-[var(--color-text-secondary)]">I host or co-host open mic nights</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_studio}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_studio: e.target.checked }))}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                  />
                  <div>
                    <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">I run a recording studio</span>
                    <p className="text-xs text-[var(--color-text-secondary)]">I offer recording, mixing, or production services</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.is_fan}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_fan: e.target.checked }))}
                    className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                  />
                  <div>
                    <span className="text-[var(--color-text-primary)] group-hover:text-[var(--color-text-accent)] transition-colors">I&apos;m a music fan and supporter</span>
                    <p className="text-xs text-[var(--color-text-secondary)]">I love live music and supporting local artists</p>
                  </div>
                </label>
              </div>
            </section>

            {/* Music & Skills (Performers only) */}
            {formData.is_songwriter && (
              <section id="music-skills-section">
                <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                  Music & Skills
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Help others find you based on your musical style and abilities.
                </p>
                <div className="space-y-6">
                  {/* Genres */}
                  <div>
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                      Genres (you can add your own)
                    </label>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                      Select genres that fit your music. Add custom entries anytime.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {GENRE_OPTIONS.map((genre) => (
                        <label
                          key={genre}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            formData.genres.includes(genre)
                              ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.genres.includes(genre)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, genres: [...prev.genres, genre] }));
                              } else {
                                setFormData(prev => ({ ...prev, genres: prev.genres.filter(g => g !== genre) }));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm">{genre}</span>
                        </label>
                      ))}
                    </div>

                    {/* Custom genre input */}
                    <div className="mt-4">
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
                                // Case-insensitive duplicate check against both curated and custom
                                const isDuplicate = formData.genres.some(
                                  (g) => g.toLowerCase() === trimmed.toLowerCase()
                                ) || GENRE_OPTIONS.some(
                                  (g) => g.toLowerCase() === trimmed.toLowerCase()
                                );
                                if (!isDuplicate) {
                                  setFormData(prev => ({
                                    ...prev,
                                    genres: [...prev.genres, trimmed]
                                  }));
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
                              // Case-insensitive duplicate check against both curated and custom
                              const isDuplicate = formData.genres.some(
                                (g) => g.toLowerCase() === trimmed.toLowerCase()
                              ) || GENRE_OPTIONS.some(
                                (g) => g.toLowerCase() === trimmed.toLowerCase()
                              );
                              if (!isDuplicate) {
                                setFormData(prev => ({
                                  ...prev,
                                  genres: [...prev.genres, trimmed]
                                }));
                              }
                              setCustomGenre("");
                            }
                          }}
                          className="px-4 py-2 rounded-lg border border-[var(--color-border-accent)] text-[var(--color-text-accent)] text-sm hover:bg-[var(--color-accent-primary)]/10 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Custom genres (not in curated list) as removable chips */}
                    {formData.genres.filter(g => !GENRE_OPTIONS.includes(g)).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-[var(--color-text-secondary)] mb-2">Your custom entries:</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.genres
                            .filter(g => !GENRE_OPTIONS.includes(g))
                            .map((genre) => (
                              <span
                                key={genre}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] text-sm"
                              >
                                {genre}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      genres: prev.genres.filter(g => g !== genre)
                                    }));
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

                  {/* Instruments & Skills */}
                  <div>
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                      Instruments & Skills (you can add your own)
                    </label>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                      Select what you play or do. You can add custom entries if yours isn&apos;t listed.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {INSTRUMENT_OPTIONS.map((instrument) => (
                        <label
                          key={instrument}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            formData.instruments.includes(instrument)
                              ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.instruments.includes(instrument)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({ ...prev, instruments: [...prev.instruments, instrument] }));
                              } else {
                                setFormData(prev => ({ ...prev, instruments: prev.instruments.filter(i => i !== instrument) }));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm">{instrument}</span>
                        </label>
                      ))}
                    </div>

                    {/* Custom instrument input */}
                    <div className="mt-4">
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
                                // Case-insensitive duplicate check
                                const isDuplicate = formData.instruments.some(
                                  (i) => i.toLowerCase() === trimmed.toLowerCase()
                                );
                                if (!isDuplicate) {
                                  setFormData(prev => ({
                                    ...prev,
                                    instruments: [...prev.instruments, trimmed]
                                  }));
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
                              // Case-insensitive duplicate check
                              const isDuplicate = formData.instruments.some(
                                (i) => i.toLowerCase() === trimmed.toLowerCase()
                              );
                              if (!isDuplicate) {
                                setFormData(prev => ({
                                  ...prev,
                                  instruments: [...prev.instruments, trimmed]
                                }));
                              }
                              setCustomInstrument("");
                            }
                          }}
                          className="px-4 py-2 rounded-lg border border-[var(--color-border-accent)] text-[var(--color-text-accent)] text-sm hover:bg-[var(--color-accent-primary)]/10 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Custom instruments (not in curated list) as removable chips */}
                    {formData.instruments.filter(i => !INSTRUMENT_OPTIONS.includes(i)).length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-[var(--color-text-secondary)] mb-2">Your custom entries:</p>
                        <div className="flex flex-wrap gap-2">
                          {formData.instruments
                            .filter(i => !INSTRUMENT_OPTIONS.includes(i))
                            .map((instrument) => (
                              <span
                                key={instrument}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)] text-sm"
                              >
                                {instrument}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      instruments: prev.instruments.filter(i => i !== instrument)
                                    }));
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

                  {/* Specialties */}
                  <div>
                    <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
                      Specialties / Services
                    </label>
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                      Select skills you can offer for collaborations
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {SPECIALTY_OPTIONS.map((specialty) => (
                        <label
                          key={specialty}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            formData.specialties.includes(specialty)
                              ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-accent)]"
                              : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/30 text-[var(--color-text-secondary)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.specialties.includes(specialty)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  specialties: [...prev.specialties, specialty]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  specialties: prev.specialties.filter(s => s !== specialty)
                                }));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm">{specialty}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Collaboration & Availability (Performers only) */}
            {formData.is_songwriter && (
              <section>
                <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                  Collaboration & Availability
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Let other musicians know how you&apos;d like to connect.
                </p>
                <div className="space-y-4">
                  {/* Availability Toggles */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.open_to_collabs}
                        onChange={(e) => setFormData(prev => ({ ...prev, open_to_collabs: e.target.checked }))}
                        className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                      />
                      <span className="text-[var(--color-text-primary)]">
                        I&apos;m open to collaborations
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.interested_in_cowriting}
                        onChange={(e) => setFormData(prev => ({ ...prev, interested_in_cowriting: e.target.checked }))}
                        className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                      />
                      <span className="text-[var(--color-text-primary)]">
                        I&apos;m interested in co-writing
                      </span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.available_for_hire}
                        onChange={(e) => setFormData(prev => ({ ...prev, available_for_hire: e.target.checked }))}
                        className="w-5 h-5 rounded border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-accent)] focus:ring-[var(--color-border-accent)]/50"
                      />
                      <span className="text-[var(--color-text-primary)]">
                        I&apos;m available for hire (paid gigs, session work, etc.)
                      </span>
                    </label>
                  </div>

                  {/* Favorite Open Mic */}
                  <div>
                    <label htmlFor="favorite_open_mic" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                      Favorite Denver Open Mic
                    </label>
                    <input
                      type="text"
                      id="favorite_open_mic"
                      name="favorite_open_mic"
                      value={formData.favorite_open_mic}
                      onChange={handleChange}
                      placeholder="e.g., Lion's Lair, Goosetown Tavern..."
                      className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Featured Song (Performers only) */}
            {formData.is_songwriter && (
              <section>
                <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                  Featured Song
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Highlight one song that represents you best. This will be displayed prominently on your profile.
                </p>
                <input
                  type="url"
                  name="featured_song_url"
                  value={formData.featured_song_url}
                  onChange={handleChange}
                  placeholder="https://youtube.com/watch?v=... or https://open.spotify.com/track/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-primary)]/40 focus:outline-none focus:border-[var(--color-border-accent)]/50"
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  Supports YouTube, Spotify, SoundCloud, Bandcamp, and other music platforms
                </p>
              </section>
            )}

            {/* Song Links (Performers only) */}
            {formData.is_songwriter && (
              <section>
                <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                  Additional Songs
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Share more links to your songs on SoundCloud, Bandcamp, YouTube, etc.
                </p>
                <div className="space-y-3">
                  {formData.song_links.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...formData.song_links];
                          newLinks[index] = e.target.value;
                          setFormData(prev => ({ ...prev, song_links: newLinks }));
                        }}
                        placeholder="https://soundcloud.com/... or https://youtu.be/..."
                        className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            song_links: prev.song_links.filter((_, i) => i !== index)
                          }));
                        }}
                        className="px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        song_links: [...prev.song_links, ""]
                      }));
                    }}
                    className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    + Add Song Link
                  </button>
                </div>
              </section>
            )}

            {/* Social Links */}
            <section id="social-links-section">
              <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                Social Links
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Share your social profiles so fans can follow you.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="instagram_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Instagram
                  </label>
                  <input
                    type="url"
                    id="instagram_url"
                    name="instagram_url"
                    value={formData.instagram_url}
                    onChange={handleChange}
                    placeholder="https://instagram.com/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="facebook_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Facebook
                  </label>
                  <input
                    type="url"
                    id="facebook_url"
                    name="facebook_url"
                    value={formData.facebook_url}
                    onChange={handleChange}
                    placeholder="https://facebook.com/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="tiktok_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    TikTok
                  </label>
                  <input
                    type="url"
                    id="tiktok_url"
                    name="tiktok_url"
                    value={formData.tiktok_url}
                    onChange={handleChange}
                    placeholder="https://tiktok.com/@..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="youtube_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    YouTube
                  </label>
                  <input
                    type="url"
                    id="youtube_url"
                    name="youtube_url"
                    value={formData.youtube_url}
                    onChange={handleChange}
                    placeholder="https://youtube.com/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="spotify_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Spotify
                  </label>
                  <input
                    type="url"
                    id="spotify_url"
                    name="spotify_url"
                    value={formData.spotify_url}
                    onChange={handleChange}
                    placeholder="https://open.spotify.com/artist/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="website_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    id="website_url"
                    name="website_url"
                    value={formData.website_url}
                    onChange={handleChange}
                    placeholder="https://yoursite.com"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
              </div>
            </section>

            {/* Tip Links */}
            <section id="tip-links-section">
              <h2 className="text-xl text-[var(--color-text-primary)] mb-4">
                Accept Tips
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Let fans support you directly. These will appear on your profile and when you perform.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="venmo_handle" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Venmo Handle
                  </label>
                  <input
                    type="text"
                    id="venmo_handle"
                    name="venmo_handle"
                    value={formData.venmo_handle}
                    onChange={handleChange}
                    placeholder="@username"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="cashapp_handle" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    Cash App
                  </label>
                  <input
                    type="text"
                    id="cashapp_handle"
                    name="cashapp_handle"
                    value={formData.cashapp_handle}
                    onChange={handleChange}
                    placeholder="$cashtag"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
                <div>
                  <label htmlFor="paypal_url" className="block text-sm text-[var(--color-text-secondary)] mb-1">
                    PayPal.me
                  </label>
                  <input
                    type="url"
                    id="paypal_url"
                    name="paypal_url"
                    value={formData.paypal_url}
                    onChange={handleChange}
                    placeholder="https://paypal.me/..."
                    className="w-full px-4 py-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
                  />
                </div>
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[var(--color-border-default)]">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href="/dashboard"
                className="px-6 py-3 rounded-lg border border-[var(--color-border-default)] hover:border-[var(--color-border-accent)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-center"
              >
                Cancel
              </Link>
              {formData.is_songwriter && userId && (
                <Link
                  href={`/performers/${userId}`}
                  className="px-6 py-3 rounded-lg border border-[var(--color-border-accent)]/30 hover:border-[var(--color-border-accent)]/60 text-[var(--color-text-accent)] hover:text-[var(--color-accent-hover)] transition-colors text-center"
                >
                  View Public Profile
                </Link>
              )}
            </div>
          </form>
        </div>
      </PageContainer>
    </>
  );
}
