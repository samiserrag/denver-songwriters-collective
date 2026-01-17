"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface SearchResult {
  type: "event" | "open_mic" | "member" | "blog" | "venue";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  image?: string;
}

const TYPE_LABELS: Record<string, string> = {
  open_mic: "Open Mic",
  event: "Event",
  member: "Member",
  blog: "Blog",
  venue: "Venue",
};

const TYPE_ICONS: Record<string, string> = {
  open_mic: "🎤",
  event: "📅",
  member: "👤",
  blog: "📝",
  venue: "📍",
};

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Close with Escape
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }

      // Navigate results with arrow keys
      if (isOpen && results.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault();
          const result = results[selectedIndex];
          router.push(result.url);
          setIsOpen(false);
          setQuery("");
          setResults([]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, router]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.url);
    setIsOpen(false);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Search Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)]/50 border border-white/10 rounded-lg hover:border-white/20 hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--color-bg-input)] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 border-b border-white/10">
              <svg className="w-5 h-5 text-[var(--color-text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search happenings, venues, members..."
                className="flex-1 py-4 bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-placeholder)] focus:outline-none"
              />
              {isLoading && (
                <div className="w-4 h-4 border-2 border-[var(--color-border-input)] border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                  setResults([]);
                }}
                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                {results.map((result, index) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                      index === selectedIndex ? "bg-white/10" : ""
                    }`}
                  >
                    {result.image ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        <Image
                          src={result.image}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-secondary)] flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">{TYPE_ICONS[result.type]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--color-text-primary)] font-medium truncate">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-[var(--color-text-tertiary)] text-sm truncate">{result.subtitle}</p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] flex-shrink-0">
                      {TYPE_LABELS[result.type]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State */}
            {query.length >= 2 && !isLoading && results.length === 0 && (
              <div className="px-4 py-8 text-center text-[var(--color-text-tertiary)]">
                <p>No results found for &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {/* Hint */}
            {query.length < 2 && (
              <div className="px-4 py-6 text-center text-[var(--color-text-tertiary)] text-sm">
                <p>Type at least 2 characters to search</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 text-xs text-[var(--color-text-tertiary)]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded">↵</kbd>
                  to select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-input)] rounded">esc</kbd>
                to close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
