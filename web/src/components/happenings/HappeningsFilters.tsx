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
 * - favorites: 1 (favorites only)
 * - days: comma-separated day abbreviations (mon,tue,wed,etc.) - Phase 4.8
 * - city: city name for nearby filter - Phase 1.4
 * - zip: ZIP code for nearby filter - Phase 1.4
 * - radius: radius in miles (5|10|25|50, default 10) - Phase 1.4
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronDown as ChevronDownIcon,
  Clock,
  Filter as FilterIcon,
  Guitar,
  Heart,
  Laugh,
  MapPin as MapPinIcon,
  Mic as MicIcon,
  Music,
  PenLine,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
  Tag as TagIcon,
  X as XIcon,
  Zap,
} from "lucide-react";
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
  /** Today's date key (YYYY-MM-DD in Denver timezone) */
  todayKey: string;
  /** Start of the current window (YYYY-MM-DD) */
  windowStartKey: string;
  /** End of the current window (YYYY-MM-DD) */
  windowEndKey: string;
  /** Current server-side time filter fallback */
  timeFilter: string;
  className?: string;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(startKey: string, endKey: string): string {
  const start = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function formatDateForPill(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function HappeningsFilters({
  todayKey,
  windowStartKey,
  windowEndKey,
  timeFilter,
  className,
}: HappeningsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createClient(), []);

  // Read current values from URL
  const q = searchParams.get("q") || "";
  const time = searchParams.get("time") || "upcoming";
  const dateFilter = searchParams.get("date") || "";
  const type = searchParams.get("type") || "";
  const csc = searchParams.get("csc") === "1";
  const verify = searchParams.get("verify") || "";
  const location = searchParams.get("location") || "";
  const cost = searchParams.get("cost") || "";
  const favoritesOnly = searchParams.get("favorites") === "1";
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
  const [savedLoading, setSavedLoading] = React.useState(true);
  const [savedSaving, setSavedSaving] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);
  const hasAttemptedAutoApply = React.useRef(false);
  const effectiveTime = time || timeFilter || "upcoming";
  const isPastMode = effectiveTime === "past";
  const tomorrowKey = React.useMemo(() => addDays(todayKey, 1), [todayKey]);
  const activeDateKey = isDateKey(dateFilter) ? dateFilter : "";
  const [dateWarningMessage, setDateWarningMessage] = React.useState<string | null>(null);
  const [pickerDate, setPickerDate] = React.useState(
    activeDateKey || (isPastMode ? windowEndKey : todayKey)
  );

  React.useEffect(() => {
    setPickerDate(activeDateKey || (isPastMode ? windowEndKey : todayKey));
  }, [activeDateKey, isPastMode, windowEndKey, todayKey]);

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

        // Race against a timeout — during page load, ~500 concurrent
        // /auth/v1/user calls can saturate the browser's 6-connection-per-
        // domain limit, causing this PostgREST query to hang indefinitely
        // in the browser's network queue. A 5 s timeout lets us degrade
        // gracefully (show "No filters saved yet") instead of spinning
        // "Loading…" forever.
        const row = await Promise.race([
          getUserSavedHappeningsFilters(supabase, session.user.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (cancelled) return;

        setUserId(session.user.id);
        if (row) {
          setSavedFilters(row.filters);
          setSavedAutoApply(row.autoApply);
        }
      } catch {
        // Auth or fetch failed — degrade gracefully, section still renders
      } finally {
        if (!cancelled) setSavedLoading(false);
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

  const navigateWithDate = React.useCallback((dateKey?: string) => {
    router.push(buildUrl({ date: dateKey || null }), { scroll: false });
  }, [buildUrl, router]);

  const setDateFilter = React.useCallback((dateKey: string) => {
    if (!isDateKey(dateKey)) {
      setDateWarningMessage("Please choose a valid date.");
      return;
    }
    if (dateKey < windowStartKey || dateKey > windowEndKey) {
      setDateWarningMessage(`Not in current range (${formatDateRange(windowStartKey, windowEndKey)})`);
      return;
    }
    setDateWarningMessage(null);
    navigateWithDate(dateKey);
  }, [navigateWithDate, windowEndKey, windowStartKey]);

  const handleToday = () => {
    if (isPastMode) {
      setDateWarningMessage("Today and tomorrow are unavailable in Past mode.");
      return;
    }
    setDateFilter(todayKey);
  };

  const handleTomorrow = () => {
    if (isPastMode) {
      setDateWarningMessage("Today and tomorrow are unavailable in Past mode.");
      return;
    }
    setDateFilter(tomorrowKey);
  };

  const handleJumpToDate = () => {
    setDateFilter(pickerDate);
  };

  const clearDateFilter = () => {
    setDateWarningMessage(null);
    navigateWithDate(undefined);
  };

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
    setDateWarningMessage(null);
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
      favorites: favoritesOnly,
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
  }, [city, cost, csc, favoritesOnly, radius, savedAutoApply, selectedDays, supabase, type, userId, zip]);

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
      setSavedMessage(updated.autoApply ? "Auto-open mode enabled." : "Manual apply mode enabled.");
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
  if (favoritesOnly) {
    activeFilters.push({ key: "favorites", label: "Favorites" });
  }
  if (verify) {
    const verifyLabel = VERIFY_OPTIONS.find(o => o.value === verify)?.label || verify;
    activeFilters.push({ key: "verify", label: verifyLabel });
  }
  if (time && time !== "upcoming") {
    const timeLabel = TIME_OPTIONS.find(o => o.value === time)?.label || time;
    activeFilters.push({ key: "time", label: timeLabel });
  }
  if (dateFilter) {
    const displayDate = new Date(`${dateFilter}T12:00:00Z`);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(displayDate);
    activeFilters.push({ key: "date", label: `On ${formattedDate}` });
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
  const isFavoritesActive = favoritesOnly;

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
  if (favoritesOnly) activeFilterSummary.push("Favorites");
  // Phase 1.4: Location summary (ZIP wins over city)
  if (zip) {
    activeFilterSummary.push(`Near ${zip}`);
  } else if (city) {
    activeFilterSummary.push(`Near ${city}`);
  }

  const primaryQuickFilters = [
    { type: "open_mic", label: "Open Mics", icon: MicIcon, isActive: isOpenMicsActive },
    { type: "csc", label: "CSC", icon: Star, isActive: isCscActive },
    { type: "favorites", label: "Favorites", icon: Heart, isActive: isFavoritesActive },
  ] as const;

  const typeQuickFilters = [
    { type: "showcase", label: "Showcases", icon: Star, isActive: isShowcaseActive },
    { type: "gig", label: "Gigs", icon: Music, isActive: isGigActive },
    { type: "workshop", label: "Workshops", icon: BookOpen, isActive: isWorkshopActive },
    { type: "jam_session", label: "Jams", icon: Guitar, isActive: isJamSessionsActive },
    { type: "poetry", label: "Poetry", icon: PenLine, isActive: isPoetryActive },
    { type: "blues", label: "Blues", icon: Guitar, isActive: isBluesActive },
  ] as const;

  const overflowQuickFilters = [
    { type: "irish", label: "Irish", icon: Music, isActive: isIrishActive },
    { type: "bluegrass", label: "Bluegrass", icon: Music, isActive: isBluegrassActive },
    { type: "comedy", label: "Comedy", icon: Laugh, isActive: isComedyActive },
  ] as const;

  const handleQuickFilterClick = (
    filter: (typeof primaryQuickFilters)[number] | (typeof typeQuickFilters)[number] | (typeof overflowQuickFilters)[number]
  ) => {
    if (filter.type === "csc") {
      if (filter.isActive) {
        updateFilter("csc", null);
      } else {
        router.push(buildUrl({ csc: "1", type: null }));
      }
      return;
    }

    if (filter.type === "favorites") {
      updateFilter("favorites", filter.isActive ? null : "1");
      return;
    }

    if (filter.isActive) {
      updateFilter("type", null);
    } else {
      router.push(buildUrl({ type: filter.type, csc: null }));
    }
  };

  const hasExplicitFilterParams = Boolean(
    q ||
      type ||
      csc ||
      verify ||
      location ||
      cost ||
      favoritesOnly ||
      daysParam ||
      city ||
      zip ||
      (radius && radius !== "10") ||
      (time && time !== "upcoming") ||
      dateFilter
  );

  React.useEffect(() => {
    if (hasAttemptedAutoApply.current) return;
    if (!userId || !savedAutoApply) return;
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
    favoritesOnly,
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
          : "Manual apply"
        : "No filters saved yet";
  const savedStatusColor = savedLoading
    ? "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
    : !userId
      ? "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]"
      : hasSavedFilters
        ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
        : "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]";

  const renderQuickFilter = (
    filter: (typeof primaryQuickFilters)[number] | (typeof typeQuickFilters)[number] | (typeof overflowQuickFilters)[number],
    variant: "primary" | "secondary" = "secondary"
  ) => {
    const Icon = filter.icon;

    return (
      <button
        key={filter.type}
        onClick={() => handleQuickFilterClick(filter)}
        className={cn(
          "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/40",
          variant === "primary" ? "sm:min-w-[132px]" : "sm:min-w-[112px]",
          filter.isActive
            ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] shadow-sm"
            : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:border-[var(--color-border-accent)]"
        )}
        aria-pressed={filter.isActive}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span>{filter.label}</span>
      </button>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <input
          type="text"
          placeholder="Search venue, artist, or keyword"
          value={searchInput}
          onChange={handleSearchChange}
          className="h-12 w-full rounded-lg border border-[var(--color-border-input)] bg-[var(--color-bg-input)] px-4 py-3 pl-11 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/20"
        />
        <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        {searchInput && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
            aria-label="Clear search"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(10rem,0.7fr)_minmax(8rem,0.55fr)_minmax(8rem,0.55fr)]">
        <label className="relative">
          <span className="sr-only">City</span>
          <MapPinIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Denver area"
            value={cityInput}
            onChange={handleCityChange}
            disabled={Boolean(zip)}
            className={cn(
              "h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent-primary)] focus:outline-none",
              zip && "cursor-not-allowed opacity-50"
            )}
          />
        </label>

        <label>
          <span className="sr-only">ZIP code</span>
          <input
            type="text"
            placeholder="ZIP code"
            value={zipInput}
            onChange={handleZipChange}
            className="h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
          />
        </label>

        <label>
          <span className="sr-only">Radius</span>
          <select
            value={radius}
            onChange={handleRadiusChange}
            disabled={!city && !zip}
            className={cn(
              "h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none",
              !city && !zip && "cursor-not-allowed opacity-50"
            )}
          >
            {RADIUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="relative">
          <span className="sr-only">When</span>
          <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <select
            value={time}
            onChange={(e) => updateFilter("time", e.target.value === "upcoming" ? null : e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 pl-9 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {zip && city && (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          ZIP code takes precedence over city.
        </p>
      )}

      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-3">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(8rem,0.65fr)_auto_minmax(14rem,1fr)] xl:items-end">
          <div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              <CalendarDays className="h-4 w-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
              Date
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              Jump to a busy night or pick a specific day.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={handleToday}
              disabled={isPastMode}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                activeDateKey === todayKey
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/15 text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]",
                isPastMode && "cursor-not-allowed opacity-50 hover:border-[var(--color-border-default)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              Today
            </button>

            <button
              type="button"
              onClick={handleTomorrow}
              disabled={isPastMode}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                activeDateKey === tomorrowKey
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/15 text-[var(--color-text-primary)]"
                  : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]",
                isPastMode && "cursor-not-allowed opacity-50 hover:border-[var(--color-border-default)] hover:text-[var(--color-text-secondary)]"
              )}
            >
              Tomorrow
            </button>

            {activeDateKey && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="col-span-2 rounded-md border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-tertiary)] transition-colors hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-secondary)] sm:col-auto"
              >
                Clear date
              </button>
            )}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="sr-only" htmlFor="happenings-date-filter">Jump to date</label>
            <input
              id="happenings-date-filter"
              type="date"
              value={pickerDate}
              min={windowStartKey}
              max={windowEndKey}
              onChange={(e) => {
                setPickerDate(e.target.value);
                setDateWarningMessage(null);
              }}
              className="h-10 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-border-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]/30"
            />
            <button
              type="button"
              onClick={handleJumpToDate}
              className="h-10 rounded-lg border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]"
            >
              Apply
            </button>
          </div>
        </div>

        {(activeDateKey || dateWarningMessage) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {activeDateKey && (
              <span className="inline-flex items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-sm text-[var(--color-text-secondary)]">
                Showing {formatDateForPill(activeDateKey)}
              </span>
            )}
            {dateWarningMessage && (
              <p className="text-sm text-amber-400">{dateWarningMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {primaryQuickFilters.map((filter) => renderQuickFilter(filter, "primary"))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {typeQuickFilters.map((filter) => renderQuickFilter(filter))}

          <div className="hidden md:contents">
            {overflowQuickFilters.map((filter) => renderQuickFilter(filter))}
          </div>

          <details className="group relative md:hidden">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)]/40">
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              More
              <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="absolute left-0 z-20 mt-2 min-w-48 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-2 shadow-lg">
              <div className="grid gap-2">
                {overflowQuickFilters.map((filter) => renderQuickFilter(filter))}
              </div>
            </div>
          </details>
        </div>
      </div>

      <section className="rounded-xl border border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/5 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)] xl:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent-primary)]/15 text-[var(--color-text-accent)]">
                <Zap className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Saved setup
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Reuse your favorite discovery filters.
                </p>
              </div>
              <span className={cn("ml-auto rounded-full border px-2.5 py-1 text-sm", savedStatusColor)}>
                {savedStatusLabel}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              Saved setup stores your type, day, cost, favorites, CSC, and location choices. It skips search text and one-off exact dates so return visits stay flexible.
            </p>

            <p className="text-sm text-[var(--color-text-tertiary)]">
              Weekly digest personalization follows the saved setup when one exists.
            </p>
          </div>

          {savedLoading ? (
            <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/60 p-3 text-sm text-[var(--color-text-tertiary)]">
              Checking saved filters...
            </div>
          ) : userId ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.2fr_1fr]">
                <button
                  type="button"
                  onClick={saveCurrentFilters}
                  disabled={savedSaving}
                  className="min-h-10 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/70 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                >
                  Save current
                </button>
                <button
                  type="button"
                  onClick={applySavedFilters}
                  disabled={savedSaving || !hasSavedFilters}
                  className="min-h-10 rounded-lg bg-[var(--color-accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply saved setup
                </button>
                <button
                  type="button"
                  onClick={clearSavedFilters}
                  disabled={savedSaving || !hasSavedFilters}
                  className="min-h-10 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/70 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSavedRecallMode(false)}
                  disabled={savedSaving}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    !savedAutoApply
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/70 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                  aria-pressed={!savedAutoApply}
                >
                  <FilterIcon className="h-4 w-4" aria-hidden="true" />
                  Manual apply
                </button>
                <button
                  type="button"
                  onClick={() => setSavedRecallMode(true)}
                  disabled={savedSaving}
                  className={cn(
                    "flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    savedAutoApply
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/70 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                  aria-pressed={savedAutoApply}
                >
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Auto-open on arrival
                </button>
              </div>

              {savedMessage && (
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{savedMessage}</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)]/60 p-3 text-sm text-[var(--color-text-secondary)]">
              Sign in to save this setup and reuse it later.
            </div>
          )}
        </div>
      </section>

      <details className="group rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              More filters
              {advancedFilterCount > 0 && (
                <span className="ml-1.5 rounded-full bg-[var(--color-accent-primary)] px-2 py-0.5 text-sm text-[var(--color-text-on-accent)]">
                  {advancedFilterCount}
                </span>
              )}
            </span>
            {activeFilterSummary.length > 0 && (
              <span className="hidden sm:inline text-sm text-[var(--color-text-secondary)]">
                {activeFilterSummary.join(" · ")}
              </span>
            )}
          </div>
          <ChevronDownIcon className="h-5 w-5 text-[var(--color-text-secondary)] transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-4 border-t border-[var(--color-border-default)] px-4 pb-4 pt-4">
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Days
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  title={day.full}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Type</label>
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
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Cost</label>
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Format</label>
              <select
                value={location}
                onChange={(e) => updateFilter("location", e.target.value || null)}
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
              >
                {LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Verification</label>
              <select
                value={verify}
                onChange={(e) => updateFilter("verify", e.target.value || null)}
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-primary)] focus:outline-none"
              >
                {VERIFY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(activeFilters.length > 0 || selectedDays.length > 0) && (
            <div className="flex justify-end">
              <button
                onClick={clearAll}
                className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)]"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </details>

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-sm text-[var(--color-text-primary)]"
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
                className="ml-0.5 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]"
                aria-label={`Remove ${filter.label} filter`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default HappeningsFilters;
