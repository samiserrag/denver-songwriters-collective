"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui";
import Link from "next/link";

type FormData = {
  full_name: string;
  bio: string;
  avatar_url: string;
  instagram_url: string;
  facebook_url: string;
  twitter_url: string;
  youtube_url: string;
  spotify_url: string;
  website_url: string;
  venmo_handle: string;
  cashapp_handle: string;
  paypal_url: string;
  open_to_collabs: boolean;
  specialties: string[];
  favorite_open_mic: string;
};

const initialFormData: FormData = {
  full_name: "",
  bio: "",
  avatar_url: "",
  instagram_url: "",
  facebook_url: "",
  twitter_url: "",
  youtube_url: "",
  spotify_url: "",
  website_url: "",
  venmo_handle: "",
  cashapp_handle: "",
  paypal_url: "",
  open_to_collabs: false,
  specialties: [],
  favorite_open_mic: "",
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

export default function ProfileOnboarding() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

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
        setUserRole(profile.role);
        setFormData({
          full_name: profile.full_name || "",
          bio: profile.bio || "",
          avatar_url: profile.avatar_url || "",
          instagram_url: (profile as any).instagram_url || "",
          facebook_url: (profile as any).facebook_url || "",
          twitter_url: (profile as any).twitter_url || "",
          youtube_url: (profile as any).youtube_url || "",
          spotify_url: (profile as any).spotify_url || "",
          website_url: (profile as any).website_url || "",
          venmo_handle: (profile as any).venmo_handle || "",
          cashapp_handle: (profile as any).cashapp_handle || "",
          paypal_url: (profile as any).paypal_url || "",
          open_to_collabs: (profile as any).open_to_collabs || false,
          specialties: (profile as any).specialties || [],
          favorite_open_mic: (profile as any).favorite_open_mic || "",
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

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Add cache-busting timestamp
    const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlWithTimestamp })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return null;
    }

    setFormData(prev => ({ ...prev, avatar_url: urlWithTimestamp }));
    return urlWithTimestamp;
  }, [supabase, userId]);

  const handleAvatarRemove = useCallback(async () => {
    if (!userId) return;

    // Remove from storage
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([`${userId}/avatar.jpg`, `${userId}/avatar.png`, `${userId}/avatar.webp`]);

    if (deleteError) {
      console.error('Delete error:', deleteError);
    }

    // Update profile
    await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', userId);

    setFormData(prev => ({ ...prev, avatar_url: '' }));
  }, [supabase, userId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in.");
        setSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name || null,
          bio: formData.bio || null,
          instagram_url: formData.instagram_url || null,
          facebook_url: formData.facebook_url || null,
          twitter_url: formData.twitter_url || null,
          youtube_url: formData.youtube_url || null,
          spotify_url: formData.spotify_url || null,
          website_url: formData.website_url || null,
          venmo_handle: formData.venmo_handle || null,
          cashapp_handle: formData.cashapp_handle || null,
          paypal_url: formData.paypal_url || null,
          open_to_collabs: formData.open_to_collabs,
          specialties: formData.specialties.length > 0 ? formData.specialties : null,
          favorite_open_mic: formData.favorite_open_mic || null,
          onboarding_complete: true,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        setError("Failed to save your profile. Please try again.");
        setSaving(false);
        return;
      }

      // Refresh to clear cache, then redirect to complete page
      router.refresh();
      router.push("/onboarding/complete");
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_complete: true })
          .eq("id", user.id);
      }
      router.push("/onboarding/complete");
    } catch {
      router.push("/onboarding/complete");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-3 h-3 rounded-full bg-[var(--color-gold)]" />
          <div className="w-12 h-0.5 bg-[var(--color-gold)]" />
          <div className="w-3 h-3 rounded-full bg-[var(--color-gold)]" />
          <div className="w-12 h-0.5 bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-[var(--font-family-serif)] text-[var(--color-warm-white)] mb-4">
            Complete Your Profile
          </h1>
          <p className="text-[var(--color-warm-gray-light)]">
            Help others discover you! All fields below are <span className="text-teal-400">optional</span>.
          </p>
        </div>

        {/* Privacy notice */}
        <div className="mb-8 p-4 rounded-xl bg-teal-900/20 border border-teal-500/30">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div>
              <h3 className="font-semibold text-teal-400 mb-1">Your Privacy Matters</h3>
              <p className="text-sm text-[var(--color-warm-gray-light)]">
                Your email is never shown publicly. We only collect what you choose to share.
                Read our full{" "}
                <Link href="/privacy" className="text-teal-400 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture */}
          <section>
            <h2 className="text-xl text-[var(--color-warm-white)] mb-4 flex items-center gap-2">
              <span>📸</span> Profile Picture <span className="text-sm font-normal text-teal-400">(optional)</span>
            </h2>
            <p className="text-sm text-[var(--color-warm-gray)] mb-4">
              Add a profile picture to help others recognize you. Your photo will be displayed as a circle.
            </p>
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
                <p className="text-[var(--color-warm-gray-light)] text-sm mb-2">
                  Recommended: A clear photo of your face
                </p>
                <ul className="text-xs text-[var(--color-warm-gray)] space-y-1">
                  <li>• JPG, PNG, WebP, or GIF</li>
                  <li>• Max 5MB file size</li>
                  <li>• Will be cropped to a square</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Basic Info */}
          <section>
            <h2 className="text-xl text-[var(--color-warm-white)] mb-4 flex items-center gap-2">
              <span>👤</span> Basic Info <span className="text-sm font-normal text-teal-400">(all optional)</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Display Name <span className="text-teal-400/70">(optional)</span>
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="How you want to be known"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="bio" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Bio <span className="text-teal-400/70">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Tell us about yourself (instruments, genres, experience...)"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Social Links */}
          <section>
            <h2 className="text-xl text-[var(--color-warm-white)] mb-4 flex items-center gap-2">
              <span>🔗</span> Social Links <span className="text-sm font-normal text-teal-400">(all optional)</span>
            </h2>
            <p className="text-sm text-[var(--color-warm-gray)] mb-4">
              Share your social profiles so fans can follow you.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="instagram_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Instagram
                </label>
                <input
                  type="url"
                  id="instagram_url"
                  name="instagram_url"
                  value={formData.instagram_url}
                  onChange={handleChange}
                  placeholder="https://instagram.com/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="facebook_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Facebook
                </label>
                <input
                  type="url"
                  id="facebook_url"
                  name="facebook_url"
                  value={formData.facebook_url}
                  onChange={handleChange}
                  placeholder="https://facebook.com/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="youtube_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  YouTube
                </label>
                <input
                  type="url"
                  id="youtube_url"
                  name="youtube_url"
                  value={formData.youtube_url}
                  onChange={handleChange}
                  placeholder="https://youtube.com/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="spotify_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Spotify
                </label>
                <input
                  type="url"
                  id="spotify_url"
                  name="spotify_url"
                  value={formData.spotify_url}
                  onChange={handleChange}
                  placeholder="https://open.spotify.com/artist/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="website_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Website
                </label>
                <input
                  type="url"
                  id="website_url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  placeholder="https://yoursite.com"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
            </div>
          </section>

          {/* Tip Links */}
          <section>
            <h2 className="text-xl text-[var(--color-warm-white)] mb-4 flex items-center gap-2">
              <span>💸</span> Accept Tips <span className="text-sm font-normal text-teal-400">(all optional)</span>
            </h2>
            <p className="text-sm text-[var(--color-warm-gray)] mb-4">
              Let fans support you directly. These will appear on your profile and when you perform.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="venmo_handle" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Venmo Handle
                </label>
                <input
                  type="text"
                  id="venmo_handle"
                  name="venmo_handle"
                  value={formData.venmo_handle}
                  onChange={handleChange}
                  placeholder="@username"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="cashapp_handle" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  Cash App
                </label>
                <input
                  type="text"
                  id="cashapp_handle"
                  name="cashapp_handle"
                  value={formData.cashapp_handle}
                  onChange={handleChange}
                  placeholder="$cashtag"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
              <div>
                <label htmlFor="paypal_url" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                  PayPal.me
                </label>
                <input
                  type="url"
                  id="paypal_url"
                  name="paypal_url"
                  value={formData.paypal_url}
                  onChange={handleChange}
                  placeholder="https://paypal.me/..."
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
            </div>
          </section>

          {/* Collaboration (Performers only) */}
          {userRole === "performer" && (
            <section>
              <h2 className="text-xl text-[var(--color-warm-white)] mb-4 flex items-center gap-2">
                <span>🤝</span> Collaboration <span className="text-sm font-normal text-teal-400">(all optional)</span>
              </h2>
              <p className="text-sm text-[var(--color-warm-gray)] mb-4">
                Let other musicians know if you&apos;re open to collaborations and what you can offer.
              </p>
              <div className="space-y-6">
                {/* Open to Collabs Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.open_to_collabs}
                      onChange={(e) => setFormData(prev => ({ ...prev, open_to_collabs: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-6 h-6 rounded-md border-2 border-white/30 bg-white/5 peer-checked:bg-teal-500 peer-checked:border-teal-500 transition-colors flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[var(--color-warm-white)] group-hover:text-white transition-colors">
                    I&apos;m open to collaborations
                  </span>
                </label>

                {/* Specialties Multi-select */}
                <div>
                  <label className="block text-sm text-[var(--color-warm-gray-light)] mb-2">
                    Specialties / Services
                  </label>
                  <p className="text-xs text-[var(--color-warm-gray)] mb-3">
                    Select what you can offer in collaborations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTY_OPTIONS.map((specialty) => {
                      const isSelected = formData.specialties.includes(specialty);
                      return (
                        <button
                          key={specialty}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              specialties: isSelected
                                ? prev.specialties.filter(s => s !== specialty)
                                : [...prev.specialties, specialty]
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                            isSelected
                              ? "bg-teal-500 text-white"
                              : "bg-white/5 text-[var(--color-warm-gray-light)] hover:bg-white/10 border border-white/10"
                          }`}
                        >
                          {specialty}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Favorite Open Mic */}
                <div>
                  <label htmlFor="favorite_open_mic" className="block text-sm text-[var(--color-warm-gray-light)] mb-1">
                    Favorite Denver Open Mic
                  </label>
                  <input
                    type="text"
                    id="favorite_open_mic"
                    name="favorite_open_mic"
                    value={formData.favorite_open_mic}
                    onChange={handleChange}
                    placeholder="e.g., Walnut Room Monday Night Open Mic"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--color-gold)]/50"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-6 py-3 rounded-lg bg-[var(--color-gold)] hover:bg-[var(--color-gold-400)] text-[var(--color-background)] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="px-6 py-3 rounded-lg border border-white/20 hover:border-white/40 text-[var(--color-warm-gray-light)] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
