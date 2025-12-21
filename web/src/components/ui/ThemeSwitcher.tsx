"use client";

import * as React from "react";

const THEMES = [
  { id: "", label: "Default (Gold Night)" },
  // Light themes
  { id: "sunrise", label: "Sunrise" },
  { id: "sunset", label: "Sunset" },
  { id: "colorado-sky", label: "Colorado Sky" },
  { id: "aspen-pop", label: "Aspen Pop" },
  { id: "red-rocks", label: "Red Rocks" },
  // Dark themes
  { id: "night", label: "Night" },
  { id: "night-neon", label: "Night Neon" },
  { id: "teal-night", label: "Teal Night" },
];

const STORAGE_KEY = "dsc-theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = React.useState<string>("");

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const next = saved ?? "";
    setTheme(next);
    if (next) document.documentElement.setAttribute("data-theme", next);
    else document.documentElement.removeAttribute("data-theme");
  }, []);

  function apply(next: string) {
    setTheme(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem(STORAGE_KEY, next);
    } else {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      <span className="hidden sm:inline">Theme</span>
      <select
        className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[var(--color-text-primary)]"
        value={theme}
        onChange={(e) => apply(e.target.value)}
      >
        {THEMES.map((t) => (
          <option key={t.id || "default"} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
