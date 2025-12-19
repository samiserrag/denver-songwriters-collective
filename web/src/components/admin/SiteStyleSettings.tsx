"use client";

import * as React from "react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { FontSwitcher } from "@/components/ui/FontSwitcher";

interface SiteStyleSettingsProps {
  initialTheme: string;
  initialFont: string;
}

/**
 * Admin-only component that wraps ThemeSwitcher and FontSwitcher
 * with a "Save as Site Default" button to persist settings to the database.
 */
export function SiteStyleSettings({ initialTheme, initialFont }: SiteStyleSettingsProps) {
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    // Read current values from document dataset (set by ThemeSwitcher/FontSwitcher)
    const currentTheme = document.documentElement.dataset.theme || "";
    const currentFont = document.documentElement.dataset.font || "";

    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themePreset: currentTheme,
          fontPreset: currentFont,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      // Clear the saved indicator after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ThemeSwitcher />
      <FontSwitcher />
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-1.5 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save as Site Default"}
      </button>
      {saved && (
        <span className="text-green-400 text-sm">Saved!</span>
      )}
      {error && (
        <span className="text-red-400 text-sm">{error}</span>
      )}
    </div>
  );
}
