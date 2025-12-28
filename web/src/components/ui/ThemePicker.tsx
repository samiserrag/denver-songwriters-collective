"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const THEMES = [
  // Auto - follows system preference
  { id: "auto", label: "Auto", description: "Follows your device settings", category: "auto" },
  // Dark theme
  { id: "night", label: "Night", description: "Dark with warm gold accents", category: "dark" },
  // Light theme
  { id: "sunrise", label: "Sunrise", description: "Warm and bright", category: "light" },
];

const STORAGE_KEY = "dsc-theme";

interface ThemePickerProps {
  compact?: boolean;
  /** Called after a theme is selected and applied (for closing parent menus, etc.) */
  onSelect?: () => void;
}

export function ThemePicker({ compact = false, onSelect }: ThemePickerProps) {
  const [theme, setTheme] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    // Initialize from localStorage on mount - this is intentional client-side state sync
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(saved ?? "");
  }, []);

  // Handle keyboard navigation for compact dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  function apply(next: string) {
    setTheme(next);
    if (next && next !== "auto") {
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem(STORAGE_KEY, next);
    } else {
      // Auto mode - remove explicit theme, let CSS media query handle it
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.setItem(STORAGE_KEY, "auto");
    }
    setIsOpen(false);
    onSelect?.();
  }

  const currentTheme = THEMES.find((t) => t.id === theme) || THEMES[0];

  if (compact) {
    return (
      <div className="relative" onKeyDown={handleKeyDown}>
        <button
          ref={triggerRef}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] transition-colors text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]"
          aria-label="Choose theme"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          {/* Theme swatch - uses current theme's accent color */}
          <span
            className="w-4 h-4 rounded-full border border-[var(--color-border-default)] bg-[var(--color-accent-primary)]"
            aria-hidden="true"
          />
          <span className="text-[var(--color-text-primary)]">{currentTheme.label}</span>
          <svg className={`w-3 h-3 text-[var(--color-text-tertiary)] transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
            <div
              ref={dropdownRef}
              role="listbox"
              aria-label="Theme options"
              className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] shadow-lg z-50 overflow-hidden"
            >
              <div className="p-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    role="option"
                    aria-selected={theme === t.id}
                    onClick={() => apply(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent-primary)]/50 ${
                      theme === t.id
                        ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)]"
                        : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="block text-xs text-[var(--color-text-tertiary)]">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Full-size picker for homepage section
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <svg className="w-5 h-5 text-[var(--color-text-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <div>
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Choose Your Theme</h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">Pick a color scheme that suits you. Your choice is saved locally.</p>
        </div>
      </div>

      <div className="flex gap-3" role="listbox" aria-label="Theme options">
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="option"
            aria-selected={theme === t.id}
            onClick={() => apply(t.id)}
            className={`flex-1 text-center px-4 py-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] ${
              theme === t.id
                ? "border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10"
                : "border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]/50 bg-[var(--color-bg-secondary)]"
            }`}
          >
            <span className={`block text-sm font-medium ${theme === t.id ? "text-[var(--color-text-accent)]" : "text-[var(--color-text-primary)]"}`}>
              {t.label}
            </span>
            <span className="block text-xs text-[var(--color-text-tertiary)]">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
