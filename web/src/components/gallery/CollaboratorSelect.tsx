"use client";

import { useState } from "react";
import { X, Search, Loader2 } from "lucide-react";

/**
 * Max collaborators per album (client-side cap to prevent abuse).
 */
const MAX_COLLABORATORS = 10;

export interface Collaborator {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface CollaboratorSelectProps {
  /** Currently selected collaborators */
  value: Collaborator[];
  /** Callback when the list changes */
  onChange: (collaborators: Collaborator[]) => void;
  /** Album owner ID — excluded from search results (they are always the creator) */
  ownerId: string;
  /** Disable the component */
  disabled?: boolean;
}

/**
 * Minimal collaborator multi-select:
 * - Search by display_name via /api/gallery-albums/collaborator-search
 * - Add/remove chips
 * - Hard cap of 10 collaborators
 * - No invitations, no notifications
 */
export default function CollaboratorSelect({
  value,
  onChange,
  ownerId,
  disabled = false,
}: CollaboratorSelectProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Collaborator[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = new Set(value.map((c) => c.id));

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setError("Enter at least 2 characters to search.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/gallery-albums/collaborator-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search_name: trimmed }),
      });

      const data = await res.json();

      if (res.ok) {
        const matches: Collaborator[] = Array.isArray(data.matches)
          ? data.matches
          : [];
        // Filter out the album owner and already-selected collaborators
        const filtered = matches.filter(
          (m) => m.id !== ownerId && !selectedIds.has(m.id)
        );
        setResults(filtered);
        if (filtered.length === 0 && matches.length > 0) {
          setError("All matching members are already added.");
        } else if (filtered.length === 0) {
          setError("No members found.");
        }
      } else {
        setError(data.error || "Search failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = (collaborator: Collaborator) => {
    if (value.length >= MAX_COLLABORATORS) {
      setError(`Maximum ${MAX_COLLABORATORS} collaborators allowed.`);
      return;
    }
    onChange([...value, collaborator]);
    // Remove from results so they can't be double-added
    setResults((prev) => prev.filter((r) => r.id !== collaborator.id));
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Selected Chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((collaborator) => (
            <span
              key={collaborator.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-full text-sm text-[var(--color-text-primary)]"
            >
              {collaborator.name}
              <button
                type="button"
                onClick={() => handleRemove(collaborator.id)}
                disabled={disabled}
                className="p-0.5 hover:bg-[var(--color-bg-primary)] rounded-full transition-colors disabled:opacity-50"
                title={`Remove ${collaborator.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Capacity indicator */}
      {value.length > 0 && (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {value.length}/{MAX_COLLABORATORS} collaborators
        </p>
      )}

      {/* Search Form */}
      {value.length < MAX_COLLABORATORS && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              placeholder="Search members by name..."
              disabled={disabled || isSearching}
              className="w-full pl-8 pr-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={disabled || isSearching || query.trim().length < 2}
            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </form>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-[var(--color-text-tertiary)]">{error}</p>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="border border-[var(--color-border-default)] rounded-lg divide-y divide-[var(--color-border-default)] max-h-48 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleAdd(result)}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
            >
              <span className="text-sm text-[var(--color-text-primary)]">
                {result.name}
              </span>
              <span className="ml-auto text-xs text-[var(--color-text-accent)]">
                + Add
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
