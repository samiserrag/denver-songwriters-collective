"use client";

/**
 * HappeningsFilters - URL-driven filter bar for /happenings
 *
 * Phase 4.2: Provides search + filter controls with shareable URLs.
 * Phase 4.8: Added day-of-week filter for pattern discovery.
 * Phase 4.55: Redesigned with progressive disclosure:
 *             - Quick filter cards (Open Mics, DSC Happenings, Shows)
 *             - Polished search bar
 *             - All other filters collapsed by default
 * Design: Poster-board aesthetic, engaging cards, no database GUI feel.
 *
 * URL params:
 * - q: search query
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - dsc: 1 = DSC events only
 * - verify: all|verified|needs_verification
 * - location: all|venue|online|hybrid
 * - cost: all|free|paid|unknown
 * - days: comma-separated day abbreviations (mon,tue,wed,etc.) - Phase 4.8
 * - city: city name for nearby filter - Phase 1.4
 * - zip: ZIP code for nearby filter - Phase 1.4
 * - radius: radius in miles (5|10|25|50, default 10) - Phase 1.4
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// SVG Icons (sparse use only)
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Star icon for DSC Events
function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

// Music note / guitar icon for Shows
function MusicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

// Heart icon for Kindred Songwriter Groups
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

// Guitar icon for Jam Sessions
function GuitarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  );
}

// Filter icon for collapsed section
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

// Filter option types - human-readable labels
const TIME_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "open_mic", label: "Open Mics" },
  { value: "shows", label: "Shows" },
  { value: "showcase", label: "Showcases" },
  { value: "workshop", label: "Workshops" },
  { value: "song_circle", label: "Song Circles" },
  { value: "gig", label: "Gigs" },
  { value: "kindred_group", label: "Kindred Songwriter Groups" },
  { value: "jam_session", label: "Jam Sessions" },
  { value: "other", label: "Other" },
] as const;

const LOCATION_OPTIONS = [
  { value: "", label: "All" },
  { value: "venue", label: "In-person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

const COST_OPTIONS = [
  { value: "", label: "Any" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "unknown", label: "Unknown" },
] as const;

const VERIFY_OPTIONS = [
  { value: "", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "needs_verification", label: "Needs verify" },
] as const;

// Phase 4.8: Day-of-week filter options
const DAY_OPTIONS = [
  { value: "mon", label: "Mon", full: "Monday" },
  { value: "tue", label: "Tue", full: "Tuesday" },
  { value: "wed", label: "Wed", full: "Wednesday" },
  { value: "thu", label: "Thu", full: "Thursday" },
  { value: "fri", label: "Fri", full: "Friday" },
  { value: "sat", label: "Sat", full: "Saturday" },
  { value: "sun", label: "Sun", full: "Sunday" },
] as const;

// Phase 1.4: Radius options for location filter
const RADIUS_OPTIONS = [
  { value: "5", label: "5 miles" },
  { value: "10", label: "10 miles" },
  { value: "25", label: "25 miles" },
  { value: "50", label: "50 miles" },
] as const;

interface HappeningsFiltersProps {
  className?: string;
}

export function HappeningsFilters({ className }: HappeningsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read current values from URL
  const q = searchParams.get("q") || "";
  const time = searchParams.get("time") || "upcoming";
  const type = searchParams.get("type") || "";
  const dsc = searchParams.get("dsc") === "1";
  const verify = searchParams.get("verify") || "";
  const location = searchParams.get("location") || "";
  const cost = searchParams.get("cost") || "";
  // Phase 4.8: Day-of-week filter (comma-separated: "mon,tue,wed")
  const daysParam = searchParams.get("days") || "";
  const selectedDays = daysParam ? daysParam.split(",").filter(Boolean) : [];

  // Phase 1.4: Location filter params
  const city = searchParams.get("city") || "";
  const zip = searchParams.get("zip") || "";
  const radius = searchParams.get("radius") || "10";

  // Local search input state (debounced)
  const [searchInput, setSearchInput] = React.useState(q);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Phase 1.4: Local state for location inputs (debounced)
  const [cityInput, setCityInput] = React.useState(city);
  const [zipInput, setZipInput] = React.useState(zip);
  const cityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const zipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync search input when URL changes externally
  React.useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Phase 1.4: Sync location inputs when URL changes externally
  React.useEffect(() => {
    setCityInput(city);
  }, [city]);

  React.useEffect(() => {
    setZipInput(zip);
  }, [zip]);

  // Build URL with updated params
  const buildUrl = React.useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || (value === "upcoming" && key === "time")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    // Clean up default values
    if (params.get("time") === "upcoming") params.delete("time");

    const queryString = params.toString();
    return queryString ? `/happenings?${queryString}` : "/happenings";
  }, [searchParams]);

  // Update URL when filter changes
  const updateFilter = React.useCallback((key: string, value: string | null) => {
    router.push(buildUrl({ [key]: value }));
  }, [router, buildUrl]);

  // Handle search with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);

    // Debounce URL update
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      updateFilter("q", value || null);
    }, 300);
  };

  // Clear search
  const clearSearch = () => {
    setSearchInput("");
    updateFilter("q", null);
  };

  // Clear all filters
  const clearAll = () => {
    setSearchInput("");
    setCityInput("");
    setZipInput("");
    router.push("/happenings");
  };

  // Phase 4.8: Toggle day-of-week filter (multi-select)
  const toggleDay = (day: string) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    updateFilter("days", newDays.length > 0 ? newDays.join(",") : null);
  };

  // Phase 1.4: Handle city input with debounce
  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCityInput(value);

    if (cityTimeoutRef.current) {
      clearTimeout(cityTimeoutRef.current);
    }
    cityTimeoutRef.current = setTimeout(() => {
      // When setting city, clear zip (city and zip are mutually exclusive for filtering)
      router.push(buildUrl({ city: value || null, zip: null }));
    }, 400);
  };

  // Phase 1.4: Handle ZIP input with debounce
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setZipInput(value);

    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }
    zipTimeoutRef.current = setTimeout(() => {
      // When setting zip, clear city (zip takes precedence)
      router.push(buildUrl({ zip: value || null, city: null }));
    }, 400);
  };

  // Phase 1.4: Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    updateFilter("radius", value === "10" ? null : value);
  };

  // Collect active filter pills for display
  const activeFilters: { key: string; label: string; icon?: React.ReactNode }[] = [];

  if (q) {
    activeFilters.push({ key: "q", label: `"${q}"` });
  }
  if (type) {
    const typeLabel = TYPE_OPTIONS.find(o => o.value === type)?.label || type;
    activeFilters.push({
      key: "type",
      label: typeLabel,
      icon: type === "open_mic" ? <MicIcon className="w-3 h-3" /> : undefined
    });
  }
  if (dsc) {
    activeFilters.push({ key: "dsc", label: "DSC" });
  }
  if (location) {
    const locationLabel = LOCATION_OPTIONS.find(o => o.value === location)?.label || location;
    activeFilters.push({
      key: "location",
      label: locationLabel,
      icon: <MapPinIcon className="w-3 h-3" />
    });
  }
  if (cost) {
    const costLabel = COST_OPTIONS.find(o => o.value === cost)?.label || cost;
    activeFilters.push({
      key: "cost",
      label: costLabel,
      icon: <TagIcon className="w-3 h-3" />
    });
  }
  if (verify) {
    const verifyLabel = VERIFY_OPTIONS.find(o => o.value === verify)?.label || verify;
    activeFilters.push({ key: "verify", label: verifyLabel });
  }
  if (time && time !== "upcoming") {
    const timeLabel = TIME_OPTIONS.find(o => o.value === time)?.label || time;
    activeFilters.push({ key: "time", label: timeLabel });
  }
  // Phase 4.8: Day-of-week filter
  if (selectedDays.length > 0) {
    const dayLabels = selectedDays.map((d) => DAY_OPTIONS.find((o) => o.value === d)?.label || d).join(", ");
    activeFilters.push({ key: "days", label: `Days: ${dayLabels}` });
  }
  // Phase 1.4: Location filter (ZIP takes precedence over city)
  if (zip) {
    const radiusLabel = RADIUS_OPTIONS.find(o => o.value === radius)?.label || `${radius} mi`;
    activeFilters.push({
      key: "zip",
      label: `ZIP ${zip} (${radiusLabel})`,
      icon: <MapPinIcon className="w-3 h-3" />
    });
  } else if (city) {
    const radiusLabel = RADIUS_OPTIONS.find(o => o.value === radius)?.label || `${radius} mi`;
    activeFilters.push({
      key: "city",
      label: `${city} (${radiusLabel})`,
      icon: <MapPinIcon className="w-3 h-3" />
    });
  }

  // Check which quick filter is active
  const isOpenMicsActive = type === "open_mic";
  const isDscActive = dsc;
  const isShowsActive = type === "shows";
  const isKindredActive = type === "kindred_group";
  const isJamSessionsActive = type === "jam_session";

  // Build active filter summary for collapsed state
  const activeFilterSummary: string[] = [];
  if (selectedDays.length > 0) {
    const dayLabels = selectedDays.map((d) => DAY_OPTIONS.find((o) => o.value === d)?.label || d).join(", ");
    activeFilterSummary.push(dayLabels);
  }
  if (cost === "free") activeFilterSummary.push("Free");
  if (cost === "paid") activeFilterSummary.push("Paid");
  if (time === "past") activeFilterSummary.push("Past");
  if (time === "all") activeFilterSummary.push("All time");
  // Phase 1.4: Location summary (ZIP wins over city)
  if (zip) {
    activeFilterSummary.push(`Near ${zip}`);
  } else if (city) {
    activeFilterSummary.push(`Near ${city}`);
  }

  // Count active filters (excluding quick filters and search)
  const advancedFilterCount = [
    selectedDays.length > 0,
    time !== "upcoming" && time !== "",
    type && !isOpenMicsActive && !isShowsActive && !isKindredActive && !isJamSessionsActive,
    location,
    cost,
    verify,
    zip || city, // Phase 1.4: Location filter counts as one
  ].filter(Boolean).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Filter Cards - 5 engaging buttons in flexible wrap layout */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => {
            // If already active, clear it; otherwise set it
            if (isOpenMicsActive) {
              updateFilter("type", null);
            } else {
              // Clear dsc if setting type
              router.push(buildUrl({ type: "open_mic", dsc: null }));
            }
          }}
          className={cn(
            "flex-1 min-w-[100px] py-3 px-3 rounded-xl text-center font-medium transition-all",
            isOpenMicsActive
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
          )}
        >
          <MicIcon className="w-5 h-5 mx-auto mb-0.5" />
          <span className="text-sm">Open Mics</span>
        </button>

        <button
          onClick={() => {
            if (isDscActive) {
              updateFilter("dsc", null);
            } else {
              // Clear type if setting dsc
              router.push(buildUrl({ dsc: "1", type: null }));
            }
          }}
          className={cn(
            "flex-1 min-w-[100px] py-3 px-3 rounded-xl text-center font-medium transition-all",
            isDscActive
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
          )}
        >
          <StarIcon className="w-5 h-5 mx-auto mb-0.5" />
          <span className="text-sm">DSC</span>
        </button>

        <button
          onClick={() => {
            if (isShowsActive) {
              updateFilter("type", null);
            } else {
              // Clear dsc if setting type
              router.push(buildUrl({ type: "shows", dsc: null }));
            }
          }}
          className={cn(
            "flex-1 min-w-[100px] py-3 px-3 rounded-xl text-center font-medium transition-all",
            isShowsActive
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
          )}
        >
          <MusicIcon className="w-5 h-5 mx-auto mb-0.5" />
          <span className="text-sm">Shows</span>
        </button>

        <button
          onClick={() => {
            if (isKindredActive) {
              updateFilter("type", null);
            } else {
              // Clear dsc if setting type
              router.push(buildUrl({ type: "kindred_group", dsc: null }));
            }
          }}
          className={cn(
            "flex-1 min-w-[100px] py-3 px-3 rounded-xl text-center font-medium transition-all",
            isKindredActive
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
          )}
        >
          <HeartIcon className="w-5 h-5 mx-auto mb-0.5" />
          <span className="text-sm">Kindred</span>
        </button>

        <button
          onClick={() => {
            if (isJamSessionsActive) {
              updateFilter("type", null);
            } else {
              // Clear dsc if setting type
              router.push(buildUrl({ type: "jam_session", dsc: null }));
            }
          }}
          className={cn(
            "flex-1 min-w-[100px] py-3 px-3 rounded-xl text-center font-medium transition-all",
            isJamSessionsActive
              ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
          )}
        >
          <GuitarIcon className="w-5 h-5 mx-auto mb-0.5" />
          <span className="text-sm">Jams</span>
        </button>
      </div>

      {/* Search - polished */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by venue, artist, or keyword..."
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full px-4 py-3 pl-11 bg-[var(--color-bg-input)] border border-[var(--color-border-input)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)]/20 transition-all"
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)]" />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            aria-label="Clear search"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Collapsed Filters - Progressive Disclosure */}
      <details className="group rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <summary className="cursor-pointer px-4 py-3 flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Filters
              {advancedFilterCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]">
                  {advancedFilterCount}
                </span>
              )}
            </span>
            {activeFilterSummary.length > 0 && (
              <span className="text-sm text-[var(--color-text-secondary)]">
                {activeFilterSummary.join(" · ")}
              </span>
            )}
          </div>
          <ChevronDownIcon className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform group-open:rotate-180" />
        </summary>

        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-[var(--color-border-default)]">
          {/* Days */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Days</label>
            <div className="flex flex-wrap gap-1">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  title={day.full}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    selectedDays.includes(day.value)
                      ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Phase 1.4: Location Filter Row */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Location</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="City (e.g. Denver)"
                  value={cityInput}
                  onChange={handleCityChange}
                  disabled={Boolean(zip)}
                  className={cn(
                    "w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)]",
                    zip && "opacity-50 cursor-not-allowed"
                  )}
                />
              </div>
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="ZIP code"
                  value={zipInput}
                  onChange={handleZipChange}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
              <div className="space-y-1">
                <select
                  value={radius}
                  onChange={handleRadiusChange}
                  disabled={!city && !zip}
                  className={cn(
                    "w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]",
                    !city && !zip && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {RADIUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {zip && city && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                ZIP code takes precedence over city
              </p>
            )}
          </div>

          {/* When + Type + Cost Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">When</label>
              <select
                value={time}
                onChange={(e) => updateFilter("time", e.target.value === "upcoming" ? null : e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
              >
                {TIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Type</label>
              <select
                value={type}
                onChange={(e) => updateFilter("type", e.target.value || null)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Cost</label>
              <select
                value={cost}
                onChange={(e) => updateFilter("cost", e.target.value || null)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"
              >
                {COST_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear all button */}
          {(activeFilters.length > 0 || selectedDays.length > 0) && (
            <div className="flex justify-end pt-2">
              <button
                onClick={clearAll}
                className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </details>

      {/* Active filter pills - compact, below collapsed section */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-sm border border-[var(--color-border-default)]"
            >
              {filter.icon}
              {filter.label}
              <button
                type="button"
                onClick={() => {
                  if (filter.key === "q") {
                    setSearchInput("");
                  }
                  // Phase 1.4: Clear location inputs when removing location filter
                  if (filter.key === "city") {
                    setCityInput("");
                    router.push(buildUrl({ city: null, radius: null }));
                    return;
                  }
                  if (filter.key === "zip") {
                    setZipInput("");
                    router.push(buildUrl({ zip: null, radius: null }));
                    return;
                  }
                  updateFilter(filter.key, null);
                }}
                className="ml-0.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label={`Remove ${filter.label} filter`}
              >
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default HappeningsFilters;
