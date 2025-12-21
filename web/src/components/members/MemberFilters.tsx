"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Member, MemberRole } from "@/types";
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS } from "@/lib/profile/options";

interface MemberFiltersProps {
  members: Member[];
  onFilteredMembersChange: (filtered: Member[]) => void;
  initialRole?: MemberRole;
  className?: string;
}

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "performer", label: "Songwriters" },
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
  const [openToCollabs, setOpenToCollabs] = React.useState(false);
  const [selectedGenres, setSelectedGenres] = React.useState<Set<string>>(new Set());
  const [selectedInstruments, setSelectedInstruments] = React.useState<Set<string>>(new Set());
  const [selectedSpecialties, setSelectedSpecialties] = React.useState<Set<string>>(new Set());

  // Use curated options for genres and instruments
  // Filter to only show options that at least one member has
  const allGenres = React.useMemo(() => {
    const memberGenresLower = new Set<string>();
    members.forEach((m) => m.genres?.forEach((g) => memberGenresLower.add(g.toLowerCase())));
    return GENRE_OPTIONS.filter((g) => memberGenresLower.has(g.toLowerCase()));
  }, [members]);

  const allInstruments = React.useMemo(() => {
    const memberInstrumentsLower = new Set<string>();
    members.forEach((m) => m.instruments?.forEach((i) => memberInstrumentsLower.add(i.toLowerCase())));
    return INSTRUMENT_OPTIONS.filter((i) => memberInstrumentsLower.has(i.toLowerCase()));
  }, [members]);

  // Extract unique specialties from all members (keep dynamic since no curated list)
  const allSpecialties = React.useMemo(() => {
    const specialties = new Set<string>();
    members.forEach((m) => m.specialties?.forEach((s) => specialties.add(s)));
    return Array.from(specialties).sort();
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
    if (openToCollabs) {
      filtered = filtered.filter((m) => m.openToCollabs);
    }

    // Genre filter (case-insensitive)
    if (selectedGenres.size > 0) {
      const selectedGenresLower = new Set(Array.from(selectedGenres).map(g => g.toLowerCase()));
      filtered = filtered.filter((m) =>
        m.genres?.some((g) => selectedGenresLower.has(g.toLowerCase()))
      );
    }

    // Instrument filter (case-insensitive)
    if (selectedInstruments.size > 0) {
      const selectedInstrumentsLower = new Set(Array.from(selectedInstruments).map(i => i.toLowerCase()));
      filtered = filtered.filter((m) =>
        m.instruments?.some((i) => selectedInstrumentsLower.has(i.toLowerCase()))
      );
    }

    // Specialty filter
    if (selectedSpecialties.size > 0) {
      filtered = filtered.filter((m) =>
        m.specialties?.some((s) => selectedSpecialties.has(s))
      );
    }

    onFilteredMembersChange(filtered);
  }, [
    members,
    searchQuery,
    selectedRoles,
    availableForHire,
    interestedInCowriting,
    openToCollabs,
    selectedGenres,
    selectedInstruments,
    selectedSpecialties,
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

  const toggleSpecialty = (specialty: string) => {
    setSelectedSpecialties((prev) => {
      const next = new Set(prev);
      if (next.has(specialty)) {
        next.delete(specialty);
      } else {
        next.add(specialty);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRoles(new Set());
    setAvailableForHire(false);
    setInterestedInCowriting(false);
    setOpenToCollabs(false);
    setSelectedGenres(new Set());
    setSelectedInstruments(new Set());
    setSelectedSpecialties(new Set());
  };

  const hasActiveFilters =
    searchQuery ||
    selectedRoles.size > 0 ||
    availableForHire ||
    interestedInCowriting ||
    openToCollabs ||
    selectedGenres.size > 0 ||
    selectedInstruments.size > 0 ||
    selectedSpecialties.size > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-border-accent)]/50"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]"
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
              "px-3 py-1.5 text-base rounded-full border transition-colors",
              selectedRoles.has(option.value)
                ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30"
                : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
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
            "px-3 py-1.5 text-base rounded-full border transition-colors",
            availableForHire
              ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30"
              : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
          )}
        >
          💼 Available for Hire
        </button>
        <button
          onClick={() => setInterestedInCowriting(!interestedInCowriting)}
          className={cn(
            "px-3 py-1.5 text-base rounded-full border transition-colors",
            interestedInCowriting
              ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
              : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
          )}
        >
          ✍️ Interested in Cowriting
        </button>
        <button
          onClick={() => setOpenToCollabs(!openToCollabs)}
          className={cn(
            "px-3 py-1.5 text-base rounded-full border transition-colors",
            openToCollabs
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
          )}
        >
          🤝 Open to Collaborations
        </button>
      </div>

      {/* Genre filters (collapsible) */}
      {allGenres.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            Genres {selectedGenres.size > 0 && `(${selectedGenres.size})`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allGenres.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={cn(
                  "px-2 py-1 text-sm rounded-full border transition-colors",
                  selectedGenres.has(genre)
                    ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30"
                    : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
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
          <summary className="cursor-pointer text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            Instruments {selectedInstruments.size > 0 && `(${selectedInstruments.size})`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allInstruments.map((instrument) => (
              <button
                key={instrument}
                onClick={() => toggleInstrument(instrument)}
                className={cn(
                  "px-2 py-1 text-sm rounded-full border transition-colors",
                  selectedInstruments.has(instrument)
                    ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30"
                    : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
                )}
              >
                {instrument}
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Specialty filters (collapsible) */}
      {allSpecialties.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            Specialties {selectedSpecialties.size > 0 && `(${selectedSpecialties.size})`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allSpecialties.map((specialty) => (
              <button
                key={specialty}
                onClick={() => toggleSpecialty(specialty)}
                className={cn(
                  "px-2 py-1 text-sm rounded-full border transition-colors",
                  selectedSpecialties.has(specialty)
                    ? "bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] border-[var(--color-border-accent)]/30"
                    : "bg-white/5 text-[var(--color-text-secondary)] border-white/10 hover:border-white/20"
                )}
              >
                {specialty}
              </button>
            ))}
          </div>
        </details>
      )}

      {/* Active filter chips */}
      {(selectedGenres.size > 0 || selectedInstruments.size > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">Active filters:</span>
          {Array.from(selectedGenres).map((genre) => (
            <span
              key={`genre-${genre}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm border border-[var(--color-border-accent)]/30"
            >
              {genre}
              <button
                type="button"
                onClick={() => toggleGenre(genre)}
                className="ml-0.5 hover:text-red-400 transition-colors"
                aria-label={`Remove ${genre} filter`}
              >
                ×
              </button>
            </span>
          ))}
          {Array.from(selectedInstruments).map((instrument) => (
            <span
              key={`instrument-${instrument}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm border border-[var(--color-border-accent)]/30"
            >
              {instrument}
              <button
                type="button"
                onClick={() => toggleInstrument(instrument)}
                className="ml-0.5 hover:text-red-400 transition-colors"
                aria-label={`Remove ${instrument} filter`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
