"use client";

import * as React from "react";
import type { SiteSocialLink } from "@/lib/site-social-links";

interface SiteSocialLinksSettingsProps {
  initialLinks: SiteSocialLink[];
  initialHeroImageUrl?: string;
  initialEmailHeaderImageUrl?: string;
  initialYoutubePlaylistUrl?: string;
  initialSpotifyPlaylistUrl?: string;
}

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X / Twitter" },
  { value: "spotify", label: "Spotify" },
  { value: "bandcamp", label: "Bandcamp" },
  { value: "website", label: "Website" },
];

function newLink(): SiteSocialLink {
  return {
    label: "",
    url: "",
    platform: "website",
  };
}

export function SiteSocialLinksSettings({
  initialLinks,
  initialHeroImageUrl = "",
  initialEmailHeaderImageUrl = "",
  initialYoutubePlaylistUrl = "",
  initialSpotifyPlaylistUrl = "",
}: SiteSocialLinksSettingsProps) {
  const [links, setLinks] = React.useState<SiteSocialLink[]>(
    initialLinks.length > 0 ? initialLinks : [newLink()]
  );
  const [heroImageUrl, setHeroImageUrl] = React.useState(initialHeroImageUrl);
  const [emailHeaderImageUrl, setEmailHeaderImageUrl] = React.useState(initialEmailHeaderImageUrl);
  const [youtubePlaylistUrl, setYoutubePlaylistUrl] = React.useState(initialYoutubePlaylistUrl);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = React.useState(initialSpotifyPlaylistUrl);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updateLink(index: number, patch: Partial<SiteSocialLink>) {
    setLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, ...patch } : link))
    );
  }

  function addLink() {
    setLinks((prev) => [...prev, newLink()]);
  }

  function removeLink(index: number) {
    setLinks((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [newLink()];
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/admin/site-social-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          socialLinks: links,
          heroImageUrl,
          emailHeaderImageUrl,
          youtubePlaylistUrl,
          spotifyPlaylistUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save social links");
      }

      const data = await res.json();
      setLinks(Array.isArray(data.socialLinks) && data.socialLinks.length > 0 ? data.socialLinks : [newLink()]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save social links");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Site Asset URLs */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Site Assets
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Homepage Hero Image URL
            </label>
            <input
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              placeholder="/images/hero-bg.jpg or https://..."
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Path like /images/hero-bg.jpg or a full URL. This powers both the homepage hero background and social share preview image.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Email Header Image URL
            </label>
            <input
              value={emailHeaderImageUrl}
              onChange={(e) => setEmailHeaderImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Full URL to the header image shown at the top of all emails.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              YouTube Playlist URL
            </label>
            <input
              value={youtubePlaylistUrl}
              onChange={(e) => setYoutubePlaylistUrl(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=..."
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Spotify Playlist URL
            </label>
            <input
              value={spotifyPlaylistUrl}
              onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-[var(--color-border-default)]" />

      {/* Social Links */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">
          Social Links
        </h3>

      {links.map((link, index) => (
        <div
          key={`${index}-${link.url}-${link.label}`}
          className="grid grid-cols-1 md:grid-cols-[160px_180px_1fr_auto] gap-2 items-start"
        >
          <input
            value={link.label}
            onChange={(e) => updateLink(index, { label: e.target.value })}
            placeholder="Label"
            className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
          />
          <select
            value={link.platform}
            onChange={(e) => updateLink(index, { platform: e.target.value })}
            className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={link.url}
            onChange={(e) => updateLink(index, { url: e.target.value })}
            placeholder="https://..."
            className="px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-border-default)] rounded-md text-sm"
          />
          <button
            type="button"
            onClick={() => removeLink(index)}
            className="px-3 py-2 text-sm rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addLink}
          className="px-4 py-2 text-sm rounded-md border border-[var(--color-border-default)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          Add Link
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save All Settings"}
        </button>
        {saved && <span className="text-green-400 text-sm">Saved!</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Social links are global and show in the site header and footer.
      </p>
      </div>
    </div>
  );
}
