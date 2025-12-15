"use client";

import * as React from "react";

const FONTS = [
  { id: "", label: "Default (Playfair + Geist)" },
  { id: "system", label: "System" },
  { id: "playfair-inter", label: "Playfair + Inter" },
  { id: "fraunces-inter", label: "Fraunces + Inter" },
  { id: "dmserif-inter", label: "DM Serif + Inter" },
  { id: "oswald-inter", label: "Oswald + Inter" },
  { id: "montserrat", label: "Montserrat" },
];

const STORAGE_KEY = "dsc-font";

export function FontSwitcher() {
  const [font, setFont] = React.useState<string>("");

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const next = saved ?? "";
    setFont(next);
    if (next) document.documentElement.dataset.font = next;
    else delete document.documentElement.dataset.font;
  }, []);

  function apply(next: string) {
    setFont(next);
    if (next) {
      document.documentElement.dataset.font = next;
      window.localStorage.setItem(STORAGE_KEY, next);
    } else {
      delete document.documentElement.dataset.font;
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      <span className="hidden sm:inline">Font</span>
      <select
        className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[var(--color-text-primary)]"
        value={font}
        onChange={(e) => apply(e.target.value)}
      >
        {FONTS.map((f) => (
          <option key={f.id || "default"} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}
