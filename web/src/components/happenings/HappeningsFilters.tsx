"use client";

/**
 * HappeningsFilters - URL-driven filter bar for /happenings
 *
 * Phase 4.2: Provides search + filter controls with shareable URLs.
 * Phase 4.8: Added day-of-week filter for pattern discovery.
 * Phase 4.55: Redesigned with progressive disclosure:
 *             - Quick filter cards (Open Mics, CSC Happenings, showcase/gig/workshop genres)
 *             - Polished search bar
 *             - All other filters collapsed by default
 * Design: Poster-board aesthetic, engaging cards, no database GUI feel.
 *
 * URL params:
 * - q: search query
 * - time: upcoming|past|all
 * - type: event_type (open_mic, showcase, workshop, etc.)
 * - csc: 1 = CSC events only
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
import { createClient } from "@/lib/supabase/client";
import {
  getUserSavedHappeningsFilters,
  hasSavedHappeningsFilters,
  sanitizeSavedHappeningsFilters,
  savedFiltersToUrlUpdates,
  upsertUserSavedHappeningsFilters,
  type SavedHappeningsFilters,
} from "@/lib/happenings/savedFilters";

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
  { value: "showcase", label: "Showcases" },
  { value: "gig", label: "Gigs / Performances" },
  { value: "workshop", label: "Workshops" },
  { value: "song_circle", label: "Song Circles" },
  { value: "jam_session", label: "Jam Sessions" },
  { value: "poetry", label: "Poetry" },
  { value: "irish", label: "Irish" },
  { value: "blues", label: "Blues" },
  { value: "bluegrass", label: "Bluegrass" },
  { value: "comedy", label: "Comedy" },
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
  const supabase = React.useMemo(() => createClient(), []);

  // Read current values from URL
  const q = searchParams.get("q") || "";
  const time = searchParams.get("time") || "upcoming";
  const type = searchParams.get("type") || "";
  const csc = searchParams.get("csc") === "1";
  const verify = searchParams.get("verify") || "";
  const location = searchParams.get("location") || "";
  const cost = searchParams.get("cost") || "";
  // Phase 4.8: Day-of-week filter (comma-separated: "mon,tue,wed")
  const daysParam = searchParams.get("days") || "";
  const selectedDays = React.useMemo(
    () => (daysParam ? daysParam.split(",").filter(Boolean) : []),
    [daysParam]
  );

  // Phase 1.4: Location filter params
  const city = searchParams.get("city") || "";
  const zip = searchParams.get("zip") || "";
  const radius = searchParams.get("radius") || "10";

  // Local search input state (debounced)
  const [searchInput, setSearchInput] = React.useState(q);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track if we're the source of the URL change to avoid sync loops
  const isLocalSearchUpdate = React.useRef(false);

  // Phase 1.4: Local state for location inputs (debounced)
  const [cityInput, setCityInput] = React.useState(city);
  const [zipInput, setZipInput] = React.useState(zip);
  const cityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const zipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLocalCityUpdate = React.useRef(false);
  const isLocalZipUpdate = React.useRef(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [savedFilters, setSavedFilters] = React.useState<SavedHappeningsFilters | null>(null);
  const [savedAutoApply, setSavedAutoApply] = React.useState(false);
  // Start false — avoids SSR→client hydration mismatch that can freeze the DOM.
  // The effect below sets it true briefly while fetching, then back to false.
  const [savedLoading, setSavedLoading] = React.useState(false);
  const [savedSaving, setSavedSaving] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);
  const [savedPanelOpen, setSavedPanelOpen] = React.useState(false);
  const hasAttemptedAutoApply = React.useRef(false);

  // Sync search input when URL changes externally (e.g., browser back/forward)
  // Skip sync if we initiated the change to avoid erasing user's typing
  React.useEffect(() => {
    if (isLocalSearchUpdate.current) {
      isLocalSearchUpdate.current = false;
      return;
    }
    setSearchInput(q);
  }, [q]);

  // Phase 1.4: Sync location inputs when URL changes externally
  React.useEffect(() => {
    if (isLocalCityUpdate.current) {
      isLocalCityUpdate.current = false;
      return;
    }
    setCityInput(city);
  }, [city]);

  React.useEffect(() => {
    if (isLocalZipUpdate.current) {
      isLocalZipUpdate.current = false;
      return;
    }
    setZipInput(zip);
  }, [zip]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSavedFilters() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user || cancelled) {
          return;
        }

        setUserId(session.user.id);
        const row = await getUserSavedHappeningsFilters(supabase, session.user.id);
        if (cancelled) return;

        if (row) {
          setSavedFilters(row.filters);
          setSavedAutoApply(row.autoApply);
          if (row.autoApply || hasSavedHappeningsFilters(row.filters)) {
            setSavedPanelOpen(true);
          }
        }
      } catch {
        // Auth or fetch failed — degrade gracefully, section still renders
      } finally {
        // Always resolve loading — React 18+ safely ignores setState on unmounted components.
        // The previous `if (isMounted)` guard caused a permanent "Loading…" state when
        // Suspense boundaries unmounted the component mid-flight (cleanup set isMounted=false
        // before finally executed, so setSavedLoading was skipped).
        setSavedLoading(false);
      }
    }

    loadSavedFilters();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
      // Mark that we're initiating this URL change to prevent sync loop
      isLocalSearchUpdate.current = true;
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
      // Mark that we're initiating this URL change to prevent sync loop
      isLocalCityUpdate.current = true;
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
      // Mark that we're initiating this URL change to prevent sync loop
      isLocalZipUpdate.current = true;
      // When setting zip, clear city (zip takes precedence)
      router.push(buildUrl({ zip: value || null, city: null }));
    }, 400);
  };

  // Phase 1.4: Handle radius change
  const handleRadiusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    updateFilter("radius", value === "10" ? null : value);
  };

  const saveCurrentFilters = React.useCallback(async () => {
    if (!userId) {
      setSavedMessage("Sign in to save filters.");
      return;
    }

    setSavedSaving(true);
    setSavedMessage(null);

    const currentFilters: SavedHappeningsFilters = sanitizeSavedHappeningsFilters({
      type,
      csc,
      days: selectedDays,
      cost,
      city,
      zip,
      radius,
    });

    const updated = await upsertUserSavedHappeningsFilters(supabase, userId, {
      autoApply: savedAutoApply,
      filters: currentFilters,
    });

    if (updated) {
      setSavedFilters(updated.filters);
      setSavedAutoApply(updated.autoApply);
      setSavedMessage(
        hasSavedHappeningsFilters(updated.filters)
          ? "Saved filters updated."
          : "Saved filters cleared."
      );
    } else {
      setSavedMessage("Could not save filters.");
    }

    setSavedSaving(false);
  }, [city, cost, csc, radius, savedAutoApply, selectedDays, supabase, type, userId, zip]);

  const applySavedFilters = React.useCallback(() => {
    if (!savedFilters || !hasSavedHappeningsFilters(savedFilters)) return;
    router.push(buildUrl(savedFiltersToUrlUpdates(savedFilters)));
  }, [buildUrl, router, savedFilters]);

  const clearSavedFilters = React.useCallback(async () => {
    if (!userId) return;

    setSavedSaving(true);
    setSavedMessage(null);

    const updated = await upsertUserSavedHappeningsFilters(supabase, userId, {
      autoApply: false,
      filters: {},
    });

    if (updated) {
      setSavedFilters(updated.filters);
      setSavedAutoApply(updated.autoApply);
      setSavedMessage("Saved filters reset.");
    } else {
      setSavedMessage("Could not reset saved filters.");
    }

    setSavedSaving(false);
  }, [supabase, userId]);

  const setSavedRecallMode = React.useCallback(async (nextAutoApply: boolean) => {
    if (!userId) return;
    if (savedAutoApply === nextAutoApply) return;

    setSavedSaving(true);
    setSavedMessage(null);

    const updated = await upsertUserSavedHappeningsFilters(supabase, userId, {
      autoApply: nextAutoApply,
      filters: savedFilters || {},
    });

    if (updated) {
      setSavedFilters(updated.filters);
      setSavedAutoApply(updated.autoApply);
      setSavedMessage(updated.autoApply ? "Auto-open mode enabled." : "One-click mode enabled.");
    } else {
      setSavedMessage("Could not update recall mode.");
    }

    setSavedSaving(false);
  }, [savedAutoApply, savedFilters, supabase, userId]);

  React.useEffect(() => {
    if (!savedMessage) return;
    const timeout = setTimeout(() => setSavedMessage(null), 2500);
    return () => clearTimeout(timeout);
  }, [savedMessage]);

  React.useEffect(() => {
    if (!savedMessage) return;
    setSavedPanelOpen(true);
  }, [savedMessage]);

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
  if (csc) {
    activeFilters.push({ key: "csc", label: "CSC" });
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
  const isCscActive = csc;
  const isShowcaseActive = type === "showcase";
  const isGigActive = type === "gig";
  const isWorkshopActive = type === "workshop";
  const isJamSessionsActive = type === "jam_session";
  const isPoetryActive = type === "poetry";
  const isIrishActive = type === "irish";
  const isBluesActive = type === "blues";
  const isBluegrassActive = type === "bluegrass";
  const isComedyActive = type === "comedy";

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

  const hasExplicitFilterParams = Boolean(
    q ||
      type ||
      csc ||
      verify ||
      location ||
      cost ||
      daysParam ||
      city ||
      zip ||
      (radius && radius !== "10") ||
      (time && time !== "upcoming")
  );

  React.useEffect(() => {
    if (hasAttemptedAutoApply.current) return;
    if (savedLoading || !userId || !savedAutoApply) return;
    if (hasExplicitFilterParams) return;
    if (!savedFilters || !hasSavedHappeningsFilters(savedFilters)) return;

    hasAttemptedAutoApply.current = true;
    router.replace(buildUrl(savedFiltersToUrlUpdates(savedFilters)));
  }, [
    buildUrl,
    hasExplicitFilterParams,
    router,
    savedAutoApply,
    savedFilters,
    savedLoading,
    userId,
  ]);

  // Count active filters (excluding quick filters and search)
  const advancedFilterCount = [
    selectedDays.length > 0,
    time !== "upcoming" && time !== "",
    type && !isOpenMicsActive && !isShowcaseActive && !isGigActive && !isWorkshopActive && !isJamSessionsActive && !isPoetryActive && !isIrishActive && !isBluesActive && !isBluegrassActive && !isComedyActive,
    location,
    cost,
    verify,
    zip || city, // Phase 1.4: Location filter counts as one
  ].filter(Boolean).length;

  const hasSavedFilters = Boolean(savedFilters && hasSavedHappeningsFilters(savedFilters));
  const savedStatusLabel = savedLoading
    ? "Loading…"
    : !userId
      ? "Sign in to use"
      : hasSavedFilters
        ? savedAutoApply
          ? "Auto-open on"
          : "One-click mode"
        : "No filters saved yet";
  const savedStatusColor = savedLoading
    ? "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
    : !userId
      ? "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
      : hasSavedFilters
        ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
        : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]";

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Filter Cards - engaging buttons with emoji icons in flexible wrap layout */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {/* Type filter buttons with emojis from EVENT_TYPE_CONFIG */}
        {([
          { type: "open_mic", label: "Open Mics", emoji: "🎤", isActive: isOpenMicsActive },
          { type: "csc", label: "CSC", emoji: "⭐", isActive: isCscActive },
          { type: "showcase", label: "Showcases", emoji: "🎭", isActive: isShowcaseActive },
          { type: "gig", label: "Gigs", emoji: "🎵", isActive: isGigActive },
          { type: "workshop", label: "Workshops", emoji: "📚", isActive: isWorkshopActive },
          { type: "jam_session", label: "Jams", emoji: "🎸", isActive: isJamSessionsActive },
          { type: "poetry", label: "Poetry", emoji: "✒️", isActive: isPoetryActive },
          { type: "irish", label: "Irish", emoji: "☘️", isActive: isIrishActive },
          { type: "blues", label: "Blues", emoji: "🎸", isActive: isBluesActive },
          { type: "bluegrass", label: "Bluegrass", emoji: "🪕", isActive: isBluegrassActive },
          { type: "comedy", label: "Comedy", emoji: "😂", isActive: isComedyActive },
        ] as const).map((filter) => (
          <button
            key={filter.type}
            onClick={() => {
              if (filter.type === "csc") {
                if (filter.isActive) {
                  updateFilter("csc", null);
                } else {
                  router.push(buildUrl({ csc: "1", type: null }));
                }
              } else {
                if (filter.isActive) {
                  updateFilter("type", null);
                } else {
                  router.push(buildUrl({ type: filter.type, csc: null }));
                }
              }
            }}
            className={cn(
              "flex-1 min-w-[90px] py-3 px-3 rounded-xl text-center font-medium transition-all",
              filter.isActive
                ? "bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-lg"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-primary)] hover:shadow-md"
            )}
          >
            <span className="text-xl block mb-0.5">{filter.emoji}</span>
            <span className="text-sm">{filter.label}</span>
          </button>
        ))}
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

      {/* Phase 1.41: Location Filter Row - Always visible (moved outside <details>) */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">Location</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <div className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setSavedPanelOpen((v) => !v)}
            className="w-full sm:w-auto text-left flex items-center justify-between gap-3"
            aria-expanded={savedPanelOpen}
            disabled={savedLoading}
          >
            <span className="flex items-center gap-2">
              <FilterIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Saved Filters
              </span>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full border",
                savedStatusColor
              )}>
                {savedStatusLabel}
              </span>
            </span>
            <ChevronDownIcon
              className={cn(
                "w-4 h-4 text-[var(--color-text-secondary)] transition-transform",
                savedPanelOpen && "rotate-180"
              )}
            />
          </button>
          {!savedLoading && userId && hasSavedFilters && (
            <button
              type="button"
              onClick={applySavedFilters}
              disabled={savedSaving}
              className="w-full sm:w-auto px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:opacity-90 transition disabled:opacity-50"
            >
              Apply Saved
            </button>
          )}
        </div>
        {savedPanelOpen && !savedLoading && (
          <div className="border-t border-[var(--color-border-default)] p-3 space-y-3">
            {userId ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={saveCurrentFilters}
                    disabled={savedSaving}
                    className="px-3 py-2 text-xs rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] transition-colors disabled:opacity-50"
                  >
                    Save Current Filters
                  </button>
                  <button
                    type="button"
                    onClick={applySavedFilters}
                    disabled={savedSaving || !hasSavedFilters}
                    className="px-3 py-2 text-xs rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:opacity-90 transition disabled:opacity-50"
                  >
                    Apply Saved Filters
                  </button>
                  <button
                    type="button"
                    onClick={clearSavedFilters}
                    disabled={savedSaving}
                    className="px-3 py-2 text-xs rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)] transition-colors disabled:opacity-50"
                  >
                    Reset Saved
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] p-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">Recall mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSavedRecallMode(false)}
                      disabled={savedSaving}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors",
                        !savedAutoApply
                          ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      <span aria-hidden="true">👆</span>
                      One-click Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setSavedRecallMode(true)}
                      disabled={savedSaving}
                      className={cn(
                        "flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors",
                        savedAutoApply
                          ? "bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                          : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      <span aria-hidden="true">⚡</span>
                      Auto-open
                    </button>
                  </div>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    One-click lets you choose when to apply. Auto-open applies saved filters automatically when this page loads without URL filters.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>Need full setup controls?</span>
                  <a
                    href="/dashboard/settings"
                    className="text-[var(--color-accent-primary)] hover:underline"
                  >
                    Open Dashboard Settings
                  </a>
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Sign in to save filters once, then apply with one tap or auto-open each visit.
              </p>
            )}
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Weekly digest personalization uses your saved type, day, cost, and location filters.
            </p>
            {savedMessage && (
              <p className="text-xs text-[var(--color-text-secondary)]">{savedMessage}</p>
            )}
          </div>
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
