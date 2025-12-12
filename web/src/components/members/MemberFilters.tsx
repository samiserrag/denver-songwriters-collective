"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Member, MemberRole } from "@/types";

interface MemberFiltersProps {
  members: Member[];
  onFilteredMembersChange: (filtered: Member[]) => void;
  initialRole?: MemberRole;
  className?: string;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "performer", label: "Performers" },
  { value: "studio", label: "Studios" },
  { value: "host", label: "Hosts" },
  { value: "fan", label: "Fans" },
];

export function MemberFilters({
  members,
  onFilteredMembersChange,
  initialRole,
  className,
}: MemberFiltersProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<Set<MemberRole>>(
    initialRole ? new Set([initialRole]) : new Set()
  );
  const [availableForHire, setAvailableForHire] = React.useState(false);
  const [interestedInCowriting, setInterestedInCowriting] = React.useState(false);
  const [selectedGenres, setSelectedGenres] = React.useState<Set<string>>(new Set());
  const [selectedInstruments, setSelectedInstruments] = React.useState<Set<string>>(new Set());

  // Extract unique genres and instruments from all members
  const allGenres = React.useMemo(() => {
    const genres = new Set<string>();
    members.forEach((m) => m.genres?.forEach((g) => genres.add(g)));
    return Array.from(genres).sort();
  }, [members]);

  const allInstruments = React.useMemo(() => {
    const instruments = new Set<string>();
    members.forEach((m) => m.instruments?.forEach((i) => instruments.add(i)));
    return Array.from(instruments).sort();
  }, [members]);

  // Filter members based on all criteria
  React.useEffect(() => {
    let filtered = members;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.bio?.toLowerCase().includes(query) ||
          m.location?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (selectedRoles.size > 0) {
      filtered = filtered.filter((m) => selectedRoles.has(m.role));
    }

    // Availability filters
    if (availableForHire) {
      filtered = filtered.filter((m) => m.availableForHire);
    }
    if (interestedInCowriting) {
      filtered = filtered.filter((m) => m.interestedInCowriting);
    }

    // Genre filter
    if (selectedGenres.size > 0) {
      filtered = filtered.filter((m) =>
        m.genres?.some((g) => selectedGenres.has(g))
      );
    }

    // Instrument filter
    if (selectedInstruments.size > 0) {
      filtered = filtered.filter((m) =>
        m.instruments?.some((i) => selectedInstruments.has(i))
      );
    }

    onFilteredMembersChange(filtered);
  }, [
    members,
    searchQuery,
    selectedRoles,
    availableForHire,
    interestedInCowriting,
    selectedGenres,
    selectedInstruments,
    onFilteredMembersChange,
  ]);

  const toggleRole = (role: MemberRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  };

  const toggleInstrument = (instrument: string) => {
    setSelectedInstruments((prev) => {
      const next = new Set(prev);
      if (next.has(instrument)) {
        next.delete(instrument);
      } else {
        next.add(instrument);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRoles(new Set());
    setAvailableForHire(false);
    setInterestedInCowriting(false);
    setSelectedGenres(new Set());
    setSelectedInstruments(new Set());
  };

  const hasActiveFilters =
    searchQuery ||
    selectedRoles.size > 0 ||
    availableForHire ||
    interestedInCowriting ||
    selectedGenres.size > 0 ||
    selectedInstruments.size > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-lg text-[var(--color-warm-white)] placeholder:text-[var(--color-warm-gray)] focus:outline-none focus:border-[var(--color-gold)]/50"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-warm-gray)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Role filters */}
      <div className="flex flex-wrap gap-2">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => toggleRole(option.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border transition-colors",
              selectedRoles.has(option.value)
                ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)] border-[var(--color-gold)]/30"
                : "bg-white/5 text-[var(--color-warm-gray-light)] border-white/10 hover:border-white/20"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Availability filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setAvailableForHire(!availableForHire)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full border transition-colors",
            availableForHire
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-white/5 text-[var(--color-warm-gray-light)] border-white/10 hover:border-white/20"
          )}
        >
          Available for Hire
        </button>
        <button
          onClick={() => setInterestedInCowriting(!interestedInCowriting)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full border transition-colors",
            interestedInCowriting
              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
              : "bg-white/5 text-[var(--color-warm-gray-light)] border-white/10 hover:border-white/20"
          )}
        >
          Open to Cowriting
        </button>
      </div>

      {/* Genre filters (collapsible) */}
      {allGenres.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-[var(--color-warm-gray-light)] hover:text-[var(--color-warm-white)]">
            Genres {selectedGenres.size > 0 && `(${selectedGenres.size})`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={cn(
                  "px-2 py-1 text-xs rounded-full border transition-colors",
                  selectedGenres.has(genre)
                    ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)] border-[var(--color-gold)]/30"
                    : "bg-white/5 text-[var(--color-warm-gray-light)] border-white/10 hover:border-white/20"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Instrument filters (collapsible) */}
      {allInstruments.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-[var(--color-warm-gray-light)] hover:text-[var(--color-warm-white)]">
            Instruments {selectedInstruments.size > 0 && `(${selectedInstruments.size})`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allInstruments.map((instrument) => (
              <button
                key={instrument}
                onClick={() => toggleInstrument(instrument)}
                className={cn(
                  "px-2 py-1 text-xs rounded-full border transition-colors",
                  selectedInstruments.has(instrument)
                    ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)] border-[var(--color-gold)]/30"
                    : "bg-white/5 text-[var(--color-warm-gray-light)] border-white/10 hover:border-white/20"
                )}
              >
                {instrument}
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-sm text-[var(--color-warm-gray)] hover:text-[var(--color-warm-white)] underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
