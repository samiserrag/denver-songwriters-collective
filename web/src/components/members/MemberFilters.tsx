"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Member, MemberRole } from "@/types";
import { INSTRUMENT_OPTIONS, GENRE_OPTIONS, SPECIALTY_OPTIONS } from "@/lib/profile/options";

interface MemberFiltersProps {
  members: Member[];
  onFilteredMembersChange: (filtered: Member[]) => void;
  initialRole?: MemberRole;
  className?: string;
}

type IdentityFlag = "songwriter" | "studio" | "host" | "fan";

const IDENTITY_OPTIONS: { value: IdentityFlag; label: string }[] = [
  { value: "songwriter", label: "Songwriters" },
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
  // Map legacy role to identity flag for initial state
  const mapRoleToIdentity = (role?: MemberRole): IdentityFlag | undefined => {
    if (!role) return undefined;
    if (role === "performer" || role === "songwriter") return "songwriter";
    if (role === "host" || role === "studio" || role === "fan") return role;
    return undefined;
  };
  const initialIdentity = mapRoleToIdentity(initialRole);
  const [selectedIdentities, setSelectedIdentities] = React.useState<Set<IdentityFlag>>(
    initialIdentity ? new Set([initialIdentity]) : new Set()
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

  // Use curated options for specialties, filter to show only options members have
  const allSpecialties = React.useMemo(() => {
    const memberSpecialtiesLower = new Set<string>();
    members.forEach((m) => m.specialties?.forEach((s) => memberSpecialtiesLower.add(s.toLowerCase())));
    return SPECIALTY_OPTIONS.filter((s) => memberSpecialtiesLower.has(s.toLowerCase()));
  }, [members]);

  // Filter members based on all criteria
  React.useEffect(() => {
    let filtered = members;

    // Search filter - covers name, bio, location, instruments, genres, specialties
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => {
        // Check name
        if (m.name.toLowerCase().includes(query)) return true;
        // Check bio
        if (m.bio?.toLowerCase().includes(query)) return true;
        // Check location/city
        if (m.location?.toLowerCase().includes(query)) return true;
        // Check instruments array
        if (m.instruments?.some((i) => i.toLowerCase().includes(query))) return true;
        // Check genres array
        if (m.genres?.some((g) => g.toLowerCase().includes(query))) return true;
        // Check specialties array
        if (m.specialties?.some((s) => s.toLowerCase().includes(query))) return true;
        return false;
      });
    }

    // Identity flag filter (uses boolean flags instead of legacy role)
    if (selectedIdentities.size > 0) {
      filtered = filtered.filter((m) => {
        if (selectedIdentities.has("songwriter") && m.isSongwriter) return true;
        if (selectedIdentities.has("host") && m.isHost) return true;
        if (selectedIdentities.has("studio") && m.isStudio) return true;
        if (selectedIdentities.has("fan") && m.isFan) return true;
        return false;
      });
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

    // Specialty filter (case-insensitive)
    if (selectedSpecialties.size > 0) {
      const selectedSpecialtiesLower = new Set(Array.from(selectedSpecialties).map(s => s.toLowerCase()));
      filtered = filtered.filter((m) =>
        m.specialties?.some((s) => selectedSpecialtiesLower.has(s.toLowerCase()))
      );
    }

    onFilteredMembersChange(filtered);
  }, [
    members,
    searchQuery,
    selectedIdentities,
    availableForHire,
    interestedInCowriting,
    openToCollabs,
    selectedGenres,
    selectedInstruments,
    selectedSpecialties,
    onFilteredMembersChange,
  ]);

  const toggleIdentity = (identity: IdentityFlag) => {
    setSelectedIdentities((prev) => {
      const next = new Set(prev);
      if (next.has(identity)) {
        next.delete(identity);
      } else {
        next.add(identity);
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
    setSelectedIdentities(new Set());
    setAvailableForHire(false);
    setInterestedInCowriting(false);
    setOpenToCollabs(false);
    setSelectedGenres(new Set());
    setSelectedInstruments(new Set());
    setSelectedSpecialties(new Set());
  };

  const hasActiveFilters =
    searchQuery ||
    selectedIdentities.size > 0 ||
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

      {/* Identity filters */}
      <div className="flex flex-wrap gap-2">
        {IDENTITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => toggleIdentity(option.value)}
            className={cn(
              "px-3 py-1.5 text-base rounded-full border transition-colors",
              selectedIdentities.has(option.value)
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
      {(selectedGenres.size > 0 || selectedInstruments.size > 0 || selectedSpecialties.size > 0) && (
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
          {Array.from(selectedSpecialties).map((specialty) => (
            <span
              key={`specialty-${specialty}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--color-accent-primary)]/20 text-[var(--color-text-accent)] text-sm border border-[var(--color-border-accent)]/30"
            >
              {specialty}
              <button
                type="button"
                onClick={() => toggleSpecialty(specialty)}
                className="ml-0.5 hover:text-red-400 transition-colors"
                aria-label={`Remove ${specialty} filter`}
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
