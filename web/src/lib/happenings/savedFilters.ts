import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCity, normalizeRadiusMiles, normalizeZip } from "./locationFilter";

export const FILTER_DAY_VALUES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const FILTER_COST_VALUES = ["free", "paid", "unknown"] as const;

const FILTER_TYPE_VALUES = new Set([
  "open_mic",
  "shows",
  "showcase",
  "workshop",
  "song_circle",
  "gig",
  "jam_session",
  "poetry",
  "irish",
  "blues",
  "bluegrass",
  "comedy",
  "other",
]);

export type SavedDayFilter = (typeof FILTER_DAY_VALUES)[number];
export type SavedCostFilter = (typeof FILTER_COST_VALUES)[number];

export interface SavedHappeningsFilters {
  type?: string;
  csc?: boolean;
  days?: SavedDayFilter[];
  cost?: SavedCostFilter;
  city?: string;
  zip?: string;
  radius?: string;
}

export interface SavedHappeningsFiltersRow {
  autoApply: boolean;
  filters: SavedHappeningsFilters;
}

export interface DigestApplicableSavedFilters {
  type?: string;
  days?: SavedDayFilter[];
  cost?: SavedCostFilter;
  city?: string;
  zip?: string;
  radius?: string;
}

function normalizeDays(input: unknown): SavedDayFilter[] | undefined {
  const source = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",")
      : [];

  const normalized = source
    .map((v) => String(v).trim().toLowerCase())
    .filter((v): v is SavedDayFilter =>
      (FILTER_DAY_VALUES as readonly string[]).includes(v)
    );

  if (normalized.length === 0) return undefined;

  return [...new Set(normalized)];
}

export function sanitizeSavedHappeningsFilters(input: unknown): SavedHappeningsFilters {
  const raw = typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};

  const type =
    typeof raw.type === "string" && FILTER_TYPE_VALUES.has(raw.type)
      ? raw.type
      : undefined;

  const csc =
    raw.csc === true || raw.csc === "1" || raw.csc === 1
      ? true
      : undefined;

  const days = normalizeDays(raw.days);

  const cost =
    typeof raw.cost === "string" &&
    (FILTER_COST_VALUES as readonly string[]).includes(raw.cost)
      ? (raw.cost as SavedCostFilter)
      : undefined;

  const normalizedZip = normalizeZip(
    typeof raw.zip === "string" ? raw.zip : undefined
  );

  const normalizedCity = normalizeCity(
    typeof raw.city === "string" ? raw.city : undefined
  );

  const radiusSource =
    typeof raw.radius === "string" || typeof raw.radius === "number"
      ? String(raw.radius)
      : undefined;
  const normalizedRadius = String(normalizeRadiusMiles(radiusSource));

  return {
    ...(type ? { type } : {}),
    ...(csc ? { csc: true } : {}),
    ...(days && days.length > 0 ? { days } : {}),
    ...(cost ? { cost } : {}),
    ...(normalizedZip
      ? { zip: normalizedZip }
      : normalizedCity
        ? { city: normalizedCity }
        : {}),
    ...(normalizedZip || normalizedCity ? { radius: normalizedRadius } : {}),
  };
}

export function hasSavedHappeningsFilters(filters: SavedHappeningsFilters): boolean {
  return Boolean(
    filters.type ||
      filters.csc ||
      (filters.days && filters.days.length > 0) ||
      filters.cost ||
      filters.city ||
      filters.zip
  );
}

export function toDigestApplicableFilters(
  filters: SavedHappeningsFilters
): DigestApplicableSavedFilters {
  return {
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.days && filters.days.length > 0 ? { days: filters.days } : {}),
    ...(filters.cost ? { cost: filters.cost } : {}),
    ...(filters.zip
      ? { zip: filters.zip }
      : filters.city
        ? { city: filters.city }
        : {}),
    ...(filters.zip || filters.city
      ? { radius: filters.radius || "10" }
      : {}),
  };
}

export function hasDigestApplicableFilters(
  filters: DigestApplicableSavedFilters
): boolean {
  return Boolean(
    filters.type ||
      (filters.days && filters.days.length > 0) ||
      filters.cost ||
      filters.city ||
      filters.zip
  );
}

export function savedFiltersToUrlUpdates(
  filters: SavedHappeningsFilters
): Record<string, string | null> {
  return {
    type: filters.type || null,
    csc: filters.csc ? "1" : null,
    days: filters.days && filters.days.length > 0 ? filters.days.join(",") : null,
    cost: filters.cost || null,
    city: filters.zip ? null : filters.city || null,
    zip: filters.zip || null,
    radius:
      filters.zip || filters.city
        ? filters.radius && filters.radius !== "10"
          ? filters.radius
          : null
        : null,
  };
}

interface HappeningsSavedFiltersDbRow {
  auto_apply: boolean;
  filters: unknown;
}

export async function getUserSavedHappeningsFilters(
  supabase: SupabaseClient,
  userId: string
): Promise<SavedHappeningsFiltersRow | null> {
  const { data, error } = await (supabase as any)
    .from("happenings_saved_filters")
    .select("auto_apply, filters")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[savedFilters] Failed to fetch saved filters:", error);
    return null;
  }

  if (!data) return null;

  const row = data as HappeningsSavedFiltersDbRow;
  return {
    autoApply: row.auto_apply === true,
    filters: sanitizeSavedHappeningsFilters(row.filters),
  };
}

export async function getSavedHappeningsFiltersForUsers(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, SavedHappeningsFiltersRow>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await (supabase as any)
    .from("happenings_saved_filters")
    .select("user_id, auto_apply, filters")
    .in("user_id", userIds);

  if (error) {
    console.error("[savedFilters] Failed to fetch batch saved filters:", error);
    return new Map();
  }

  const map = new Map<string, SavedHappeningsFiltersRow>();
  for (const row of data || []) {
    map.set(row.user_id as string, {
      autoApply: row.auto_apply === true,
      filters: sanitizeSavedHappeningsFilters(row.filters),
    });
  }
  return map;
}

export async function upsertUserSavedHappeningsFilters(
  supabase: SupabaseClient,
  userId: string,
  payload: {
    autoApply: boolean;
    filters: SavedHappeningsFilters;
  }
): Promise<SavedHappeningsFiltersRow | null> {
  const sanitized = sanitizeSavedHappeningsFilters(payload.filters);

  const { data, error } = await (supabase as any)
    .from("happenings_saved_filters")
    .upsert(
      {
        user_id: userId,
        auto_apply: payload.autoApply,
        filters: sanitized,
      },
      { onConflict: "user_id" }
    )
    .select("auto_apply, filters")
    .single();

  if (error) {
    console.error("[savedFilters] Failed to upsert saved filters:", error);
    return null;
  }

  return {
    autoApply: data.auto_apply === true,
    filters: sanitizeSavedHappeningsFilters(data.filters),
  };
}

