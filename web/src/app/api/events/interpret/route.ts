import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import {
  buildQualityHints,
  IMAGE_INPUT_LIMITS,
  sanitizeInterpretDraftPayload,
  validateImageInputs,
  validateInterpretMode,
  validateNextAction,
  validateSanitizedDraftPayload,
  type DraftVerificationResult,
  type DraftVerificationPatch,
  type ExtractionMetadata,
  type ImageInput,
  type InterpretEventRequestBody,
  type WebSearchCategoryResult,
  type WebSearchConfidence,
  type WebSearchFactBuckets,
  type WebSearchVerificationResult,
  type WebSearchVerificationSource,
} from "@/lib/events/interpretEventContract";
import {
  appendAiPromptContractAdditions,
  buildAiPromptResponseSchema,
  buildAiPromptUserEnvelope,
  buildOrderedImageReferences,
  decideScopeAmbiguity,
  isAiInterpretScope,
  projectCurrentEventForPrompt,
  type OrderedImageReference,
} from "@/lib/events/aiPromptContract";
import {
  buildVenueSearchCandidates,
  resolveVenue,
  shouldResolveVenue,
  type VenueCatalogEntry,
  type VenueResolutionOutcome,
} from "@/lib/events/venueResolver";
import { normalizeSignupMode } from "@/lib/events/signupModeContract";
import { VALID_EVENT_TYPES, type ValidEventType } from "@/lib/events/eventTypeContract";
// PR 3-wiring: edit-turn telemetry (collab plan §6 PR 3). Emit-only;
// no behavior change. console.info sink drains to Axiom via Vercel.
import {
  buildEditTurnTelemetryEvent,
  emitEditTurnTelemetry,
  hashPriorState,
} from "@/lib/events/editTurnTelemetry";
import {
  getPatchFieldClassification,
  type EnforcementMode,
  type EventsColumn,
  type RiskTier,
} from "@/lib/events/patchFieldRegistry";
import {
  detectsRecurrenceIntent,
  applyRecurrenceHintFromExtractedText,
  applyEventTypeHint,
  applyVenueTypeTitleDefault,
  applyFutureDateGuard,
  applyTimeSemantics,
  reduceClarificationToSingle,
  enforceVenueCustomExclusivity,
  mergeLockedCreateDraft,
  normalizeInterpreterLocationMode,
  normalizeSeriesModeConsistency,
  pruneOptionalBlockingFields,
  pruneSatisfiedBlockingFields,
  shouldSuppressDraftVerifierIssue,
} from "@/lib/events/interpreterPostprocess";

/** Vercel serverless function timeout — vision, drafting, search, and verifier calls need headroom. */
export const maxDuration = 120;

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_INTERPRETER_MODEL = "gpt-5.4-nano";
const DEFAULT_VISION_EXTRACTION_MODEL = "gpt-4.1-mini";
const DEFAULT_DRAFT_VERIFIER_MODEL = "gpt-5.4-nano";
const DEFAULT_WEB_SEARCH_VERIFIER_MODEL = "gpt-5.4-nano";
const ROUTE_SAFETY_MARGIN_MS = 8_000;
const WEB_SEARCH_TIMEOUT_MS = 100_000;
const FAST_VENUE_WEB_SEARCH_TIMEOUT_MS = 50_000;
const VENUE_WEB_SEARCH_TIMEOUT_MS = 40_000;
const EVENT_WEB_SEARCH_TIMEOUT_MS = 50_000;
const OPTIONAL_EVENT_WEB_SEARCH_TIMEOUT_MS = 40_000;
const INTERPRETER_TIMEOUT_MS = 100_000;
const INTERPRETER_MIN_USEFUL_TIMEOUT_MS = 25_000;
const WEB_SEARCH_INTERPRETER_RESERVE_MS = INTERPRETER_MIN_USEFUL_TIMEOUT_MS;
const DRAFT_VERIFIER_TIMEOUT_MS = 8_000;
const GOOGLE_GEOCODING_API_URL = "https://maps.googleapis.com/maps/api/geocode/json";
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Persistent rate-limit policy:
// 30 requests per 15 minutes per authenticated user.
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
  source: "rpc" | "memory_fallback";
}

function checkRateLimitFallback(userId: string): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: new Date(resetAt).toISOString(),
      source: "memory_fallback",
    };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt).toISOString(),
      source: "memory_fallback",
    };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(RATE_LIMIT_MAX - entry.count, 0),
    resetAt: new Date(entry.resetAt).toISOString(),
    source: "memory_fallback",
  };
}

function parseRateLimitResult(value: unknown): { allowed: boolean; remaining: number; resetAt: string | null } | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (typeof obj.allowed !== "boolean") return null;
  if (typeof obj.remaining !== "number") return null;
  const resetAt = obj.reset_at;
  if (resetAt !== null && typeof resetAt !== "string") return null;
  return {
    allowed: obj.allowed,
    remaining: Math.max(0, Math.floor(obj.remaining)),
    resetAt,
  };
}

async function checkRateLimit(supabase: SupabaseServerClient, userId: string): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("consume_events_interpret_rate_limit", {
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_requests: RATE_LIMIT_MAX,
  });

  if (error) {
    console.error("[events/interpret] rate-limit rpc error; using memory fallback", {
      userId,
      message: error.message,
      code: error.code ?? null,
    });
    return checkRateLimitFallback(userId);
  }

  const parsed = parseRateLimitResult(data);
  if (!parsed) {
    console.error("[events/interpret] rate-limit rpc returned malformed payload; using memory fallback", {
      userId,
      data,
    });
    return checkRateLimitFallback(userId);
  }

  return {
    ...parsed,
    source: "rpc",
  };
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function extractResponseText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const output = Array.isArray(data.output) ? data.output : [];
  for (const chunk of output) {
    const chunkObj = parseJsonObject(chunk);
    if (!chunkObj) continue;
    const content = Array.isArray(chunkObj.content) ? chunkObj.content : [];
    for (const part of content) {
      const partObj = parseJsonObject(part);
      if (!partObj) continue;
      if (typeof partObj.text === "string" && partObj.text.trim().length > 0) {
        return partObj.text;
      }
    }
  }

  return null;
}

function parseJsonFromResponseText(outputText: string): unknown | null {
  const trimmed = outputText.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to tolerant extraction below. Some web-search responses have
    // returned fenced JSON or a short prose preface despite the strict schema.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue to brace extraction.
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function extractHostname(value: string): string | null {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isBlockedSearchEngineSource(value: string): boolean {
  const hostname = extractHostname(value);
  return hostname === "bing.com" || !!hostname?.endsWith(".bing.com");
}

function collectWebSearchSources(value: unknown): WebSearchVerificationSource[] {
  const seen = new Set<string>();
  const sources: WebSearchVerificationSource[] = [];

  const visit = (node: unknown) => {
    if (sources.length >= 8) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    const obj = parseJsonObject(node);
    if (!obj) return;

    const url = typeof obj.url === "string" ? obj.url : null;
    if (url && /^https?:\/\//i.test(url) && !isBlockedSearchEngineSource(url) && !seen.has(url)) {
      seen.add(url);
      sources.push({
        url,
        title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim().slice(0, 180) : null,
        domain: extractHostname(url),
      });
    }

    for (const child of Object.values(obj)) visit(child);
  };

  visit(value);
  return sources;
}

function redactEmails(input: string): string {
  return input.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]");
}

function truncate(input: string, max = 2000): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
}

function normalizeHistory(history: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const row = parseJsonObject(entry);
      if (!row) return null;
      const role = row.role;
      const content = row.content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      const trimmed = content.trim();
      if (!trimmed) return null;
      return { role, content: trimmed.slice(0, 500) };
    })
    .filter((row): row is { role: "user" | "assistant"; content: string } => row !== null)
    .slice(-8);
}

function requestsVenueCatalog(mode: string, message: string): boolean {
  if (mode === "create") return true;
  return /\b(venue|location|address|move|moved|switch|relocat|different venue|online|virtual|zoom|livestream)\b/i.test(
    message
  );
}

// ---------------------------------------------------------------------------
// Deterministic location hints (address parsing + Google Maps URL expansion)
// ---------------------------------------------------------------------------

const GOOGLE_MAPS_URL_REGEX =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps\/[^\s]+|maps\.google\.com\/[^\s]+)\b/gi;
const GOOGLE_MAPS_URL_SINGLE_REGEX =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps\/[^\s]+|maps\.google\.com\/[^\s]+)\b/i;
const URL_REGEX = /\bhttps?:\/\/[^\s)]+/gi;
const GOOGLE_MAPS_3D_4D_REGEX = /!3d(-?[0-9]+\.[0-9]+)!4d(-?[0-9]+\.[0-9]+)/;
const GOOGLE_MAPS_AT_REGEX = /@(-?[0-9]+\.[0-9]+),(-?[0-9]+\.[0-9]+)/;

interface ParsedAddressHint {
  street: string;
  city: string;
  state: string;
  zip: string | null;
}

interface GoogleMapsHint {
  source_url: string;
  final_url: string;
  place_name: string | null;
  place_id?: string | null;
  formatted_address?: string | null;
  latitude: number | null;
  longitude: number | null;
  address: ParsedAddressHint | null;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function collectsTimeslotIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): boolean {
  const intentText = [message, ...history.filter((h) => h.role === "user").map((h) => h.content)]
    .join("\n")
    .toLowerCase();
  if (!intentText.trim()) return false;

  const explicitSignals = [
    /\btimeslots?\b/i,
    /\btime\s*slots?\b/i,
    /\bslot\s*duration\b/i,
    /\blineup\b/i,
    /\b\d+\s+(?:performer\s+)?slots?\b/i,
    /\benable\s+(?:performer\s+)?slots?\b/i,
  ];
  return explicitSignals.some((pattern) => pattern.test(intentText));
}

function isGoogleMapsUrl(value: unknown): value is string {
  return typeof value === "string" && GOOGLE_MAPS_URL_SINGLE_REGEX.test(value.trim());
}

function normalizeStateCode(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (normalized === "colorado") return "CO";
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase();
  return input.trim().toUpperCase();
}

function looksLikeNoisyStreetCandidate(street: string): boolean {
  const collapsed = street.replace(/\s+/g, " ").trim();
  if (!collapsed) return true;
  if (collapsed.length > 80) return true;
  return /\b(event by|public|facebook|rsvp|see less|hosted by|anyone on or off)\b/i.test(collapsed);
}

function extractAddressFromText(input: string): ParsedAddressHint | null {
  const streetSuffix =
    "(?:street|st|avenue|ave|road|rd|way|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|parkway|pkwy)";
  const withCommas = new RegExp(
    `\\b(\\d{1,6}\\s+[A-Za-z0-9.'#-]+(?:\\s+[A-Za-z0-9.'#-]+){0,6}\\s+${streetSuffix})\\b\\s*,\\s*([A-Za-z .'-]+?)\\s*,\\s*(?:United States,?\\s*)?(Colorado|[A-Z]{2})\\s*(\\d{5})?`,
    "i"
  );
  const compact = new RegExp(
    `\\b(\\d{1,6}\\s+[A-Za-z0-9.'#-]+(?:\\s+[A-Za-z0-9.'#-]+){0,6}\\s+${streetSuffix})\\b\\s+([A-Za-z .'-]+?)\\s+(Colorado|[A-Z]{2})\\s*(\\d{5})?`,
    "i"
  );
  const coloradoZipOnlyCities = [
    "Denver",
    "Pueblo",
    "Greeley",
    "Lafayette",
    "Lakewood",
    "Broomfield",
    "Aurora",
    "Arvada",
    "Boulder",
    "Colorado Springs",
    "Fort Collins",
    "Golden",
    "Littleton",
    "Longmont",
    "Wheat Ridge",
  ].join("|");
  const coloradoZipOnly = new RegExp(
    `\\b(\\d{1,6}\\s+(?:[NSEW]\\s+)?[A-Za-z0-9.'#-]+(?:\\s+[A-Za-z0-9.'#-]+){0,5})\\s+(${coloradoZipOnlyCities})\\s+(8\\d{4})\\b`,
    "i"
  );
  const coloradoCityOnly = new RegExp(
    `\\b(\\d{1,6}\\s+(?:[NSEW]\\s+)?[A-Za-z0-9.'#-]+(?:\\s+[A-Za-z0-9.'#-]+){0,5}\\s+${streetSuffix})\\b\\s+(${coloradoZipOnlyCities})\\b`,
    "i"
  );

  // Try line-by-line first to avoid spanning noisy flyer/body text.
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let match: RegExpMatchArray | null = null;
  for (const line of lines) {
    // Skip long descriptive lines; address lines are usually compact.
    if (line.split(/\s+/).length > 14) continue;
    match = line.match(withCommas) || line.match(compact);
    if (match) break;
    const coloradoZipMatch = line.match(coloradoZipOnly);
    if (coloradoZipMatch) {
      const street = coloradoZipMatch[1]?.trim();
      const city = coloradoZipMatch[2]?.trim();
      const zip = coloradoZipMatch[3]?.trim() || null;
      if (street && city && !looksLikeNoisyStreetCandidate(street)) {
        return { street, city, state: "CO", zip };
      }
    }
    const coloradoCityMatch = line.match(coloradoCityOnly);
    if (coloradoCityMatch) {
      const street = coloradoCityMatch[1]?.trim();
      const city = coloradoCityMatch[2]?.trim();
      if (street && city && !looksLikeNoisyStreetCandidate(street)) {
        return { street, city, state: "CO", zip: null };
      }
    }
  }
  if (!match) {
    match = input.match(withCommas) || input.match(compact);
  }
  if (!match) {
    const coloradoZipMatch = input.match(coloradoZipOnly);
    if (coloradoZipMatch) {
      const street = coloradoZipMatch[1]?.trim();
      const city = coloradoZipMatch[2]?.trim();
      const zip = coloradoZipMatch[3]?.trim() || null;
      if (street && city && !looksLikeNoisyStreetCandidate(street)) {
        return { street, city, state: "CO", zip };
      }
    }
    const coloradoCityMatch = input.match(coloradoCityOnly);
    if (coloradoCityMatch) {
      const street = coloradoCityMatch[1]?.trim();
      const city = coloradoCityMatch[2]?.trim();
      if (street && city && !looksLikeNoisyStreetCandidate(street)) {
        return { street, city, state: "CO", zip: null };
      }
    }
  }
  if (!match) return null;

  const street = match[1]?.trim();
  const city = match[2]?.trim();
  const state = normalizeStateCode(match[3] ?? "");
  const zip = match[4]?.trim() || null;

  if (street && looksLikeNoisyStreetCandidate(street)) return null;
  if (!street || !city || !state) return null;
  return { street, city, state, zip };
}

function extractGoogleMapsUrls(...sources: string[]): string[] {
  const all = sources.join("\n");
  const matches = all.match(GOOGLE_MAPS_URL_REGEX) || [];
  return [...new Set(matches.map((v) => v.trim()))].slice(0, 1);
}

function parseCoordsFromMapsString(input: string): { latitude: number; longitude: number } | null {
  const from3d4d = input.match(GOOGLE_MAPS_3D_4D_REGEX);
  if (from3d4d) {
    return {
      latitude: Number.parseFloat(from3d4d[1]),
      longitude: Number.parseFloat(from3d4d[2]),
    };
  }

  const fromAt = input.match(GOOGLE_MAPS_AT_REGEX);
  if (fromAt) {
    return {
      latitude: Number.parseFloat(fromAt[1]),
      longitude: Number.parseFloat(fromAt[2]),
    };
  }

  return null;
}

function extractPlaceNameFromMapsUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const placeIndex = parts.findIndex((p) => p === "place");
    if (placeIndex >= 0 && parts[placeIndex + 1]) {
      const decoded = decodeURIComponent(parts[placeIndex + 1]).replace(/\+/g, " ").trim();
      return decoded.length > 0 ? decoded : null;
    }
  } catch {
    // no-op
  }
  return null;
}

async function reverseGeocodeCoords(
  lat: number,
  lng: number,
  apiKey: string
): Promise<ParsedAddressHint | null> {
  try {
    const url = new URL(GOOGLE_GEOCODING_API_URL);
    url.searchParams.append("latlng", `${lat},${lng}`);
    url.searchParams.append("key", apiKey);
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{
        address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
      }>;
    };

    if (data.status !== "OK" || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    const components = data.results[0].address_components || [];
    const byType = (type: string) =>
      components.find((c) => Array.isArray(c.types) && c.types.includes(type));

    const streetNumber = byType("street_number")?.long_name || "";
    const route = byType("route")?.long_name || "";
    const city =
      byType("locality")?.long_name ||
      byType("postal_town")?.long_name ||
      byType("administrative_area_level_2")?.long_name ||
      "";
    const state = byType("administrative_area_level_1")?.short_name || "";
    const zip = byType("postal_code")?.long_name || null;

    const street = [streetNumber, route].filter(Boolean).join(" ").trim();
    if (!street || !city || !state) return null;
    return { street, city, state, zip };
  } catch {
    return null;
  }
}

type GoogleGeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  partial_match?: boolean;
  geometry?: { location?: { lat?: number; lng?: number } };
  address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
};

function parseAddressFromGoogleGeocodeResult(result: GoogleGeocodeResult): ParsedAddressHint | null {
  const components = result.address_components || [];
  const byType = (type: string) =>
    components.find((c) => Array.isArray(c.types) && c.types.includes(type));

  const streetNumber = byType("street_number")?.long_name || "";
  const route = byType("route")?.long_name || "";
  const city =
    byType("locality")?.long_name ||
    byType("postal_town")?.long_name ||
    byType("administrative_area_level_2")?.long_name ||
    "";
  const state = byType("administrative_area_level_1")?.short_name || "";
  const zip = byType("postal_code")?.long_name || null;
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();

  if (!street || !city || !state) return null;
  return { street, city, state, zip };
}

function buildGoogleMapsSearchUrl(query: string, placeId?: string | null): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  if (placeId) {
    url.searchParams.set("query_place_id", placeId);
  }
  return url.toString();
}

function buildGoogleMapsVenueHintQueries(sources: string[]): string[] {
  const combined = sources.join("\n");
  const parsedAddress = extractAddressFromText(combined);
  const venueCandidates = buildVenueSearchCandidates({
    sources,
    maxCandidates: 4,
  }).filter((candidate) => !candidate.trim().startsWith("@"));
  const locationParts = parsedAddress
    ? [parsedAddress.street, parsedAddress.city, parsedAddress.state, parsedAddress.zip].filter(
        (part): part is string => typeof part === "string" && part.trim().length > 0
      )
    : [];

  return uniqueStrings(
    venueCandidates.map((candidate) => [candidate, ...locationParts].join(" ")),
    3
  );
}

async function resolveGoogleMapsVenueQueryHint(input: {
  sources: string[];
  geocodingApiKey: string;
}): Promise<GoogleMapsHint | null> {
  for (const query of buildGoogleMapsVenueHintQueries(input.sources)) {
    try {
      const url = new URL(GOOGLE_GEOCODING_API_URL);
      url.searchParams.append("address", query);
      url.searchParams.append("region", "us");
      url.searchParams.append("components", "country:US");
      url.searchParams.append("key", input.geocodingApiKey);

      const response = await fetch(url.toString());
      if (!response.ok) continue;
      const data = (await response.json()) as {
        status?: string;
        results?: GoogleGeocodeResult[];
      };
      const result = data.status === "OK" && Array.isArray(data.results) ? data.results[0] : null;
      if (!result || result.partial_match) continue;

      const address = parseAddressFromGoogleGeocodeResult(result);
      const mapsUrl = buildGoogleMapsSearchUrl(query, result.place_id ?? null);
      return {
        source_url: mapsUrl,
        final_url: mapsUrl,
        place_name: query.replace(/\s+\d{1,6}\s+.*$/i, "").trim() || null,
        place_id: result.place_id ?? null,
        formatted_address: result.formatted_address ?? null,
        latitude:
          typeof result.geometry?.location?.lat === "number"
            ? result.geometry.location.lat
            : null,
        longitude:
          typeof result.geometry?.location?.lng === "number"
            ? result.geometry.location.lng
            : null,
        address,
      };
    } catch {
      // Try the next candidate; web search remains the fallback.
    }
  }

  return null;
}

async function resolveGoogleMapsHint(input: {
  sources: string[];
  geocodingApiKey: string | null;
  allowTextQuery?: boolean;
}): Promise<GoogleMapsHint | null> {
  const candidates = extractGoogleMapsUrls(...input.sources);
  if (candidates.length === 0) {
    return input.geocodingApiKey && input.allowTextQuery
      ? resolveGoogleMapsVenueQueryHint({
          sources: input.sources,
          geocodingApiKey: input.geocodingApiKey,
        })
      : null;
  }

  const sourceUrl = candidates[0];
  let finalUrl = sourceUrl;

  try {
    const head = await fetch(sourceUrl, { method: "HEAD", redirect: "follow" });
    if (head.url) finalUrl = head.url;
  } catch {
    try {
      const get = await fetch(sourceUrl, { method: "GET", redirect: "follow" });
      if (get.url) finalUrl = get.url;
    } catch {
      // no-op
    }
  }

  const placeName = extractPlaceNameFromMapsUrl(finalUrl) || extractPlaceNameFromMapsUrl(sourceUrl);
  const coords = parseCoordsFromMapsString(finalUrl) || parseCoordsFromMapsString(sourceUrl);
  const addressFromText = extractAddressFromText(input.sources.join("\n"));
  const addressFromCoords =
    coords && input.geocodingApiKey
      ? await reverseGeocodeCoords(coords.latitude, coords.longitude, input.geocodingApiKey)
      : null;

  return {
    source_url: sourceUrl,
    final_url: finalUrl,
    place_name: placeName,
    place_id: null,
    formatted_address: null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    // Prefer deterministic geocoding from map coordinates over noisy free text.
    address: addressFromCoords || addressFromText,
  };
}

function applyLocationHintsToDraft(input: {
  draft: Record<string, unknown>;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
}): { applied: boolean } {
  const { draft, message, conversationHistory, extractedImageText, googleMapsHint } = input;
  const alreadyResolvedVenue = hasNonEmptyString(draft.venue_id);
  const isOnline = draft.location_mode === "online";

  let applied = false;
  const addressHint =
    googleMapsHint?.address ||
    extractAddressFromText(
      [message, ...conversationHistory.map((h) => h.content), extractedImageText || ""].join("\n")
    );

  const mapsUrl =
    googleMapsHint?.final_url && /^https?:\/\//i.test(googleMapsHint.final_url)
      ? googleMapsHint.final_url
      : googleMapsHint?.source_url && /^https?:\/\//i.test(googleMapsHint.source_url)
        ? googleMapsHint.source_url
        : null;
  if (mapsUrl) {
    if (!hasNonEmptyString(draft.google_maps_url)) {
      draft.google_maps_url = mapsUrl;
      applied = true;
    }
    if (!hasNonEmptyString(draft.map_link)) {
      draft.map_link = mapsUrl;
      applied = true;
    }
  }

  if (addressHint?.zip) {
    if (!hasNonEmptyString(draft.zip)) {
      draft.zip = addressHint.zip;
      applied = true;
    }
    if (!alreadyResolvedVenue && !hasNonEmptyString(draft.custom_zip)) {
      draft.custom_zip = addressHint.zip;
      applied = true;
    }
  }

  if (addressHint && alreadyResolvedVenue) {
    if (!hasNonEmptyString(draft.address)) {
      draft.address = addressHint.street;
      applied = true;
    }
    if (!hasNonEmptyString(draft.city)) {
      draft.city = addressHint.city;
      applied = true;
    }
    if (!hasNonEmptyString(draft.state)) {
      draft.state = addressHint.state;
      applied = true;
    }
  }

  if (alreadyResolvedVenue) {
    if (
      (draft.latitude === null || draft.latitude === undefined) &&
      typeof googleMapsHint?.latitude === "number"
    ) {
      draft.latitude = googleMapsHint.latitude;
      applied = true;
    }
    if (
      (draft.longitude === null || draft.longitude === undefined) &&
      typeof googleMapsHint?.longitude === "number"
    ) {
      draft.longitude = googleMapsHint.longitude;
      applied = true;
    }
  }

  if (alreadyResolvedVenue || isOnline) {
    return { applied };
  }

  if (addressHint) {
    if (!hasNonEmptyString(draft.custom_address)) {
      draft.custom_address = addressHint.street;
      applied = true;
    }
    if (!hasNonEmptyString(draft.custom_city)) {
      draft.custom_city = addressHint.city;
      applied = true;
    }
    if (!hasNonEmptyString(draft.custom_state)) {
      draft.custom_state = addressHint.state;
      applied = true;
    }
    if (addressHint.zip && !hasNonEmptyString(draft.custom_zip)) {
      draft.custom_zip = addressHint.zip;
      applied = true;
    }

    if (!hasNonEmptyString(draft.custom_location_name)) {
      const preferredName =
        (hasNonEmptyString(draft.venue_name) ? draft.venue_name.trim() : null) ||
        (googleMapsHint?.place_name && googleMapsHint.place_name.trim().length > 0
          ? googleMapsHint.place_name.trim()
          : null);
      draft.custom_location_name =
        preferredName || `${addressHint.street}, ${addressHint.city}, ${addressHint.state}`;
      applied = true;
    }
  }

  if (!hasNonEmptyString(draft.custom_location_name) && googleMapsHint?.place_name) {
    draft.custom_location_name = googleMapsHint.place_name;
    applied = true;
  }

  if (
    (draft.custom_latitude === null || draft.custom_latitude === undefined) &&
    typeof googleMapsHint?.latitude === "number"
  ) {
    draft.custom_latitude = googleMapsHint.latitude;
    applied = true;
  }
  if (
    (draft.custom_longitude === null || draft.custom_longitude === undefined) &&
    typeof googleMapsHint?.longitude === "number"
  ) {
    draft.custom_longitude = googleMapsHint.longitude;
    applied = true;
  }

  if (hasNonEmptyString(draft.custom_location_name) && !hasNonEmptyString(draft.location_mode)) {
    draft.location_mode = "venue";
    applied = true;
  }

  return { applied };
}

function hardenDraftForCreateEdit(input: {
  mode: "create" | "edit_series" | "edit_occurrence";
  draft: Record<string, unknown>;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  extractionConfidence?: number;
}) {
  const {
    mode,
    draft,
    message,
    conversationHistory,
    extractedImageText,
    extractionConfidence,
  } = input;

  let normalizedLocationIntent: "venue" | "online" | "hybrid" | null = null;
  let hasOnlineUrlAfterNormalization = false;

  if (mode === "create" || mode === "edit_series") {
    const hasOnlineUrl = hasNonEmptyString(draft.online_url);
    const normalizedLocationMode = normalizeInterpreterLocationMode(
      draft.location_mode,
      hasOnlineUrl ? "online" : "venue"
    );
    hasOnlineUrlAfterNormalization = hasOnlineUrl;
    normalizedLocationIntent = normalizedLocationMode;
    draft.location_mode = normalizedLocationMode;
    draft.signup_mode = normalizeSignupMode(draft.signup_mode);
  }

  // Maps links are location hints; do not keep them in external_url.
  if (isGoogleMapsUrl(draft.external_url)) {
    draft.external_url = null;
  }

  // If a canonical venue is resolved, enforce venue mode unless the normalized
  // pre-override intent was hybrid and online_url is still present.
  if (hasNonEmptyString(draft.venue_id)) {
    const shouldPreserveHybridIntent =
      normalizedLocationIntent === "hybrid" && hasOnlineUrlAfterNormalization;
    draft.location_mode = shouldPreserveHybridIntent ? "hybrid" : "venue";
  }

  // Prevent accidental slot-enable unless user explicitly asked for slots.
  if (mode === "create" && draft.has_timeslots === true) {
    const hasExplicitTimeslotIntent = collectsTimeslotIntent(message, conversationHistory);
    if (!hasExplicitTimeslotIntent) {
      draft.has_timeslots = false;
      draft.total_slots = null;
      draft.slot_duration_minutes = null;
      draft.allow_guests = false;
    }
  }

  // If OCR/vision confidently detected recurrence signals (for example
  // "monthly on the 3rd Tuesday"), preserve that intent even when the
  // typed message only includes a single anchor date.
  if (mode === "create") {
    applyRecurrenceHintFromExtractedText({
      draft,
      message,
      history: conversationHistory,
      extractedImageText,
      extractionConfidence,
    });
  }

  // Phase 7B: Prevent accidental recurring series unless user explicitly
  // used recurrence language (every, weekly, biweekly, monthly, etc.).
  if (
    mode === "create" &&
    typeof draft.series_mode === "string" &&
    draft.series_mode !== "single"
  ) {
    if (
      !detectsRecurrenceIntent(
        message,
        conversationHistory,
        extractedImageText,
        extractionConfidence
      )
    ) {
      draft.series_mode = "single";
      draft.recurrence_rule = null;
      draft.day_of_week = null;
      draft.occurrence_count = null;
      draft.max_occurrences = null;
      draft.custom_dates = null;
    }
  }

  // Phase 7D: Time semantics — treat "doors/sign-up at X" + "show starts at Y"
  // as start_time = Y (performance start), keeping signup_time separate.
  if (mode === "create" || mode === "edit_series") {
    applyTimeSemantics(draft, [message, extractedImageText || ""].join("\n"));
  }

  // Phase 10: Deterministic event-type/category hinting.
  // User-typed intent wins over OCR when both are present.
  if (mode === "create" || mode === "edit_series") {
    applyEventTypeHint({
      draft,
      message,
      history: conversationHistory,
      extractedImageText,
    });
  }

  // Phase 7D: Enforce venue/custom location mutual exclusivity.
  enforceVenueCustomExclusivity(draft);
}

function sanitizeDerivedTitle(value: string): string | null {
  const collapsed = value.replace(/\s+/g, " ").trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!collapsed) return null;
  if (collapsed.length < 4 || collapsed.length > 90) return null;
  if (/\b(event by|public|anyone on or off|see less|hosted by)\b/i.test(collapsed)) return null;
  return collapsed;
}

function deriveTitleFromText(input: string): string | null {
  const text = input.replace(/\r/g, "\n");
  const patterns: RegExp[] = [
    /\b(?:rsvp\s+for|join us for|for)\s+([A-Z][A-Za-z0-9 '&:/-]{3,90}?(?:open mic(?: night)?|song circle|showcase|workshop|jam(?: session)?|gig|meetup))/i,
    /\b([A-Z][A-Za-z0-9 '&:/-]{3,90}?(?:open mic(?: night)?|song circle|showcase|workshop|jam(?: session)?|gig|meetup))\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const candidate = sanitizeDerivedTitle(match[1]);
      if (candidate) return candidate;
    }
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.split(/\s+/).length <= 10);

  for (const line of lines) {
    if (/\b(open mic|song circle|showcase|workshop|jam|gig|meetup)\b/i.test(line)) {
      const candidate = sanitizeDerivedTitle(line);
      if (candidate) return candidate;
    }
  }

  // Phase 9B: creative title fallback — first short capitalized line
  // that doesn't look like a URL, time, or date.
  for (const line of lines) {
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 8 &&
      /^[A-Z]/.test(line) &&
      !/(https?:\/\/|\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2})/.test(line)
    ) {
      const candidate = sanitizeDerivedTitle(line);
      if (candidate) return candidate;
    }
  }

  return null;
}

function deriveTitleFromDraftContext(draft: Record<string, unknown>): string | null {
  const eventTypes = Array.isArray(draft.event_type)
    ? draft.event_type.filter((v): v is string => typeof v === "string")
    : [];
  const primaryType = eventTypes[0] ?? null;

  const typeLabelByKey: Record<string, string> = {
    open_mic: "Open Mic Night",
    showcase: "Showcase",
    song_circle: "Song Circle",
    workshop: "Workshop",
    jam_session: "Jam Session",
    gig: "Live Music Event",
    meetup: "Meetup",
    other: "Community Event",
  };

  const baseTitle = primaryType ? typeLabelByKey[primaryType] ?? null : null;
  const venueName = typeof draft.venue_name === "string" ? draft.venue_name.trim() : "";

  if (baseTitle && venueName) {
    return sanitizeDerivedTitle(`${baseTitle} at ${venueName}`);
  }
  if (baseTitle) {
    return sanitizeDerivedTitle(baseTitle);
  }
  return null;
}

function applyCreateTitleFallback(input: {
  draft: Record<string, unknown>;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
}) {
  const { draft, message, conversationHistory, extractedImageText } = input;
  if (hasNonEmptyString(draft.title)) return;

  const userHistory = conversationHistory
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content)
    .join("\n");
  const composite = [message, userHistory, extractedImageText || ""].join("\n");

  const fromText = deriveTitleFromText(composite);
  if (fromText) {
    draft.title = fromText;
    return;
  }

  const fromContext = deriveTitleFromDraftContext(draft);
  if (fromContext) {
    draft.title = fromContext;
  }
}

// ---------------------------------------------------------------------------
// Phase A — Vision extraction
// ---------------------------------------------------------------------------

const VISION_TIMEOUT_MS = 15_000;

const VISION_EXTRACTION_PROMPT = [
  "Extract ALL event details visible in the image(s).",
  "Return a structured plain-text summary with these fields when present:",
  "- Event title / name",
  "- Date(s) (use YYYY-MM-DD when possible)",
  "- Time(s) (use 24h HH:MM when possible)",
  "- Venue / location name",
  "- Address (street, city, state)",
  "- Cost / price / cover charge",
  "- Event type (open mic, concert, jam session, workshop, etc.)",
  "- Description / tagline",
  "- Signup details (URL, method)",
  "- Age policy (all ages, 21+, etc.)",
  "- Any other relevant details",
  "",
  "Be thorough but concise. If a field is not visible, omit it.",
  "If multiple images, combine all information into one summary.",
].join("\n");

interface VisionExtractionResult {
  extractedText: string;
  metadata: ExtractionMetadata;
}

async function extractTextFromImages(
  openAiKey: string,
  images: ImageInput[],
  modelName: string
): Promise<VisionExtractionResult> {
  const contentBlocks: Array<Record<string, unknown>> = [
    { type: "input_text", text: VISION_EXTRACTION_PROMPT },
    ...images.map((img) => ({
      type: "input_image",
      image_url: `data:${img.mime_type};base64,${img.data}`,
    })),
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelName,
        input: [{ role: "user", content: contentBlocks }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[events/interpret] vision extraction upstream error", {
        status: response.status,
        data,
      });
      return {
        extractedText: "",
        metadata: {
          images_processed: images.length,
          confidence: 0,
          extracted_fields: [],
          warnings: [`Vision API returned ${response.status}`],
        },
      };
    }

    const dataObj = parseJsonObject(data);
    const outputText = dataObj ? extractResponseText(dataObj) : null;

    if (!outputText) {
      return {
        extractedText: "",
        metadata: {
          images_processed: images.length,
          confidence: 0,
          extracted_fields: [],
          warnings: ["Vision API returned empty output"],
        },
      };
    }

    // Infer which fields were extracted by checking for common keywords
    const extractedFields: string[] = [];
    const lower = outputText.toLowerCase();
    if (/\btitle\b|\bname\b/.test(lower)) extractedFields.push("title");
    if (/\bdate\b|\b\d{4}-\d{2}-\d{2}\b/.test(lower)) extractedFields.push("date");
    if (/\btime\b|\b\d{1,2}:\d{2}\b/.test(lower)) extractedFields.push("time");
    if (/\bvenue\b|\blocation\b|\baddress\b/.test(lower)) extractedFields.push("venue");
    if (/\bcost\b|\bprice\b|\bfree\b|\bcover\b|\$/.test(lower)) extractedFields.push("cost");
    if (/\btype\b|\bopen mic\b|\bconcert\b|\bjam\b|\bworkshop\b/.test(lower)) extractedFields.push("event_type");

    return {
      extractedText: outputText.trim(),
      metadata: {
        images_processed: images.length,
        confidence: extractedFields.length >= 3 ? 0.8 : extractedFields.length >= 1 ? 0.5 : 0.2,
        extracted_fields: extractedFields,
        warnings: [],
      },
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.error("[events/interpret] vision extraction failed", {
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      extractedText: "",
      metadata: {
        images_processed: images.length,
        confidence: 0,
        extracted_fields: [],
        warnings: [isTimeout ? "Vision extraction timed out" : "Vision extraction failed"],
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Phase A2 — Optional online event verification
// ---------------------------------------------------------------------------

function isEventWebSearchEnabled(): boolean {
  const raw = process.env.OPENAI_EVENT_WEB_SEARCH_ENABLED?.trim().toLowerCase();
  if (!raw) return true;
  return !["0", "false", "off", "disabled", "no"].includes(raw);
}

function hasNonMapsUrl(input: string): boolean {
  const urls = input.match(URL_REGEX) || [];
  return urls.some((url) => !GOOGLE_MAPS_URL_SINGLE_REGEX.test(url));
}

function isExplicitEventWebSearchRequest(input: string): boolean {
  return /\b(search|look up|look this up|verify|confirm|research|source|sources|find online|check online|google|website|facebook|instagram|eventbrite)\b/i.test(
    input
  );
}

function explicitEventWebSearchRequestFromTurn(input: {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}): boolean {
  return isExplicitEventWebSearchRequest(
    [
      input.message,
      ...input.conversationHistory
        .filter((entry) => entry.role === "user")
        .map((entry) => entry.content)
        .slice(-2),
    ].join("\n")
  );
}

interface WebSearchQueryPlan {
  venueQueries: string[];
  eventQueries: string[];
  locationContext: string[];
}

type WebSearchCategoryKind = "venue" | "event";
type WebSearchCategoryPass = "fast_venue" | "full_verifier";

interface WebSearchCategoryAttempt {
  category: WebSearchCategoryKind;
  result: WebSearchVerificationResult | null;
  categoryResult: WebSearchCategoryResult;
  pass: WebSearchCategoryPass;
  timeoutMs: number;
  elapsedMs: number;
  upstreamStatus: number | null;
  error: string | null;
}

const DEFAULT_FACT_BUCKETS: WebSearchFactBuckets = {
  user_provided: [],
  extracted: [],
  inferred: [],
  searched_verified: [],
  conflicts: [],
  true_unknowns: [],
};

function uniqueStrings(values: string[], limit = values.length): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed.slice(0, 160));
    if (result.length >= limit) break;
  }
  return result;
}

function extractLocationContextForSearch(...sources: string[]): string[] {
  const combined = sources.join("\n");
  const context: string[] = [];
  if (/\bbreckenridge\b|\bbreck\b/i.test(combined)) context.push("Breckenridge");
  if (/\bsummit(?:\s+county)?\b/i.test(combined)) context.push("Summit County");
  if (/\bcolorado\b|\bCO\b/.test(combined)) context.push("Colorado");
  return uniqueStrings(context, 4);
}

function detectEventSearchPhrase(...sources: string[]): string | null {
  const combined = sources.join("\n");
  if (/\bopen\s+mic\b/i.test(combined)) return "open mic";
  if (/\bjam\s+session\b|\bjam\b/i.test(combined)) return "jam";
  if (/\bshowcase\b/i.test(combined)) return "showcase";
  if (/\bworkshop\b/i.test(combined)) return "workshop";
  if (/\bconcert\b|\bgig\b|\blive\s+music\b/i.test(combined)) return "live music";
  return null;
}

function buildWebSearchQueryPlan(input: {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
}): WebSearchQueryPlan {
  const sources = [
    input.message,
    ...input.conversationHistory.map((entry) => entry.content),
    input.extractedImageText || "",
  ];
  const explicitVenueNames = [
    typeof input.lockedDraft?.venue_name === "string" ? input.lockedDraft.venue_name : null,
    typeof input.lockedDraft?.custom_location_name === "string" ? input.lockedDraft.custom_location_name : null,
    typeof input.currentEvent?.venue_name === "string" ? input.currentEvent.venue_name : null,
    input.googleMapsHint?.place_name ?? null,
  ];
  const venueCandidates = buildVenueSearchCandidates({
    sources,
    explicitVenueNames,
    maxCandidates: 6,
  });
  const locationContext = extractLocationContextForSearch(...sources);
  const eventPhrase = detectEventSearchPhrase(...sources) ?? "event";
  const primaryVenue =
    venueCandidates.find((candidate) => !candidate.startsWith("@") && /\bbreckenridge\b/i.test(candidate)) ??
    venueCandidates.find((candidate) => !candidate.startsWith("@")) ??
    venueCandidates[0] ??
    null;

  const venueQueries = uniqueStrings(
    [
      ...venueCandidates.slice(0, 3),
      ...(primaryVenue ? [`${primaryVenue} address`] : []),
      ...venueCandidates.slice(3),
    ],
    8
  );
  const eventQueries = primaryVenue ? uniqueStrings([`${primaryVenue} ${eventPhrase}`], 3) : [];

  return { venueQueries, eventQueries, locationContext };
}

function buildFastVenueQueryPlan(queryPlan: WebSearchQueryPlan): WebSearchQueryPlan {
  const prioritizedAddressQueries = queryPlan.venueQueries.filter((query) => /\baddress\b/i.test(query));
  const prioritizedHandleQueries = queryPlan.venueQueries.filter((query) => query.trim().startsWith("@"));
  const prioritizedIdentityQueries = queryPlan.venueQueries.filter(
    (query) => !/\baddress\b/i.test(query) && !query.trim().startsWith("@")
  );
  const strongestIdentity =
    prioritizedIdentityQueries.find((query) => /\bbreckenridge\b/i.test(query)) ??
    prioritizedIdentityQueries[0] ??
    null;
  return {
    ...queryPlan,
    venueQueries: uniqueStrings(
      [
        strongestIdentity,
        ...prioritizedAddressQueries.slice(0, 1),
        ...prioritizedHandleQueries.slice(0, 1),
        ...prioritizedIdentityQueries.filter((query) => query !== strongestIdentity),
      ].filter((query): query is string => typeof query === "string" && query.trim().length > 0),
      3
    ),
    eventQueries: [],
  };
}

function emptySearchCategory(input: {
  status: WebSearchCategoryResult["status"];
  summary: string;
  confidence?: WebSearchConfidence;
  attemptedQueries?: string[];
}): WebSearchCategoryResult {
  return {
    status: input.status,
    summary: input.summary,
    confidence: input.confidence ?? "unknown",
    attempted_queries: input.attemptedQueries ?? [],
    facts: [],
    sources: [],
  };
}

function formatAttemptedQueries(queryPlan?: WebSearchQueryPlan): string | null {
  const attempted = uniqueStrings([...(queryPlan?.venueQueries ?? []), ...(queryPlan?.eventQueries ?? [])], 8);
  if (attempted.length === 0) return null;
  if (attempted.length === 1) return `\`${attempted[0]}\``;
  const quoted = attempted.map((query) => `\`${query}\``);
  return `${quoted.slice(0, -1).join(", ")}, and ${quoted[quoted.length - 1]}`;
}

function buildNoReliableWebSearchResult(summary: string, queryPlan?: WebSearchQueryPlan): WebSearchVerificationResult {
  const attempted = formatAttemptedQueries(queryPlan);
  const resolvedSummary =
    attempted && /timed out|timeout|could not find|no reliable/i.test(summary)
      ? `I tried ${attempted}. ${summary}`
      : summary;
  return {
    status: "no_reliable_sources",
    summary: resolvedSummary,
    facts: [],
    sources: [],
    venue_search: emptySearchCategory({
      status: /timed out|timeout/i.test(summary) ? "timeout" : "not_found",
      summary:
        "No reliable venue/address source was found for the venue candidates before this search ended.",
      attemptedQueries: queryPlan?.venueQueries ?? [],
    }),
    event_search: emptySearchCategory({
      status: /timed out|timeout/i.test(summary) ? "timeout" : "not_found",
      summary: "No reliable public listing was found for this exact event or recurring series.",
      attemptedQueries: queryPlan?.eventQueries ?? [],
    }),
    fact_buckets: {
      ...DEFAULT_FACT_BUCKETS,
      true_unknowns: [
        "reliable venue/address source",
        "exact public event listing",
      ],
    },
    suggested_questions: [
      "Retry search, provide an official page or Maps link, or save a custom location for now?",
    ],
  };
}

function shouldAttemptEventWebSearch(input: {
  mode: string;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  useWebSearch?: boolean;
}): boolean {
  if ((input.mode !== "create" && input.mode !== "edit_series") || !isEventWebSearchEnabled()) return false;

  const combined = [
    input.message,
    ...input.conversationHistory.filter((h) => h.role === "user").map((h) => h.content),
    input.extractedImageText || "",
  ].join("\n");

  if (hasNonMapsUrl(combined)) return true;
  if (isExplicitEventWebSearchRequest(combined)) {
    return true;
  }
  if (
    input.useWebSearch &&
    combined.trim().length >= 8 &&
    /\b(?:venue|location|address|at|maps?|phone|website|zip)\b/i.test(combined)
  ) {
    return true;
  }
  if (input.useWebSearch && combined.trim().length >= 20) {
    return true;
  }
  return false;
}

function buildWebSearchVerificationPrompt(input: {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
  currentDate: string;
  queryPlan: WebSearchQueryPlan;
  searchCategory?: WebSearchCategoryKind;
}) {
  return JSON.stringify(
    {
      task: "verify_public_event_details_for_event_draft",
      search_category: input.searchCategory ?? "venue_and_event",
      current_date: input.currentDate,
      current_timezone: "America/Denver",
      source_message: input.message,
      recent_user_context: input.conversationHistory
        .filter((entry) => entry.role === "user")
        .map((entry) => entry.content)
        .slice(-4),
      extracted_image_text: input.extractedImageText ?? null,
      google_maps_hint: input.googleMapsHint,
      locked_draft: input.lockedDraft ?? null,
      current_event: input.currentEvent ?? null,
      source_preference: {
        default_search: "Google Search and Google Maps first",
        avoid: ["Bing search/result pages"],
        note: "If the upstream web-search backend exposes a choice, use Google Search/Maps. Do not cite Bing search result pages as evidence; cite direct official, venue, organizer, social, ticketing, calendar, or Google Maps sources instead.",
      },
      search_query_plan: {
        venue_queries: input.queryPlan.venueQueries,
        event_queries: input.queryPlan.eventQueries,
        location_context: input.queryPlan.locationContext,
      },
      instructions: [
        "Use web search as concierge research, not only binary event verification.",
        "Default to Google Search and Google Maps for venue/event lookup when the web-search backend gives you a choice. Do not use Bing search result pages as sources.",
        "Separate venue enrichment from exact-event verification. Official venue facts can be useful even when the exact event listing is not found.",
        input.searchCategory === "venue"
          ? "This request is the fast venue-enrichment pass. Focus on venue_queries only and set event_search.status to not_applicable unless an exact-event source appears incidentally."
          : input.searchCategory === "event"
            ? "This request is the exact-event verification pass. Focus on event_queries only and set venue_search.status to not_applicable unless venue facts appear incidentally."
            : "This request may use both venue_queries and event_queries.",
        "If source_message is a short follow-up like 'can you search?', use locked_draft, current_event, recent_user_context, extracted_image_text, and google_maps_hint to build the search query.",
        "Start from search_query_plan. Run venue_queries to verify identity/address/contact/website facts. Run event_queries to look for the exact event or recurring series.",
        "Run multiple targeted search angles when details are incomplete: event title + venue, venue + recurrence phrase, organizer/host + venue, and address + event type.",
        "Prioritize official venue, organizer, ticketing, social, and event-calendar sources. Use general search results only as pointers to those sources.",
        "When a flyer contains an address, search the address and venue name together before giving up.",
        "For venue enrichment, look specifically for venue name, street address, city, state, ZIP, phone, official website URL, Google Maps URL, and coordinates when public sources make those facts clear.",
        "When a flyer contains a recurring phrase, search both the literal phrase and a normalized version, for example 'first and third Thursday open mic Ethos Pueblo'.",
        "Set event_search.status to verified only when at least one source appears to describe the exact same event or exact same recurring event series.",
        "Set venue_search.status to verified when an official venue/source reliably confirms venue identity, address, city/state/ZIP, website, phone, or map facts.",
        "Set top-level status to searched when either event_search.status or venue_search.status is verified. Set no_reliable_sources only when neither category has reliable sourced facts.",
        "If venue_search is verified but event_search is not_found, summarize partial success: venue can be used, exact event remains unverified, and event details should stay limited to source_message/extracted_image_text.",
        "If search finds only a similar venue, similar jam, different city, different date, or unrelated event, put it in conflicts or true_unknowns, not sourced facts.",
        "Classify facts into buckets: user_provided, extracted, inferred, searched_verified, conflicts, and true_unknowns. Include confidence wording in summaries and suggested questions.",
        "Questions should come from inferred medium-confidence facts or true_unknowns only. Do not ask for facts found with high confidence.",
        "Return only facts that are directly supported by sources or clearly present in the supplied source_message/extracted_image_text.",
        "Use source_message/extracted_image_text for flyer/post event facts such as open mic night, recurrence, time, and venue aliases. Do not invent cost, signup link, or direct source link.",
        "Prefer exact event date, start/end time, venue name, address, cost, signup details, age policy, external event URL, and cancellation/status if present.",
        "If sources conflict with the supplied flyer/post, mention the conflict in summary instead of deciding silently.",
        "Do not store or recommend a Google Maps URL as the event external_url. Maps links are location hints only.",
        "Do not create the final event draft. This is only supporting context for another model pass.",
      ],
      required_output_shape: {
        status: "searched | no_reliable_sources",
        summary: "string",
        facts: "string[]",
        sources: [{ url: "string", title: "string|null" }],
        venue_search: {
          status: "verified | not_found | timeout | not_applicable",
          summary: "string",
          confidence: "high | medium | low | unknown",
          attempted_queries: "string[]",
          facts: "string[]",
          sources: [{ url: "string", title: "string|null" }],
        },
        event_search: {
          status: "verified | not_found | timeout | not_applicable",
          summary: "string",
          confidence: "high | medium | low | unknown",
          attempted_queries: "string[]",
          facts: "string[]",
          sources: [{ url: "string", title: "string|null" }],
        },
        fact_buckets: {
          user_provided: "string[]",
          extracted: "string[]",
          inferred: "string[]",
          searched_verified: "string[]",
          conflicts: "string[]",
          true_unknowns: "string[]",
        },
        suggested_questions: "string[]",
      },
    },
    null,
    2
  );
}

function buildFastVenueSearchPrompt(input: {
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
  currentDate: string;
  queryPlan: WebSearchQueryPlan;
}) {
  return JSON.stringify(
    {
      task: "fast_venue_enrichment_for_event_draft",
      current_date: input.currentDate,
      current_timezone: "America/Denver",
      source_message: input.message,
      recent_user_context: input.conversationHistory
        .filter((entry) => entry.role === "user")
        .map((entry) => entry.content)
        .slice(-3),
      extracted_image_text: input.extractedImageText ?? null,
      google_maps_hint: input.googleMapsHint,
      locked_draft: input.lockedDraft ?? null,
      current_event: input.currentEvent ?? null,
      source_preference: {
        default_search: "Google Search and Google Maps first",
        avoid: ["Bing search/result pages"],
        note: "If the upstream web-search backend exposes a choice, use Google Search/Maps. Do not cite Bing search result pages as evidence; cite direct venue, organizer, trusted directory, or Google Maps sources instead.",
      },
      venue_queries: input.queryPlan.venueQueries,
      location_context: input.queryPlan.locationContext,
      instructions: [
        "This is a fast venue-enrichment pass. Only verify venue identity and address/contact facts.",
        "Default to Google Search and Google Maps for venue lookup when the web-search backend gives you a choice. Do not use Bing search result pages as sources.",
        "Run only venue_queries. Do not search for or verify the exact event, recurrence, cost, signup, or event source URL.",
        "Prefer official venue pages, Google/Maps-like business listings, or trusted directory pages that clearly identify the venue.",
        "Return verified only when a source reliably confirms venue identity plus at least one useful location/contact fact such as street address, city/state/ZIP, phone, website, Maps URL, or coordinates.",
        "Keep output tiny. Do not include fact buckets, long summaries, or event analysis.",
        "Do not use a Google Maps URL as an event external_url. Maps links are location hints only.",
        "Return strict JSON only.",
      ],
      required_output_shape: {
        status: "verified | not_found",
        summary: "string",
        confidence: "high | medium | low | unknown",
        attempted_queries: "string[]",
        facts: "string[]",
        sources: [{ url: "string", title: "string|null" }],
      },
    },
    null,
    2
  );
}

function parseWebSearchSource(value: unknown): WebSearchVerificationSource | null {
  const row = parseJsonObject(value);
  if (!row || typeof row.url !== "string" || !/^https?:\/\//i.test(row.url)) return null;
  if (isBlockedSearchEngineSource(row.url)) return null;
  return {
    url: row.url,
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim().slice(0, 180) : null,
    domain: extractHostname(row.url),
  };
}

function parseStringList(value: unknown, maxItems: number, maxLength = 240): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, maxLength))
        .slice(0, maxItems)
    : [];
}

function parseWebSearchCategory(value: unknown): WebSearchCategoryResult | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (
    obj.status !== "verified" &&
    obj.status !== "not_found" &&
    obj.status !== "timeout" &&
    obj.status !== "not_applicable"
  ) {
    return null;
  }
  if (typeof obj.summary !== "string") return null;
  const confidence: WebSearchConfidence =
    obj.confidence === "high" ||
    obj.confidence === "medium" ||
    obj.confidence === "low" ||
    obj.confidence === "unknown"
      ? obj.confidence
      : "unknown";
  const sources = Array.isArray(obj.sources)
    ? obj.sources
        .map(parseWebSearchSource)
        .filter((source): source is WebSearchVerificationSource => source !== null)
        .slice(0, 8)
    : [];

  return {
    status: obj.status,
    summary: obj.summary.trim().slice(0, 500),
    confidence,
    attempted_queries: parseStringList(obj.attempted_queries, 8, 120),
    facts: parseStringList(obj.facts, 12),
    sources,
  };
}

function parseFastVenueSearchCategory(value: unknown, fallbackSources: WebSearchVerificationSource[]): WebSearchCategoryResult | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (obj.status !== "verified" && obj.status !== "not_found") return null;
  if (typeof obj.summary !== "string") return null;
  const confidence: WebSearchConfidence =
    obj.confidence === "high" ||
    obj.confidence === "medium" ||
    obj.confidence === "low" ||
    obj.confidence === "unknown"
      ? obj.confidence
      : "unknown";
  const parsedSources = Array.isArray(obj.sources)
    ? obj.sources
        .map(parseWebSearchSource)
        .filter((source): source is WebSearchVerificationSource => source !== null)
    : [];
  const sources = mergeWebSearchSources(parsedSources, fallbackSources).slice(0, 4);

  return {
    status: obj.status,
    summary: obj.summary.trim().slice(0, 360),
    confidence,
    attempted_queries: parseStringList(obj.attempted_queries, 3, 120),
    facts: parseStringList(obj.facts, 8),
    sources,
  };
}

function parseWebSearchFactBuckets(value: unknown): WebSearchFactBuckets | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  return {
    user_provided: parseStringList(obj.user_provided, 12),
    extracted: parseStringList(obj.extracted, 12),
    inferred: parseStringList(obj.inferred, 12),
    searched_verified: parseStringList(obj.searched_verified, 12),
    conflicts: parseStringList(obj.conflicts, 8),
    true_unknowns: parseStringList(obj.true_unknowns, 12),
  };
}

function hasUsefulVenueSearch(result: WebSearchVerificationResult): boolean {
  return (
    result.venue_search?.status === "verified" &&
    (result.venue_search.sources.length > 0 || result.venue_search.facts.length > 0)
  );
}

function parseWebSearchVerification(value: unknown, fallbackSources: WebSearchVerificationSource[]): WebSearchVerificationResult | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (obj.status !== "searched" && obj.status !== "no_reliable_sources") return null;
  if (typeof obj.summary !== "string") return null;

  const facts = parseStringList(obj.facts, 12);

  const modelSources = Array.isArray(obj.sources)
    ? obj.sources
        .map(parseWebSearchSource)
        .filter((source): source is WebSearchVerificationSource => source !== null)
    : [];
  const venueSearch = parseWebSearchCategory(obj.venue_search);
  const eventSearch = parseWebSearchCategory(obj.event_search);
  const factBuckets = parseWebSearchFactBuckets(obj.fact_buckets);
  const suggestedQuestions = parseStringList(obj.suggested_questions, 4, 180);

  const sourcesByUrl = new Map<string, WebSearchVerificationSource>();
  for (const source of [
    ...modelSources,
    ...(venueSearch?.sources ?? []),
    ...(eventSearch?.sources ?? []),
    ...fallbackSources,
  ]) {
    if (!sourcesByUrl.has(source.url)) sourcesByUrl.set(source.url, source);
  }
  const sources = [...sourcesByUrl.values()].slice(0, 8);

  const result: WebSearchVerificationResult = {
    status: obj.status,
    summary: obj.summary.trim().slice(0, 600),
    facts,
    sources,
  };
  if (venueSearch) result.venue_search = venueSearch;
  if (eventSearch) result.event_search = eventSearch;
  if (factBuckets) result.fact_buckets = factBuckets;
  if (suggestedQuestions.length > 0) result.suggested_questions = suggestedQuestions;
  if (result.status === "no_reliable_sources" && hasUsefulVenueSearch(result)) {
    result.status = "searched";
  }
  return result;
}

function isNonExactEventSearchResult(result: WebSearchVerificationResult): boolean {
  const searchable = [result.summary, ...result.facts].join("\n").toLowerCase();
  return [
    /\bexact (?:event|match|listing|source)\b.*\b(?:not|no)\b/,
    /\b(?:not|no)\b.*\bexact (?:event|match|listing|source)\b/,
    /\b(?:event|listing|source)\b.*\bnot found\b/,
    /\bnot found\b.*\b(?:event|listing|source)\b/,
    /\bno reliable sources?\b/,
    /\bunrelated\b/,
    /\bsimilar\b.*\b(?:event|listing|source)\b/,
  ].some((pattern) => pattern.test(searchable));
}

function supportsReasoningEffort(modelName: string): boolean {
  return /^(?:gpt-5|o[134])\b/i.test(modelName.trim());
}

function getConfiguredReasoningEffort(): "minimal" | "low" | "medium" | "high" {
  const raw = process.env.OPENAI_EVENT_WEB_SEARCH_REASONING_EFFORT?.trim().toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high") return raw;
  return "medium";
}

function getRemainingRouteBudgetMs(startedAt: number): number {
  return Math.max(maxDuration * 1000 - ROUTE_SAFETY_MARGIN_MS - (Date.now() - startedAt), 0);
}

function getBoundedStepTimeoutMs(input: {
  startedAt: number;
  preferredMs: number;
  minimumUsefulMs: number;
}): number {
  const remaining = getRemainingRouteBudgetMs(input.startedAt);
  if (remaining <= input.minimumUsefulMs) return remaining;
  return Math.min(input.preferredMs, remaining);
}

function buildWebSearchResponseTextFormat() {
  return {
    format: {
      type: "json_schema",
      name: "event_web_search_verification",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "status",
          "summary",
          "facts",
          "sources",
          "venue_search",
          "event_search",
          "fact_buckets",
          "suggested_questions",
        ],
        properties: {
          status: { type: "string", enum: ["searched", "no_reliable_sources"] },
          summary: { type: "string" },
          facts: {
            type: "array",
            maxItems: 12,
            items: { type: "string" },
          },
          sources: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["url", "title"],
              properties: {
                url: { type: "string" },
                title: { type: ["string", "null"] },
              },
            },
          },
          venue_search: {
            type: "object",
            additionalProperties: false,
            required: ["status", "summary", "confidence", "attempted_queries", "facts", "sources"],
            properties: {
              status: { type: "string", enum: ["verified", "not_found", "timeout", "not_applicable"] },
              summary: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
              attempted_queries: {
                type: "array",
                maxItems: 8,
                items: { type: "string" },
              },
              facts: {
                type: "array",
                maxItems: 12,
                items: { type: "string" },
              },
              sources: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url", "title"],
                  properties: {
                    url: { type: "string" },
                    title: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          event_search: {
            type: "object",
            additionalProperties: false,
            required: ["status", "summary", "confidence", "attempted_queries", "facts", "sources"],
            properties: {
              status: { type: "string", enum: ["verified", "not_found", "timeout", "not_applicable"] },
              summary: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
              attempted_queries: {
                type: "array",
                maxItems: 8,
                items: { type: "string" },
              },
              facts: {
                type: "array",
                maxItems: 12,
                items: { type: "string" },
              },
              sources: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url", "title"],
                  properties: {
                    url: { type: "string" },
                    title: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          fact_buckets: {
            type: "object",
            additionalProperties: false,
            required: [
              "user_provided",
              "extracted",
              "inferred",
              "searched_verified",
              "conflicts",
              "true_unknowns",
            ],
            properties: {
              user_provided: { type: "array", maxItems: 12, items: { type: "string" } },
              extracted: { type: "array", maxItems: 12, items: { type: "string" } },
              inferred: { type: "array", maxItems: 12, items: { type: "string" } },
              searched_verified: { type: "array", maxItems: 12, items: { type: "string" } },
              conflicts: { type: "array", maxItems: 8, items: { type: "string" } },
              true_unknowns: { type: "array", maxItems: 12, items: { type: "string" } },
            },
          },
          suggested_questions: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
        },
      },
    },
  };
}

function buildFastVenueSearchResponseTextFormat() {
  return {
    format: {
      type: "json_schema",
      name: "fast_venue_search_result",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["status", "summary", "confidence", "attempted_queries", "facts", "sources"],
        properties: {
          status: { type: "string", enum: ["verified", "not_found"] },
          summary: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
          attempted_queries: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
          },
          facts: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          sources: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["url", "title"],
              properties: {
                url: { type: "string" },
                title: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
  };
}

function getWebSearchCategoryQueries(queryPlan: WebSearchQueryPlan, category: WebSearchCategoryKind): string[] {
  return category === "venue" ? queryPlan.venueQueries : queryPlan.eventQueries;
}

function buildCategoryOnlyQueryPlan(queryPlan: WebSearchQueryPlan, category: WebSearchCategoryKind): WebSearchQueryPlan {
  return category === "venue"
    ? { ...queryPlan, eventQueries: [] }
    : { ...queryPlan, venueQueries: [] };
}

function formatCategoryAttemptedQueries(label: string, queries: string[]): string | null {
  const attempted = formatAttemptedQueries({
    venueQueries: queries,
    eventQueries: [],
    locationContext: [],
  });
  return attempted ? `${label} tried ${attempted}.` : null;
}

function mergeWebSearchSources(...sourceLists: Array<ReadonlyArray<WebSearchVerificationSource> | undefined>): WebSearchVerificationSource[] {
  const byUrl = new Map<string, WebSearchVerificationSource>();
  for (const source of sourceLists.flatMap((list) => list ?? [])) {
    if (isBlockedSearchEngineSource(source.url)) continue;
    if (!byUrl.has(source.url)) byUrl.set(source.url, source);
  }
  return [...byUrl.values()].slice(0, 8);
}

function mergeWebSearchFactBuckets(
  buckets: Array<WebSearchFactBuckets | undefined>,
  extras?: Partial<WebSearchFactBuckets>
): WebSearchFactBuckets {
  return {
    user_provided: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.user_provided ?? []),
      ...(extras?.user_provided ?? []),
    ], 12),
    extracted: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.extracted ?? []),
      ...(extras?.extracted ?? []),
    ], 12),
    inferred: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.inferred ?? []),
      ...(extras?.inferred ?? []),
    ], 12),
    searched_verified: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.searched_verified ?? []),
      ...(extras?.searched_verified ?? []),
    ], 12),
    conflicts: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.conflicts ?? []),
      ...(extras?.conflicts ?? []),
    ], 8),
    true_unknowns: uniqueStrings([
      ...buckets.flatMap((bucket) => bucket?.true_unknowns ?? []),
      ...(extras?.true_unknowns ?? []),
    ], 12),
  };
}

function formatParsedAddress(address: ParsedAddressHint | null): string | null {
  if (!address) return null;
  return [address.street, address.city, address.state, address.zip].filter(Boolean).join(", ");
}

function buildGoogleMapsVenueSource(hint: GoogleMapsHint): WebSearchVerificationSource | null {
  const url = hint.final_url || hint.source_url;
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    url,
    title: hint.place_name ? `${hint.place_name} on Google Maps` : "Google Maps venue result",
    domain: "google.com/maps",
  };
}

function buildGoogleMapsVenueFacts(hint: GoogleMapsHint): string[] {
  const address = formatParsedAddress(hint.address) ?? hint.formatted_address ?? null;
  const venueName = hint.place_name ?? "the venue";
  return uniqueStrings(
    [
      address ? `Google Maps confirms ${venueName} at ${address}.` : null,
      typeof hint.latitude === "number" && typeof hint.longitude === "number"
        ? `Google Maps returned coordinates for ${venueName}.`
        : null,
    ].filter((fact): fact is string => fact !== null),
    4
  );
}

function mergeGoogleMapsHintIntoWebSearchVerification(
  verification: WebSearchVerificationResult | null,
  hint: GoogleMapsHint | null
): WebSearchVerificationResult | null {
  if (!hint) return verification;
  const facts = buildGoogleMapsVenueFacts(hint);
  const source = buildGoogleMapsVenueSource(hint);
  if (facts.length === 0 && !source) return verification;

  const base =
    verification ??
    ({
      status: "searched",
      summary: "Google Maps returned venue details.",
      facts: [],
      sources: [],
      venue_search: emptySearchCategory({
        status: "not_applicable",
        summary: "No separate web venue search was run.",
        attemptedQueries: [],
      }),
      event_search: emptySearchCategory({
        status: "not_applicable",
        summary: "No exact-event search was run.",
        attemptedQueries: [],
      }),
      fact_buckets: { ...DEFAULT_FACT_BUCKETS },
      suggested_questions: [],
    } satisfies WebSearchVerificationResult);

  const priorVenue =
    base.venue_search ??
    emptySearchCategory({
      status: "not_applicable",
      summary: "No separate web venue search was run.",
    });
  const venueSearch: WebSearchCategoryResult = {
    ...priorVenue,
    status: "verified",
    confidence: priorVenue.confidence === "high" ? "high" : facts.length > 0 ? "high" : "medium",
    summary:
      priorVenue.status === "verified"
        ? priorVenue.summary
        : "Google Maps returned reusable venue identity/location details.",
    facts: uniqueStrings([...facts, ...priorVenue.facts], 8),
    sources: mergeWebSearchSources(source ? [source] : [], priorVenue.sources),
  };
  const eventSearch =
    base.event_search ??
    emptySearchCategory({
      status: "not_applicable",
      summary: "No exact-event search was run.",
    });
  const eventUseful = isUsefulSearchCategory(eventSearch);
  const factBuckets: WebSearchFactBuckets = {
    ...DEFAULT_FACT_BUCKETS,
    ...(base.fact_buckets ?? {}),
  };
  const trueUnknowns = uniqueStrings(
    [
      ...factBuckets.true_unknowns.filter(
        (unknown) => !/\b(?:venue|address|location)\b/i.test(unknown)
      ),
      ...(eventUseful ? [] : ["exact public event listing", "cost", "signup link", "direct source link"]),
    ],
    12
  );

  return {
    ...base,
    status: "searched",
    summary: buildCombinedWebSearchSummary({
      queryPlan: { venueQueries: [], eventQueries: [], locationContext: [] },
      venueSearch,
      eventSearch,
    }),
    facts: uniqueStrings([...facts, ...base.facts], 12),
    sources: mergeWebSearchSources(source ? [source] : [], base.sources),
    venue_search: venueSearch,
    event_search: eventSearch,
    fact_buckets: mergeWebSearchFactBuckets(
      [
        {
          ...factBuckets,
          true_unknowns: [],
        },
      ],
      {
        searched_verified: facts,
        true_unknowns: trueUnknowns,
      }
    ),
  };
}

function isUsefulSearchCategory(category: WebSearchCategoryResult): boolean {
  return category.status === "verified" && (category.sources.length > 0 || category.facts.length > 0);
}

function selectCategoryResult(input: {
  result: WebSearchVerificationResult | null;
  category: WebSearchCategoryKind;
  queryPlan: WebSearchQueryPlan;
  fallbackSummary: string;
}): WebSearchCategoryResult {
  const selected = input.category === "venue" ? input.result?.venue_search : input.result?.event_search;
  const attemptedQueries = getWebSearchCategoryQueries(input.queryPlan, input.category);
  if (!selected) {
    return emptySearchCategory({
      status: "not_found",
      summary: input.fallbackSummary,
      attemptedQueries,
    });
  }
  return {
    ...selected,
    attempted_queries: selected.attempted_queries.length > 0 ? selected.attempted_queries : attemptedQueries,
  };
}

function buildWebSearchCategoryAttempt(input: {
  category: WebSearchCategoryKind;
  result: WebSearchVerificationResult | null;
  categoryResult: WebSearchCategoryResult;
  pass: WebSearchCategoryPass;
  timeoutMs: number;
  startedAt: number;
  upstreamStatus?: number | null;
  error?: string | null;
}): WebSearchCategoryAttempt {
  return {
    category: input.category,
    result: input.result,
    categoryResult: input.categoryResult,
    pass: input.pass,
    timeoutMs: input.timeoutMs,
    elapsedMs: Date.now() - input.startedAt,
    upstreamStatus: input.upstreamStatus ?? null,
    error: input.error ?? null,
  };
}

function logWebSearchCategoryAttempt(input: {
  traceId: string | null;
  attempt: WebSearchCategoryAttempt;
}): void {
  console.info("[events/interpret] web search category complete", {
    traceId: input.traceId,
    category: input.attempt.category,
    pass: input.attempt.pass,
    status: input.attempt.categoryResult.status,
    timeoutMs: input.attempt.timeoutMs,
    elapsedMs: input.attempt.elapsedMs,
    attemptedQueries: input.attempt.categoryResult.attempted_queries,
    sourceCount: input.attempt.categoryResult.sources.length,
    factCount: input.attempt.categoryResult.facts.length,
    upstreamStatus: input.attempt.upstreamStatus,
    error: input.attempt.error,
  });
}

function finalizeWebSearchCategoryAttempt(input: {
  traceId: string | null;
  attempt: WebSearchCategoryAttempt;
}): WebSearchCategoryAttempt {
  logWebSearchCategoryAttempt(input);
  return input.attempt;
}

function buildSkippedWebSearchCategoryAttempt(input: {
  traceId: string | null;
  category: WebSearchCategoryKind;
  queryPlan: WebSearchQueryPlan;
  pass: WebSearchCategoryPass;
  timeoutMs: number;
  status: WebSearchCategoryResult["status"];
  summary: string;
  error?: string | null;
}): WebSearchCategoryAttempt {
  const startedAt = Date.now();
  return finalizeWebSearchCategoryAttempt({
    traceId: input.traceId,
    attempt: buildWebSearchCategoryAttempt({
      category: input.category,
      result: null,
      categoryResult: emptySearchCategory({
        status: input.status,
        summary: input.summary,
        attemptedQueries: getWebSearchCategoryQueries(input.queryPlan, input.category),
      }),
      pass: input.pass,
      timeoutMs: input.timeoutMs,
      startedAt,
      error: input.error ?? null,
    }),
  });
}

function buildFastVenueSearchResult(categoryResult: WebSearchCategoryResult): WebSearchVerificationResult | null {
  if (categoryResult.status !== "verified") return null;
  return {
    status: "searched",
    summary: categoryResult.summary,
    facts: categoryResult.facts,
    sources: categoryResult.sources,
    venue_search: categoryResult,
    event_search: emptySearchCategory({
      status: "not_applicable",
      summary: "Fast venue search does not verify exact event listings.",
      attemptedQueries: [],
    }),
    fact_buckets: {
      ...DEFAULT_FACT_BUCKETS,
      searched_verified: categoryResult.facts,
      true_unknowns: ["exact public event listing", "cost", "signup link", "direct source link"],
    },
    suggested_questions: [],
  };
}

async function runFastVenueSearchCategory(input: {
  openAiKey: string;
  searchModel: string;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
  currentDate: string;
  traceId: string | null;
  queryPlan: WebSearchQueryPlan;
  timeoutMs: number;
}): Promise<WebSearchCategoryAttempt> {
  const fastQueryPlan = buildFastVenueQueryPlan(input.queryPlan);
  const attemptedQueries = fastQueryPlan.venueQueries;
  const startedAt = Date.now();
  if (attemptedQueries.length === 0) {
    return buildSkippedWebSearchCategoryAttempt({
      traceId: input.traceId,
      category: "venue",
      queryPlan: fastQueryPlan,
      pass: "fast_venue",
      timeoutMs: input.timeoutMs,
      status: "not_applicable",
      summary: "Fast venue search was not applicable because no targeted venue queries were available.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const searchResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.searchModel,
        instructions:
          "You are a fast venue enrichment assistant. Return strict JSON only. Search only for venue identity/address/contact facts.",
        ...(supportsReasoningEffort(input.searchModel)
          ? { reasoning: { effort: "low" } }
          : {}),
        input: buildFastVenueSearchPrompt({
          ...input,
          queryPlan: fastQueryPlan,
        }),
        tools: [
          {
            type: "web_search",
            user_location: {
              type: "approximate",
              country: "US",
              city: "Denver",
              region: "Colorado",
              timezone: "America/Denver",
            },
          },
        ],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: 450,
        text: buildFastVenueSearchResponseTextFormat(),
      }),
    });

    const searchData = await searchResponse.json();
    const fallbackSources = collectWebSearchSources(searchData);
    if (!searchResponse.ok) {
      console.warn("[events/interpret] fast venue search skipped after upstream error", {
        traceId: input.traceId,
        status: searchResponse.status,
        data: searchData,
      });
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: "venue",
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: "Fast venue search returned an upstream error before it could verify reliable venue facts.",
            attemptedQueries,
          }),
          pass: "fast_venue",
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: "upstream_error",
        }),
      });
    }

    const searchObj = parseJsonObject(searchData);
    const outputText = searchObj ? extractResponseText(searchObj) : null;
    const parsed = outputText ? parseJsonFromResponseText(outputText) : null;
    const categoryResult = parsed ? parseFastVenueSearchCategory(parsed, fallbackSources) : null;
    if (!categoryResult) {
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: "venue",
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: outputText
              ? "Fast venue search did not return readable structured venue details."
              : "Fast venue search returned no usable verification text.",
            attemptedQueries,
          }),
          pass: "fast_venue",
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: outputText ? "invalid_result_shape" : "empty_output",
        }),
      });
    }

    const withAttempts: WebSearchCategoryResult = {
      ...categoryResult,
      attempted_queries: categoryResult.attempted_queries.length > 0 ? categoryResult.attempted_queries : attemptedQueries,
    };
    return finalizeWebSearchCategoryAttempt({
      traceId: input.traceId,
      attempt: buildWebSearchCategoryAttempt({
        category: "venue",
        result: buildFastVenueSearchResult(withAttempts),
        categoryResult: withAttempts,
        pass: "fast_venue",
        timeoutMs: input.timeoutMs,
        startedAt,
        upstreamStatus: searchResponse.status,
      }),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.warn("[events/interpret] fast venue search skipped", {
      traceId: input.traceId,
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return finalizeWebSearchCategoryAttempt({
      traceId: input.traceId,
      attempt: buildWebSearchCategoryAttempt({
        category: "venue",
        result: null,
        categoryResult: emptySearchCategory({
          status: isTimeout ? "timeout" : "not_found",
          summary: isTimeout
            ? "Fast venue search timed out before returning reliable venue facts."
            : "Fast venue search failed before it could verify reliable venue facts.",
          attemptedQueries,
        }),
        pass: "fast_venue",
        timeoutMs: input.timeoutMs,
        startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runWebSearchCategory(input: {
  openAiKey: string;
  searchModel: string;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
  currentDate: string;
  traceId: string | null;
  queryPlan: WebSearchQueryPlan;
  category: WebSearchCategoryKind;
  timeoutMs: number;
  pass?: WebSearchCategoryPass;
}): Promise<WebSearchCategoryAttempt> {
  const attemptedQueries = getWebSearchCategoryQueries(input.queryPlan, input.category);
  const label = input.category === "venue" ? "Venue search" : "Exact-event search";
  const pass = input.pass ?? "full_verifier";
  const startedAt = Date.now();
  if (attemptedQueries.length === 0) {
    return finalizeWebSearchCategoryAttempt({
      traceId: input.traceId,
      attempt: buildWebSearchCategoryAttempt({
        category: input.category,
        result: null,
        categoryResult: emptySearchCategory({
          status: "not_applicable",
          summary: `${label} was not applicable because no targeted queries were available.`,
          attemptedQueries,
        }),
        pass,
        timeoutMs: input.timeoutMs,
        startedAt,
      }),
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  const focusedQueryPlan = buildCategoryOnlyQueryPlan(input.queryPlan, input.category);

  try {
    const searchResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.searchModel,
        instructions:
          "You are a careful event research assistant. Return strict JSON only. Search the web when useful and cite sources in the sources array.",
        ...(supportsReasoningEffort(input.searchModel)
          ? { reasoning: { effort: getConfiguredReasoningEffort() } }
          : {}),
        input: buildWebSearchVerificationPrompt({
          ...input,
          queryPlan: focusedQueryPlan,
          searchCategory: input.category,
        }),
        tools: [
          {
            type: "web_search",
            user_location: {
              type: "approximate",
              country: "US",
              city: "Denver",
              region: "Colorado",
              timezone: "America/Denver",
            },
          },
        ],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        max_output_tokens: input.category === "venue" ? 650 : 750,
        text: buildWebSearchResponseTextFormat(),
      }),
    });

    const searchData = await searchResponse.json();
    const fallbackSources = collectWebSearchSources(searchData);

    if (!searchResponse.ok) {
      console.warn("[events/interpret] web search category skipped after upstream error", {
        traceId: input.traceId,
        category: input.category,
        status: searchResponse.status,
        data: searchData,
      });
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: input.category,
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: `${label} returned an upstream error before it could verify reliable sources.`,
            attemptedQueries,
          }),
          pass,
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: "upstream_error",
        }),
      });
    }

    const searchObj = parseJsonObject(searchData);
    const outputText = searchObj ? extractResponseText(searchObj) : null;
    if (!outputText) {
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: input.category,
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: `${label} returned no usable verification text.`,
            attemptedQueries,
          }),
          pass,
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: "empty_output",
        }),
      });
    }

    const parsed = parseJsonFromResponseText(outputText);
    if (!parsed) {
      console.warn("[events/interpret] web search category returned non-json output", {
        traceId: input.traceId,
        category: input.category,
        outputPreview: redactEmails(truncate(outputText, 200)),
      });
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: input.category,
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: `${label} did not return readable structured verification details.`,
            attemptedQueries,
          }),
          pass,
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: "non_json_output",
        }),
      });
    }

    const result = parseWebSearchVerification(parsed, fallbackSources);
    if (!result) {
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: input.category,
          result: null,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: `${label} did not return valid verification details.`,
            attemptedQueries,
          }),
          pass,
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
          error: "invalid_result_shape",
        }),
      });
    }

    if (input.category === "event" && isNonExactEventSearchResult(result) && !hasUsefulVenueSearch(result)) {
      console.info("[events/interpret] web search verification ignored non-exact event result", {
        traceId: input.traceId,
        sourceCount: result.sources.length,
        summary: redactEmails(truncate(result.summary, 200)),
      });
      return finalizeWebSearchCategoryAttempt({
        traceId: input.traceId,
        attempt: buildWebSearchCategoryAttempt({
          category: input.category,
          result,
          categoryResult: emptySearchCategory({
            status: "not_found",
            summary: "Exact-event search found sources, but they did not verify the exact event or recurring series.",
            attemptedQueries,
          }),
          pass,
          timeoutMs: input.timeoutMs,
          startedAt,
          upstreamStatus: searchResponse.status,
        }),
      });
    }

    return finalizeWebSearchCategoryAttempt({
      traceId: input.traceId,
      attempt: buildWebSearchCategoryAttempt({
        category: input.category,
        result,
        categoryResult: selectCategoryResult({
          result,
          category: input.category,
          queryPlan: input.queryPlan,
          fallbackSummary: `${label} ran but did not find reliable sources for this category.`,
        }),
        pass,
        timeoutMs: input.timeoutMs,
        startedAt,
        upstreamStatus: searchResponse.status,
      }),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.warn("[events/interpret] web search category skipped", {
      traceId: input.traceId,
      category: input.category,
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return finalizeWebSearchCategoryAttempt({
      traceId: input.traceId,
      attempt: buildWebSearchCategoryAttempt({
        category: input.category,
        result: null,
        categoryResult: emptySearchCategory({
          status: isTimeout ? "timeout" : "not_found",
          summary: isTimeout
            ? `${label} timed out before returning reliable sources.`
            : `${label} failed before it could verify reliable sources.`,
          attemptedQueries,
        }),
        pass,
        timeoutMs: input.timeoutMs,
        startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildCombinedWebSearchSummary(input: {
  queryPlan: WebSearchQueryPlan;
  venueSearch: WebSearchCategoryResult;
  eventSearch: WebSearchCategoryResult;
}): string {
  const venueUseful = isUsefulSearchCategory(input.venueSearch);
  const eventUseful = isUsefulSearchCategory(input.eventSearch);
  if (venueUseful && eventUseful) {
    return "I found source-backed venue details and a public source for this exact event or recurring series.";
  }
  if (venueUseful) {
    const eventNote =
      input.eventSearch.status === "timeout"
        ? "Exact-event search timed out before finding a public listing"
        : "I did not find a public listing for this exact event";
    return `${eventNote}. Venue enrichment succeeded from source-backed venue facts, so event details should stay limited to the flyer/post or user-provided text.`;
  }
  if (eventUseful) {
    return "I found a public source for this exact event or recurring series, but did not find source-backed reusable venue/address details.";
  }

  const attempted = [
    formatCategoryAttemptedQueries("Venue search", input.queryPlan.venueQueries),
    formatCategoryAttemptedQueries("Exact-event search", input.queryPlan.eventQueries),
  ].filter((entry): entry is string => entry !== null);
  const anyTimeout = input.venueSearch.status === "timeout" || input.eventSearch.status === "timeout";
  const failureSummary = anyTimeout
    ? "Search timed out before returning reliable venue or exact-event sources."
    : "Search did not find reliable venue or exact-event sources.";
  return [...attempted, failureSummary].join(" ");
}

function combineWebSearchCategoryAttempts(input: {
  queryPlan: WebSearchQueryPlan;
  venueAttempt: WebSearchCategoryAttempt;
  eventAttempt: WebSearchCategoryAttempt;
}): WebSearchVerificationResult {
  const venueSearch = input.venueAttempt.categoryResult;
  const eventSearch = input.eventAttempt.categoryResult;
  const venueUseful = isUsefulSearchCategory(venueSearch);
  const eventUseful = isUsefulSearchCategory(eventSearch);
  const resultSources = mergeWebSearchSources(
    input.venueAttempt.result?.sources,
    input.eventAttempt.result?.sources,
    venueSearch.sources,
    eventSearch.sources
  );
  const resultFacts = uniqueStrings(
    [
      ...(input.venueAttempt.result?.facts ?? []),
      ...(input.eventAttempt.result?.facts ?? []),
      ...venueSearch.facts,
      ...eventSearch.facts,
    ],
    12
  );
  const trueUnknowns = [
    ...(venueUseful ? [] : ["reliable venue/address source"]),
    ...(eventUseful ? [] : ["exact public event listing"]),
    ...(eventUseful ? [] : ["cost", "signup link", "direct source link"]),
  ];
  const factBuckets = mergeWebSearchFactBuckets(
    [input.venueAttempt.result?.fact_buckets, input.eventAttempt.result?.fact_buckets],
    {
      searched_verified: [
        ...(venueUseful ? venueSearch.facts : []),
        ...(eventUseful ? eventSearch.facts : []),
      ],
      true_unknowns: trueUnknowns,
    }
  );
  const suggestedQuestions = uniqueStrings(
    [
      ...(input.venueAttempt.result?.suggested_questions ?? []),
      ...(input.eventAttempt.result?.suggested_questions ?? []),
    ],
    4
  );

  return {
    status: venueUseful || eventUseful ? "searched" : "no_reliable_sources",
    summary: buildCombinedWebSearchSummary({
      queryPlan: input.queryPlan,
      venueSearch,
      eventSearch,
    }),
    facts: resultFacts,
    sources: resultSources,
    venue_search: venueSearch,
    event_search: eventSearch,
    fact_buckets: factBuckets,
    suggested_questions: suggestedQuestions,
  };
}

function getSearchTimeoutForRemainingBudget(input: {
  startedAt: number;
  preferredMs: number;
  minimumUsefulMs: number;
}): number {
  const remainingRouteBudgetMs = getRemainingRouteBudgetMs(input.startedAt);
  const availableForSearchMs = Math.max(
    remainingRouteBudgetMs - WEB_SEARCH_INTERPRETER_RESERVE_MS,
    0
  );
  if (availableForSearchMs <= input.minimumUsefulMs) {
    return availableForSearchMs;
  }
  return Math.min(input.preferredMs, availableForSearchMs);
}

function webSearchTimedOutCompletely(value: WebSearchVerificationResult | null): value is WebSearchVerificationResult {
  return (
    value?.venue_search?.status === "timeout" &&
    value.event_search?.status === "timeout"
  );
}

const FALLBACK_WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextWeekdayDateKey(currentDate: string, weekday: string): string | null {
  const weekdayIndex = FALLBACK_WEEKDAY_INDEX[weekday.toLowerCase()];
  if (weekdayIndex === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return null;
  const date = new Date(`${currentDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const daysUntil = (weekdayIndex - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntil);
  return date.toISOString().slice(0, 10);
}

function formatFallbackTime(hourText: string, minuteText: string | undefined, suffix: string | undefined): string | null {
  let hour = Number.parseInt(hourText, 10);
  const minute = minuteText ? Number.parseInt(minuteText, 10) : 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    return null;
  }
  const normalizedSuffix = suffix?.toLowerCase();
  if (normalizedSuffix === "pm" && hour < 12) hour += 12;
  if (normalizedSuffix === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function extractFallbackTimeRange(text: string): { start_time: string; end_time: string | null } | null {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return null;
  const [, startHour, startMinute, startSuffixRaw, endHour, endMinute, endSuffixRaw] = match;
  const endSuffix = endSuffixRaw?.toLowerCase();
  if (!endSuffix) return null;
  const startSuffix = startSuffixRaw?.toLowerCase() ?? endSuffix;
  const start = formatFallbackTime(startHour, startMinute, startSuffix);
  const end = formatFallbackTime(endHour, endMinute, endSuffix);
  return start ? { start_time: start, end_time: end } : null;
}

function fallbackVenueNameFromSearch(value: WebSearchVerificationResult | null): string | null {
  const candidates = value?.venue_search?.attempted_queries ?? [];
  for (const query of candidates) {
    const cleaned = query.replace(/\baddress\b/gi, "").trim();
    if (!cleaned || cleaned.startsWith("@")) continue;
    if (/\bRMU\s+Breckenridge\b/i.test(cleaned)) return "RMU Breckenridge";
    if (/\bRMU\s+Breck\b/i.test(cleaned)) return "RMU Breck";
    return cleaned.slice(0, 80);
  }
  return null;
}

function buildAllSearchTimeoutInterpreterFallback(input: {
  mode: InterpretEventRequestBody["mode"];
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  lockedDraft: Record<string, unknown> | null;
  webSearchVerification: WebSearchVerificationResult | null;
  currentDate: string;
}): Record<string, unknown> {
  const sourceText = [
    input.message,
    ...input.conversationHistory.map((entry) => entry.content),
    input.extractedImageText ?? "",
  ].join("\n");
  const draft: Record<string, unknown> = {
    ...(input.mode === "create" && input.lockedDraft ? input.lockedDraft : {}),
  };
  const venueName = fallbackVenueNameFromSearch(input.webSearchVerification);
  const weekdayMatch = sourceText.match(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/i);
  const timeRange = extractFallbackTimeRange(sourceText);
  const facts: string[] = [];

  if (/\bopen\s*mic\b/i.test(sourceText)) {
    draft.event_type = ["open_mic"];
    facts.push("open mic");
  }
  if (venueName) {
    draft.venue_name = venueName;
    draft.location_mode = "venue";
  }
  if (weekdayMatch) {
    const weekday = weekdayMatch[1].toLowerCase();
    draft.series_mode = "weekly";
    draft.recurrence_rule = "weekly";
    draft.day_of_week = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    const startDate = nextWeekdayDateKey(input.currentDate, weekday);
    if (startDate) draft.start_date = startDate;
    facts.push(`every ${draft.day_of_week}`);
  }
  if (timeRange) {
    draft.start_time = timeRange.start_time;
    if (timeRange.end_time) draft.end_time = timeRange.end_time;
    facts.push("7-9pm time range");
  }
  if (!draft.title) {
    draft.title = venueName && /\bopen\s*mic\b/i.test(sourceText)
      ? `${venueName} - Open Mic`
      : /\bopen\s*mic\b/i.test(sourceText)
        ? "Open Mic"
        : "Draft Event";
  }

  const knownFacts = facts.length > 0 ? ` I kept the source-backed event facts I could read: ${facts.join(", ")}.` : "";
  return {
    next_action: "ask_clarification",
    confidence: 0.42,
    human_summary:
      `Venue search and exact-event search both timed out before returning reliable public sources.${knownFacts} Cost, signup link, and direct source link are still unknown.`,
    clarification_question:
      "I can retry search, or save a custom location for now. To create a reusable venue safely later, send an official page or Maps link.",
    blocking_fields: ["venue_id"],
    scope: weekdayMatch ? "series" : "ambiguous",
    draft_payload: draft,
  };
}

async function verifyEventDetailsWithWebSearch(input: {
  openAiKey: string;
  searchModel: string;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
  googleMapsHint: GoogleMapsHint | null;
  lockedDraft?: Record<string, unknown> | null;
  currentEvent?: Record<string, unknown> | null;
  currentDate: string;
  traceId: string | null;
  returnNoReliableResult: boolean;
  requestStartedAt: number;
}): Promise<WebSearchVerificationResult | null> {
  const queryPlan = buildWebSearchQueryPlan(input);

  let venueAttempt = await runFastVenueSearchCategory({
    ...input,
    queryPlan,
    timeoutMs: getSearchTimeoutForRemainingBudget({
      startedAt: input.requestStartedAt,
      preferredMs: FAST_VENUE_WEB_SEARCH_TIMEOUT_MS,
      minimumUsefulMs: 6_000,
    }),
  });

  if (
    !isUsefulSearchCategory(venueAttempt.categoryResult) &&
    venueAttempt.categoryResult.status !== "timeout"
  ) {
    const fullVenueTimeoutMs = getSearchTimeoutForRemainingBudget({
      startedAt: input.requestStartedAt,
      preferredMs: VENUE_WEB_SEARCH_TIMEOUT_MS,
      minimumUsefulMs: 5_000,
    });
    if (fullVenueTimeoutMs >= 5_000) {
      venueAttempt = await runWebSearchCategory({
        ...input,
        queryPlan,
        category: "venue",
        timeoutMs: fullVenueTimeoutMs,
        pass: "full_verifier",
      });
    }
  }

  const eventTimeoutMs = getSearchTimeoutForRemainingBudget({
    startedAt: input.requestStartedAt,
    preferredMs: isUsefulSearchCategory(venueAttempt.categoryResult)
      ? OPTIONAL_EVENT_WEB_SEARCH_TIMEOUT_MS
      : EVENT_WEB_SEARCH_TIMEOUT_MS,
    minimumUsefulMs: 3_000,
  });
  const eventAttempt = eventTimeoutMs >= 3_000
    ? await runWebSearchCategory({
        ...input,
        queryPlan,
        category: "event",
        timeoutMs: eventTimeoutMs,
        pass: "full_verifier",
      })
    : buildSkippedWebSearchCategoryAttempt({
        traceId: input.traceId,
        category: "event",
        queryPlan,
        pass: "full_verifier",
        timeoutMs: eventTimeoutMs,
        status: "timeout",
        summary: "Exact-event search was skipped because venue enrichment consumed the available search budget.",
        error: "insufficient_remaining_budget",
      });

  const result = combineWebSearchCategoryAttempts({
    queryPlan,
    venueAttempt,
    eventAttempt,
  });
  const anyTimeout =
    result.venue_search?.status === "timeout" || result.event_search?.status === "timeout";

  if (result.status === "searched" || input.returnNoReliableResult || anyTimeout) {
    return result;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

async function readJsonBodyWithSizeLimit<T>(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  // Fast-path reject when Content-Length is present and exceeds limit.
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number.parseInt(contentLength, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Request body exceeds ${maxBytes / 1024 / 1024}MB limit.` },
          { status: 413 }
        ),
      };
    }
  }

  // Robust path for missing/incorrect Content-Length: stream and enforce byte cap.
  if (!request.body) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let rawBody = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // no-op: best effort cancellation
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Request body exceeds ${maxBytes / 1024 / 1024}MB limit.` },
          { status: 413 }
        ),
      };
    }

    rawBody += decoder.decode(value, { stream: true });
  }
  rawBody += decoder.decode();

  try {
    return { ok: true, body: JSON.parse(rawBody) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }
}

function buildSystemPrompt() {
  return [
    "You are an event interpretation service for a host dashboard.",
    "You translate natural language into structured draft payloads only.",
    "Never output prose outside strict JSON.",
    "Rules:",
    "- Ask only blocking clarifications needed for the next server action.",
    "- Work like a strong event-ops assistant, not a form validator. Extract, infer, normalize, and preserve details behind the scenes before asking the host anything.",
    "- Do not ask for information that can be reasonably inferred from the source text, attached flyer, venue catalog, current date, or existing draft context.",
    "- Prefer one well-reasoned draft plus a concise note about assumptions over a pile of questions. Ask a follow-up only when publishing would be materially wrong or risky without the answer.",
    "- If a detail is missing but optional (cost, source URL, end time, capacity, organizer note), leave it blank/null and say it was not stated instead of blocking the user.",
    "- If you need verification, ask one specific human question and explain what you already inferred.",
    "- Do not claim you searched the web or verified online unless an explicit tool result or source text is present in the prompt.",
    "- When web_search_verification is present, use it as supporting evidence by category. You may say the venue was verified online when venue_search.status is verified. You may say the exact event was verified online only when event_search.status is verified.",
    "- If venue_search is verified but event_search is not_found, use the venue facts for the reusable venue record and keep event facts limited to the user's message, flyer/post text, or extracted_image_text. Say the exact public listing was not found.",
    "- If web_search_verification status is no_reliable_sources and the latest user asked you to search, say briefly which venue/event searches were attempted. Do not ask again for a source link or flyer if the user already said they do not know; ask only for a genuinely missing fact.",
    "- If web_search_verification conflicts with the user's flyer/post, preserve the user's supplied details and ask one targeted question only if the conflict would make publishing risky.",
    "- If search did not find an exact same-event match, do not use similar events as facts.",
    "- Separate known facts, extracted facts, inferred facts, searched facts, conflicts, and true unknowns before asking. Ask confirmation for inferred or medium-confidence facts; ask direct questions for true unknowns. Do not ask for facts search found with high confidence.",
    "- Do not append empty conversational tails. When the draft is usable, close with one useful optional-change invitation based on missing non-blocking details.",
    "- RSVP remains default platform behavior; do not disable it.",
    "- Timeslots are optional. Encourage for open_mic, jam_session, workshop when relevant.",
    "- Prefer safe scope when ambiguous: occurrence edits over series-wide edits.",
    "- Use date format YYYY-MM-DD and 24h times HH:MM:SS when possible.",
    "- The current date is provided in the user prompt as current_date in America/Denver. current_date itself is NOT a past date — it is today and is a valid event date. Compare dates by calendar date only, never by time of day.",
    "- Never draft a date strictly before current_date for a new create-mode event unless the user clearly says it already happened, is a recap, or is archival.",
    "- Flyer dates often omit a year. When a month/day from a flyer has no year in the source text: if that month/day in the CURRENT year is current_date or later, use the current year. Only advance to next year when the month/day in the current year is STRICTLY before current_date.",
    "- Do not advance a flyer's month/day past the current year unless the flyer or user message explicitly states a year that is later than the current year.",
    "- If the user says 'tonight', 'tomorrow', 'next', 'upcoming', or 'if this is in the past', resolve that relative date yourself from current_date instead of asking for the year.",
    "- If venue match is uncertain, leave venue_id null and set venue_name to your best guess of the venue the user intended. The server will attempt deterministic resolution.",
    "- For recurring in-person events at a venue that is not in the catalog, set venue_name/custom_location_name plus any address/city/state you can extract. Do not describe it as a one-off custom location; say it can be added as a reusable venue when saved.",
    "- If locked_draft is provided, preserve its confirmed fields unless the user explicitly changes them.",
    "- For generic event names, prefer the public title format 'Venue Name - Type' (for example 'Fellow Traveler - Open Mic' or 'Ethos - Open Mic'). Preserve distinct named events such as Jam&Slam, festivals, concerts, workshops, slams, and branded showcases.",
    "- Always include concrete event details in description (at minimum when/where/type/cost if known).",
    "- Set event_type/category from explicit wording: if user says showcase, use showcase (not open_mic).",
    "- Do not invent facts. Use only the user's message, attached flyer text, provided source notes, venue catalog, and deterministic server hints.",
    "- Treat Google Maps links as location hints only. Never put Google Maps links in external_url.",
    "- If the user provides source URLs, preserve the best non-maps event/venue/organizer URL as external_url when appropriate.",
    "- Do not ask for external_url when no concrete non-maps URL was provided. external_url is optional and can stay null.",
    "- If recurrence is visible in message or flyer text, preserve it as a recurring series instead of silently downgrading to single.",
    "- Recurrence contract: use series_mode single for one date; weekly for every week on one weekday; biweekly for every other week on one weekday; monthly for ordinal monthly patterns like 1st/3rd Wednesday; custom for irregular schedules, multiple weekdays, every N weeks other than 1 or 2, daily/yearly, seasonal, or any pattern the form cannot represent natively.",
    "- For custom recurrence, include custom_dates as concrete YYYY-MM-DD dates in chronological order, starting with start_date. Generate up to 12 upcoming dates from current_date/source details; ask only if the pattern cannot be converted into dates safely.",
    "- Do not output vague series_mode values like recurring. Choose one of single, weekly, biweekly, monthly, or custom.",
    "- Only enable performer slots when explicitly requested with slot/timeslot/lineup language.",
    "- If a flyer separates sign-up/check-in from performances, set signup_time to sign-up/check-in time and start_time to the public performance/show start time. Example: '6:00PM SIGN UP, 6:30PM-9:00PM PERFORMANCES' means signup_time 18:00:00, start_time 18:30:00, end_time 21:00:00.",
    "- For gig events, do not add signup_time or performer slots unless explicitly requested.",
    "- Default timezone to America/Denver unless the source clearly says otherwise.",
    "- Keep human_summary concise, deterministic, friendly, and lightly encouraging. A tiny bit of humor is okay, but never at the expense of clarity or correctness.",
    "- Default to filling the draft instead of waiting for confirmation. The user can inspect and edit the private draft before publishing.",
  ].join("\n");
}

function stripOptionalExternalUrlAskFromSummary(summary: string): string {
  const cleaned = summary
    .replace(
      /\s*(?:Need|Needs|Still need|Missing)\s+[^.?!]*(?:external|source|website|url|link)[^.?!]*[.?!]?/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || summary.trim();
}

function buildOptionalDraftFollowup(draft: Record<string, unknown>): string {
  const missing: string[] = [];

  if (!hasNonEmptyString(draft.cost_label) && draft.is_free !== true) {
    missing.push("cost");
  }
  if (!hasNonEmptyString(draft.signup_url) && draft.signup_mode !== "none") {
    missing.push("signup link");
  }
  if (!hasNonEmptyString(draft.external_url)) {
    missing.push("source link");
  }
  if (!hasNonEmptyString(draft.age_policy)) {
    missing.push("age policy");
  }

  if (missing.length === 0) {
    return "Anything you want to add or change before publishing?";
  }

  return `Anything you want to add or change before publishing? Optional details not stated: ${missing.slice(0, 3).join(", ")}.`;
}

const CATEGORY_TO_EVENT_TYPE: Record<string, string> = {
  music: "gig",
  comedy: "comedy",
  poetry: "poetry",
  variety: "other",
  other: "other",
  "open mic": "open_mic",
  open_mic: "open_mic",
  "jam session": "jam_session",
  jam_session: "jam_session",
  jam: "jam_session",
  blues: "blues",
  irish: "irish",
  bluegrass: "bluegrass",
};

function getDraftEventTypes(draft: Record<string, unknown>): string[] {
  return Array.isArray(draft.event_type)
    ? draft.event_type
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
}

function ensureEventTypeFromDraftSignals(input: {
  draft: Record<string, unknown>;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  extractedImageText?: string;
}): void {
  const currentEventTypes = getDraftEventTypes(input.draft);
  if (currentEventTypes.length > 0) {
    const normalizedCurrent = currentEventTypes
      .map((type) => CATEGORY_TO_EVENT_TYPE[type.toLowerCase()] ?? type)
      .filter((type) => VALID_EVENT_TYPES.has(type as ValidEventType));
    if (normalizedCurrent.length > 0) {
      input.draft.event_type = [...new Set(normalizedCurrent)];
      return;
    }
  }

  applyEventTypeHint({
    draft: input.draft,
    message: input.message,
    history: input.conversationHistory,
    extractedImageText: input.extractedImageText,
  });
  if (getDraftEventTypes(input.draft).length > 0) return;

  const categories = Array.isArray(input.draft.categories)
    ? input.draft.categories
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
    : [];
  const mapped = categories
    .map((category) => CATEGORY_TO_EVENT_TYPE[category])
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.length > 0 &&
        VALID_EVENT_TYPES.has(value as ValidEventType)
    );
  if (mapped.length > 0) {
    input.draft.event_type = [...new Set(mapped)];
    return;
  }

  const hasEnoughDraftShape =
    hasNonEmptyString(input.draft.title) &&
    hasNonEmptyString(input.draft.start_time) &&
    (hasNonEmptyString(input.draft.start_date) || hasNonEmptyString(input.draft.event_date));
  if (hasEnoughDraftShape) {
    input.draft.event_type = ["other"];
  }
}

function buildMissingFieldQuestion(field: string): string {
  switch (field) {
    case "title":
      return "What should I call this happening?";
    case "event_type":
      return "What kind of happening is this? For example: open mic, jam session, workshop, show, poetry, or comedy.";
    case "start_date":
    case "event_date":
      return "What date should this happen next?";
    case "start_time":
      return "What time should people show up or when does it start?";
    case "series_mode":
      return "Is this a one-time event or does it repeat?";
    default:
      return `What should I use for ${field.replace(/_/g, " ")}?`;
  }
}

function buildUserPrompt(input: {
  mode: "create" | "edit_series" | "edit_occurrence";
  message: string;
  dateKey?: string;
  eventId?: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  venueCatalog: VenueCatalogEntry[];
  currentEvent: Record<string, unknown> | null;
  lockedDraft?: Record<string, unknown> | null;
  extractedImageText?: string;
  googleMapsHint?: GoogleMapsHint | null;
  webSearchVerification?: WebSearchVerificationResult | null;
  imageReferences: OrderedImageReference[];
  currentDate: string;
}) {
  // Prompt-contract surface (system prompt + user envelope + scope rules)
  // is owned by web/src/lib/events/aiPromptContract.ts (plan §8.2 lock).
  return buildAiPromptUserEnvelope({
    mode: input.mode,
    message: input.message,
    dateKey: input.dateKey,
    eventId: input.eventId,
    conversationHistory: input.conversationHistory,
    venueCatalog: input.venueCatalog.map((v) => ({ id: v.id, name: v.name })),
    currentEvent: input.currentEvent,
    lockedDraft: input.lockedDraft,
    extractedImageText: input.extractedImageText,
    googleMapsHint: input.googleMapsHint ?? undefined,
    webSearchVerification: input.webSearchVerification ?? undefined,
    imageReferences: input.imageReferences,
    currentDate: input.currentDate,
  });
}

// Compact current-event projection now lives in aiPromptContract.ts so the
// prompt-contract surface owns the field whitelist (plan §5.4 + §8.2 lock).
const pickCurrentEventContext = projectCurrentEventForPrompt;

function buildDraftVerifierPrompt(input: {
  message: string;
  extractedImageText?: string;
  draft: Record<string, unknown>;
  currentDate: string;
  venueResolution: VenueResolutionOutcome | null;
  webSearchVerification?: WebSearchVerificationResult | null;
}) {
  return JSON.stringify(
    {
      task: "verify_event_draft",
      current_date: input.currentDate,
      current_timezone: "America/Denver",
      source_message: input.message,
      extracted_image_text: input.extractedImageText ?? null,
      web_search_verification: input.webSearchVerification ?? null,
      venue_resolution: input.venueResolution
        ? {
            status: input.venueResolution.status,
            ...(input.venueResolution.status === "resolved"
              ? {
                  venue_name: input.venueResolution.venueName,
                  confidence: input.venueResolution.confidence,
                }
              : {}),
            ...(input.venueResolution.status === "ambiguous"
              ? {
                  input_name: input.venueResolution.inputName,
                  candidates: input.venueResolution.candidates.map((c) => c.name),
                }
              : {}),
            ...(input.venueResolution.status === "unresolved"
              ? { input_name: input.venueResolution.inputName }
              : {}),
          }
        : null,
      draft_payload: input.draft,
      verifier_rules: [
        "You are a silent event-ops verifier and draft repair assistant. The user will not see your reasoning unless you find an unfixable high-risk issue.",
        "Check the draft against source_message, extracted_image_text, web_search_verification, current_date, and venue_resolution.",
        "When the fix is clear from the supplied evidence, return a patch instead of asking the user.",
        "Use patches for safe corrections such as title cleanup, event_type/category cleanup, signup_time vs start_time, end_time, recurrence_rule/series_mode, custom venue name/address/city/state, cost, age policy, or description.",
        "Do not set venue_id unless it is already present in draft_payload or venue_resolution explicitly resolved to that id. Prefer venue_name/custom_location fields for new venues.",
        "For recurring in-person events at a named place that is not in the venue catalog, preserve full custom venue details so the save step can promote it to a reusable venue.",
        "Never ask the user how this app stores recurrence, RRULE, start_date, or event_date. The app contract is: start_date/event_date anchors the first occurrence; recurrence_rule describes the recurring pattern.",
        "When a source gives a month/day without a year and the current-year date is current_date or later, do not ask to confirm the year; use the current year or patch to it.",
        "Flag high severity only for contradictions or publish-critical problems that cannot be safely patched: wrong date, past date for a new event, wrong venue, impossible time order, wrong event type, invented facts, or missing required field.",
        "If web_search_verification has sourced facts that conflict with the draft, flag high only when publishing would likely be wrong.",
        "Do not flag optional missing details such as cost, source URL, end time, capacity, or age policy.",
        "Do not ask broad questions. If high severity is needed, provide one concrete question the user can answer quickly.",
        "Prefer pass with patches when the draft can be made reasonable without bothering the user.",
      ],
      patch_contract: {
        description:
          "Return patches as typed field/value records. Use value_kind to select which value field is active. Leave inactive value fields null or empty.",
        allowed_fields: [
          "title",
          "description",
          "event_type",
          "categories",
          "start_date",
          "event_date",
          "day_of_week",
          "start_time",
          "end_time",
          "signup_time",
          "recurrence_rule",
          "series_mode",
          "custom_dates",
          "venue_name",
          "custom_location_name",
          "address",
          "city",
          "state",
          "custom_address",
          "custom_city",
          "custom_state",
          "custom_zip",
          "zip",
          "phone",
          "website_url",
          "google_maps_url",
          "map_link",
          "latitude",
          "longitude",
          "location_mode",
          "is_free",
          "cost_label",
          "age_policy",
          "signup_mode",
          "external_url",
          "has_timeslots",
          "total_slots",
          "slot_duration_minutes",
        ],
      },
    },
    null,
    2
  );
}

const DRAFT_VERIFIER_PATCH_FIELDS = new Set([
  "title",
  "description",
  "event_type",
  "categories",
  "start_date",
  "event_date",
  "day_of_week",
  "start_time",
  "end_time",
  "signup_time",
  "recurrence_rule",
  "series_mode",
  "custom_dates",
  "venue_name",
  "custom_location_name",
  "address",
  "city",
  "state",
  "custom_address",
  "custom_city",
  "custom_state",
  "custom_zip",
  "zip",
  "phone",
  "website_url",
  "google_maps_url",
  "map_link",
  "latitude",
  "longitude",
  "location_mode",
  "is_free",
  "cost_label",
  "age_policy",
  "signup_mode",
  "external_url",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
]);

function parseDraftVerificationPatch(value: unknown): DraftVerificationPatch | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (typeof obj.field !== "string" || !DRAFT_VERIFIER_PATCH_FIELDS.has(obj.field)) return null;
  if (
    obj.value_kind !== "string" &&
    obj.value_kind !== "number" &&
    obj.value_kind !== "boolean" &&
    obj.value_kind !== "string_array" &&
    obj.value_kind !== "null"
  ) {
    return null;
  }
  if (typeof obj.reason !== "string" || obj.reason.trim().length === 0) return null;

  const stringValue =
    typeof obj.string_value === "string" && obj.string_value.trim().length > 0
      ? obj.string_value.trim().slice(0, 2000)
      : null;
  const numberValue = typeof obj.number_value === "number" && Number.isFinite(obj.number_value)
    ? obj.number_value
    : null;
  const booleanValue = typeof obj.boolean_value === "boolean" ? obj.boolean_value : null;
  const stringArrayValue = Array.isArray(obj.string_array_value)
    ? obj.string_array_value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 240))
        .slice(0, 24)
    : [];

  if (obj.value_kind === "string" && stringValue === null) return null;
  if (obj.value_kind === "number" && numberValue === null) return null;
  if (obj.value_kind === "boolean" && booleanValue === null) return null;
  if (obj.value_kind === "string_array" && stringArrayValue.length === 0) return null;

  return {
    field: obj.field,
    value_kind: obj.value_kind,
    string_value: stringValue,
    number_value: numberValue,
    boolean_value: booleanValue,
    string_array_value: stringArrayValue,
    reason: obj.reason.trim().slice(0, 240),
  };
}

function parseDraftVerification(value: unknown): DraftVerificationResult | null {
  const obj = parseJsonObject(value);
  if (!obj) return null;
  if (obj.status !== "pass" && obj.status !== "needs_review") return null;
  if (typeof obj.summary !== "string") return null;
  if (!Array.isArray(obj.issues)) return null;
  const patches = Array.isArray(obj.patches)
    ? obj.patches
        .map(parseDraftVerificationPatch)
        .filter((patch): patch is DraftVerificationPatch => patch !== null)
        .slice(0, 12)
    : [];

  const issues = obj.issues
    .map((issue) => {
      const row = parseJsonObject(issue);
      if (!row) return null;
      if (row.severity !== "low" && row.severity !== "medium" && row.severity !== "high") return null;
      if (typeof row.field !== "string" || typeof row.issue !== "string") return null;
      if (row.question !== null && typeof row.question !== "string") return null;
      return {
        severity: row.severity,
        field: row.field,
        issue: row.issue,
        question: row.question,
      };
    })
    .filter((issue): issue is DraftVerificationResult["issues"][number] => issue !== null);

  return {
    status: obj.status,
    summary: obj.summary.slice(0, 400),
    issues: issues.slice(0, 5),
    patches,
  };
}

function applyDraftVerifierPatches(
  draft: Record<string, unknown>,
  verification: DraftVerificationResult | null
): DraftVerificationPatch[] {
  if (!verification || verification.patches.length === 0) return [];

  const applied: DraftVerificationPatch[] = [];
  for (const patch of verification.patches) {
    let nextValue: unknown;
    if (patch.value_kind === "null") {
      nextValue = null;
    } else if (patch.value_kind === "string") {
      nextValue = patch.string_value;
    } else if (patch.value_kind === "number") {
      nextValue = patch.number_value;
    } else if (patch.value_kind === "boolean") {
      nextValue = patch.boolean_value;
    } else {
      nextValue = patch.string_array_value;
    }

    if (nextValue === undefined) continue;
    draft[patch.field] = nextValue;
    applied.push(patch);
  }

  if (applied.length > 0) {
    if (
      !hasNonEmptyString(draft.venue_id) &&
      hasNonEmptyString(draft.venue_name) &&
      !hasNonEmptyString(draft.custom_location_name)
    ) {
      draft.custom_location_name = draft.venue_name;
    }
    if (hasNonEmptyString(draft.custom_location_name) && !hasNonEmptyString(draft.location_mode)) {
      draft.location_mode = "venue";
    }
  }

  return applied;
}

async function verifyDraftWithCritic(input: {
  openAiKey: string;
  verifierModel: string;
  message: string;
  extractedImageText?: string;
  draft: Record<string, unknown>;
  currentDate: string;
  venueResolution: VenueResolutionOutcome | null;
  webSearchVerification?: WebSearchVerificationResult | null;
  traceId: string | null;
}): Promise<DraftVerificationResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DRAFT_VERIFIER_TIMEOUT_MS);

  try {
    const verifierResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.verifierModel,
        instructions:
          "Return strict JSON only. Be conservative: high severity means the user should not publish without resolving it.",
        input: buildDraftVerifierPrompt(input),
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            name: "draft_verification",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["status", "summary", "issues", "patches"],
              properties: {
                status: { type: "string", enum: ["pass", "needs_review"] },
                summary: { type: "string" },
                issues: {
                  type: "array",
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["severity", "field", "issue", "question"],
                    properties: {
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      field: { type: "string" },
                      issue: { type: "string" },
                      question: { type: ["string", "null"] },
                    },
                  },
                },
                patches: {
                  type: "array",
                  maxItems: 12,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "field",
                      "value_kind",
                      "string_value",
                      "number_value",
                      "boolean_value",
                      "string_array_value",
                      "reason",
                    ],
                    properties: {
                      field: {
                        type: "string",
                        enum: [
                          "title",
                          "description",
                          "event_type",
                          "categories",
                          "start_date",
                          "event_date",
                          "day_of_week",
                          "start_time",
                          "end_time",
                          "signup_time",
                          "recurrence_rule",
                          "series_mode",
                          "custom_dates",
                          "venue_name",
                          "custom_location_name",
                          "address",
                          "city",
                          "state",
                          "custom_address",
                          "custom_city",
                          "custom_state",
                          "custom_zip",
                          "zip",
                          "phone",
                          "website_url",
                          "google_maps_url",
                          "map_link",
                          "latitude",
                          "longitude",
                          "location_mode",
                          "is_free",
                          "cost_label",
                          "age_policy",
                          "signup_mode",
                          "external_url",
                          "has_timeslots",
                          "total_slots",
                          "slot_duration_minutes",
                        ],
                      },
                      value_kind: {
                        type: "string",
                        enum: ["string", "number", "boolean", "string_array", "null"],
                      },
                      string_value: { type: ["string", "null"] },
                      number_value: { type: ["number", "null"] },
                      boolean_value: { type: ["boolean", "null"] },
                      string_array_value: {
                        type: "array",
                        maxItems: 24,
                        items: { type: "string" },
                      },
                      reason: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    const verifierData = await verifierResponse.json();
    if (!verifierResponse.ok) {
      console.warn("[events/interpret] draft verifier upstream error", {
        traceId: input.traceId,
        status: verifierResponse.status,
        data: verifierData,
      });
      return null;
    }

    const verifierObj = parseJsonObject(verifierData);
    const outputText = verifierObj ? extractResponseText(verifierObj) : null;
    if (!outputText) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return null;
    }

    return parseDraftVerification(parsed);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    console.warn("[events/interpret] draft verifier skipped", {
      traceId: input.traceId,
      isTimeout,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  // PR 3 follow-up: stable correlation id shared between the initial
  // edit-turn telemetry emit (below) and any later EditTurnOutcomeEvent
  // posted by the client after the user accepts or rejects this turn.
  // Echoed in the success response as `editTurnId` (no echo on error).
  const editTurnId = crypto.randomUUID();

  if (process.env.ENABLE_NL_EVENTS_INTERPRETER !== "true") {
    return NextResponse.json(
      { error: "Conversational interpreter is disabled in this environment." },
      { status: 503 }
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 503 });
  }

  const model = process.env.OPENAI_EVENT_INTERPRETER_MODEL?.trim() || DEFAULT_INTERPRETER_MODEL;
  const visionModel = process.env.OPENAI_EVENT_VISION_MODEL?.trim() || DEFAULT_VISION_EXTRACTION_MODEL;
  const verifierModel = process.env.OPENAI_EVENT_DRAFT_VERIFIER_MODEL?.trim() || DEFAULT_DRAFT_VERIFIER_MODEL;
  const webSearchModel = process.env.OPENAI_EVENT_WEB_SEARCH_MODEL?.trim() || DEFAULT_WEB_SEARCH_VERIFIER_MODEL;

  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();
  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(supabase, sessionUser.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        rate_limit: {
          limit: RATE_LIMIT_MAX,
          remaining: rateLimit.remaining,
          reset_at: rateLimit.resetAt,
          source: rateLimit.source,
        },
      },
      { status: 429 }
    );
  }

  const parsedBody = await readJsonBodyWithSizeLimit<InterpretEventRequestBody>(
    request,
    IMAGE_INPUT_LIMITS.requestBodyMaxBytes
  );
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.body;

  if (!validateInterpretMode(body?.mode)) {
    return NextResponse.json({ error: "mode must be create | edit_series | edit_occurrence." }, { status: 400 });
  }
  const mode = body.mode;
  const dateKey = typeof body.dateKey === "string" ? body.dateKey : undefined;
  const eventId = typeof body.eventId === "string" ? body.eventId : undefined;
  const conversationHistory = normalizeHistory(body.conversationHistory);
  const lockedDraft =
    mode === "create"
      ? sanitizeInterpretDraftPayload("create", (body as { locked_draft?: unknown }).locked_draft)
      : null;
  const traceId =
    typeof body.trace_id === "string" && body.trace_id.length <= 64
      ? body.trace_id
      : null;
  const useWebSearch = body.use_web_search !== false;
  const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });

  // Validate image inputs (count, mime type, decoded size).
  const imageValidation = validateImageInputs(body.image_inputs);
  if (!imageValidation.ok) {
    return NextResponse.json({ error: imageValidation.error }, { status: imageValidation.status });
  }
  const validatedImages = imageValidation.images;

  // Ordered image references for natural-language image selection
  // (plan §5.5). Caller-supplied; reindexed to a stable 0-based ordering.
  const imageReferences = buildOrderedImageReferences(
    (body as { image_references?: unknown }).image_references,
  );
  const rawMessage = typeof body?.message === "string" ? body.message.trim() : "";
  if (rawMessage.length === 0 && validatedImages.length === 0) {
    return NextResponse.json({ error: "message or image is required." }, { status: 400 });
  }

  const normalizedMessage = (rawMessage || "Please draft this event from the attached image.").slice(0, 3000);

  if ((mode === "edit_series" || mode === "edit_occurrence") && !eventId) {
    return NextResponse.json({ error: "eventId is required for edit modes." }, { status: 400 });
  }
  if (mode === "edit_occurrence" && (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey))) {
    return NextResponse.json({ error: "dateKey is required for edit_occurrence mode (YYYY-MM-DD)." }, { status: 400 });
  }

  let currentEvent: Record<string, unknown> | null = null;
  if (eventId) {
    const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
    console.info("[events/interpret] authz", {
      userId: sessionUser.id,
      traceId,
      mode,
      eventId,
      allowed: canManage,
    });

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("events")
      .select(`
        id, title, event_type, event_date, day_of_week, start_time, end_time, recurrence_rule,
        location_mode, venue_id, venue_name, is_free, cost_label,
        custom_location_name, custom_address, custom_city, custom_state, custom_latitude, custom_longitude, location_notes,
        signup_mode, signup_url, signup_time, has_timeslots, total_slots, slot_duration_minutes,
        is_published, status, cover_image_url
      `)
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    currentEvent = pickCurrentEventContext(eventRow as Record<string, unknown>);
  }

  const shouldSendVenueCatalog = requestsVenueCatalog(mode, normalizedMessage);
  const venueQueryLimit = mode === "create" ? 200 : 80;
  let venueCatalog: VenueCatalogEntry[] = [];

  if (shouldSendVenueCatalog) {
    const { data: venueRows } = await supabase
      .from("venues")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(venueQueryLimit);

    venueCatalog = (venueRows || []).map((v) => ({ id: v.id, name: v.name, slug: v.slug ?? null }));
  } else if (typeof currentEvent?.venue_id === "string" && typeof currentEvent?.venue_name === "string") {
    // Keep context lightweight for non-venue edits by only supplying the current venue.
    venueCatalog = [{ id: currentEvent.venue_id, name: currentEvent.venue_name }];
  }

  // ---------------------------------------------------------------------------
  // Phase A — Vision extraction (only when images are present)
  // ---------------------------------------------------------------------------
  let extractionMetadata: ExtractionMetadata | undefined;
  let extractedImageText: string | undefined;

  if (validatedImages.length > 0) {
    console.info("[events/interpret] starting Phase A vision extraction", {
      userId: sessionUser.id,
      traceId,
      imageCount: validatedImages.length,
      visionModel,
    });

    const extraction = await extractTextFromImages(openAiKey, validatedImages, visionModel);
    extractionMetadata = extraction.metadata;

    if (extraction.extractedText) {
      extractedImageText = extraction.extractedText;
      console.info("[events/interpret] Phase A complete", {
        userId: sessionUser.id,
        traceId,
        extractedFields: extraction.metadata.extracted_fields,
        confidence: extraction.metadata.confidence,
        textLength: extraction.extractedText.length,
      });
    } else {
      console.warn("[events/interpret] Phase A produced no text", {
        userId: sessionUser.id,
        warnings: extraction.metadata.warnings,
      });
    }
  }

  const geocodingApiKey =
    process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
  const googleMapsHint = await resolveGoogleMapsHint({
    sources: [normalizedMessage, ...conversationHistory.map((h) => h.content), extractedImageText || ""],
    geocodingApiKey,
    allowTextQuery: useWebSearch,
  });

  let webSearchVerification: WebSearchVerificationResult | null = null;
  const explicitWebSearchRequest = explicitEventWebSearchRequestFromTurn({
    message: normalizedMessage,
    conversationHistory,
  });
  const shouldUseWebSearch = useWebSearch || explicitWebSearchRequest;
  const webSearchEnabled = isEventWebSearchEnabled();
  if (explicitWebSearchRequest && !webSearchEnabled) {
    webSearchVerification = buildNoReliableWebSearchResult(
      "Search was requested, but online search is disabled for this event assistant right now."
    );
  }
  if (
    webSearchEnabled &&
    shouldAttemptEventWebSearch({
      mode,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
      useWebSearch: shouldUseWebSearch,
    })
  ) {
    console.info("[events/interpret] starting Phase A2 web search verification", {
      userId: sessionUser.id,
      traceId,
      model: webSearchModel,
      hasImages: validatedImages.length > 0,
    });

    webSearchVerification = await verifyEventDetailsWithWebSearch({
      openAiKey,
      searchModel: webSearchModel,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
      googleMapsHint,
      lockedDraft,
      currentEvent,
      currentDate,
      traceId,
      returnNoReliableResult: explicitWebSearchRequest,
      requestStartedAt,
    });

    if (webSearchVerification) {
      console.info("[events/interpret] Phase A2 complete", {
        userId: sessionUser.id,
        traceId,
        sourceCount: webSearchVerification.sources.length,
        factCount: webSearchVerification.facts.length,
        domains: webSearchVerification.sources.map((source) => source.domain).filter(Boolean).slice(0, 5),
      });
    }
  }
  webSearchVerification = mergeGoogleMapsHintIntoWebSearchVerification(webSearchVerification, googleMapsHint);

  // ---------------------------------------------------------------------------
  // Phase B — Structured interpretation
  // ---------------------------------------------------------------------------
  const userPrompt = buildUserPrompt({
    mode,
    message: normalizedMessage,
    dateKey,
    eventId,
    conversationHistory,
    venueCatalog,
    currentEvent,
    lockedDraft,
    extractedImageText,
    googleMapsHint,
    webSearchVerification,
    imageReferences,
    currentDate,
  });

  console.info("[events/interpret] request", {
    userId: sessionUser.id,
    traceId,
    mode,
    eventId: eventId ?? null,
    dateKey: dateKey ?? null,
    model,
    webSearchModel,
    hasWebSearchVerification: !!webSearchVerification,
    hasImages: validatedImages.length > 0,
    hasLockedDraft: !!lockedDraft && Object.keys(lockedDraft).length > 0,
    prompt: redactEmails(truncate(userPrompt, 1200)),
  });

  const interpreterTimeoutMs = getBoundedStepTimeoutMs({
    startedAt: requestStartedAt,
    preferredMs: INTERPRETER_TIMEOUT_MS,
    minimumUsefulMs: INTERPRETER_MIN_USEFUL_TIMEOUT_MS,
  });
  if (interpreterTimeoutMs < INTERPRETER_MIN_USEFUL_TIMEOUT_MS) {
    console.warn("[events/interpret] not enough route budget for interpreter", {
      userId: sessionUser.id,
      traceId,
      interpreterTimeoutMs,
    });
    return NextResponse.json({ error: "Interpreter timeout." }, { status: 504 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), interpreterTimeoutMs);

  let responsePayload: Record<string, unknown>;
  const buildAllSearchTimeoutFallbackForRequest = () =>
    buildAllSearchTimeoutInterpreterFallback({
      mode,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
      lockedDraft,
      webSearchVerification,
      currentDate,
    });

  try {
    const llmResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: appendAiPromptContractAdditions(buildSystemPrompt()),
        input: userPrompt,
        max_output_tokens: 2500,
        text: {
          format: {
            type: "json_schema",
            name: "event_interpretation",
            strict: true,
            schema: buildAiPromptResponseSchema(),
          },
        },
      }),
    });

    const llmData = await llmResponse.json();
    if (!llmResponse.ok) {
      console.error("[events/interpret] upstream error", llmData);
      return NextResponse.json({ error: "Interpreter upstream error." }, { status: 502 });
    }

    const llmDataObj = parseJsonObject(llmData);
    if (!llmDataObj) {
      return NextResponse.json({ error: "Interpreter returned malformed response." }, { status: 502 });
    }

    const outputText = extractResponseText(llmDataObj);
    if (!outputText) {
      return NextResponse.json({ error: "Interpreter returned empty output." }, { status: 502 });
    }

    const parsed = parseJsonFromResponseText(outputText);
    if (!parsed) {
      console.error("[events/interpret] non-json model output", {
        userId: sessionUser.id,
        traceId,
        requestId: request.headers.get("x-vercel-id") ?? null,
        allSearchTimedOut: webSearchTimedOutCompletely(webSearchVerification),
        outputPreview: redactEmails(truncate(outputText, 200)),
      });
      if (webSearchTimedOutCompletely(webSearchVerification)) {
        responsePayload = buildAllSearchTimeoutFallbackForRequest();
        console.warn("[events/interpret] recovered non-json timeout output with deterministic fallback", {
          userId: sessionUser.id,
          traceId,
          venueSearchStatus: webSearchVerification.venue_search?.status,
          eventSearchStatus: webSearchVerification.event_search?.status,
        });
      } else {
        return NextResponse.json({ error: "Interpreter returned non-JSON output." }, { status: 502 });
      }
    } else {
      const parsedObj = parseJsonObject(parsed);
      if (!parsedObj) {
        return NextResponse.json({ error: "Interpreter output is not a JSON object." }, { status: 502 });
      }
      if (webSearchTimedOutCompletely(webSearchVerification)) {
        responsePayload = buildAllSearchTimeoutFallbackForRequest();
        console.warn("[events/interpret] replaced valid all-search-timeout output with deterministic fallback", {
          userId: sessionUser.id,
          traceId,
          modelNextAction: typeof parsedObj.next_action === "string" ? parsedObj.next_action : null,
          venueSearchStatus: webSearchVerification.venue_search?.status,
          eventSearchStatus: webSearchVerification.event_search?.status,
        });
      } else {
        responsePayload = parsedObj;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Interpreter timeout." }, { status: 504 });
    }
    console.error("[events/interpret] parse/call error", error);
    return NextResponse.json({ error: "Interpreter call failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!validateNextAction(responsePayload.next_action)) {
    return NextResponse.json({ error: "Interpreter output missing valid next_action." }, { status: 502 });
  }
  if (typeof responsePayload.confidence !== "number" || responsePayload.confidence < 0 || responsePayload.confidence > 1) {
    return NextResponse.json({ error: "Interpreter output missing valid confidence." }, { status: 502 });
  }
  if (typeof responsePayload.human_summary !== "string" || responsePayload.human_summary.trim().length === 0) {
    return NextResponse.json({ error: "Interpreter output missing human_summary." }, { status: 502 });
  }
  if (responsePayload.clarification_question !== null && typeof responsePayload.clarification_question !== "string") {
    return NextResponse.json({ error: "Interpreter output has invalid clarification_question." }, { status: 502 });
  }
  if (!Array.isArray(responsePayload.blocking_fields) || responsePayload.blocking_fields.some((f) => typeof f !== "string")) {
    return NextResponse.json({ error: "Interpreter output has invalid blocking_fields." }, { status: 502 });
  }
  if (!isAiInterpretScope(responsePayload.scope)) {
    return NextResponse.json(
      { error: "Interpreter output missing valid scope (series | occurrence | ambiguous)." },
      { status: 502 },
    );
  }
  const modelScope = responsePayload.scope;

  const sanitizedDraft = sanitizeInterpretDraftPayload(mode, responsePayload.draft_payload, dateKey);
  const locationHintResult = applyLocationHintsToDraft({
    draft: sanitizedDraft,
    message: normalizedMessage,
    conversationHistory,
    extractedImageText,
    googleMapsHint,
  });

  // ---------------------------------------------------------------------------
  // Phase 5 — Deterministic venue resolution (post-LLM)
  // ---------------------------------------------------------------------------
  let venueResolution: VenueResolutionOutcome | null = null;
  let resolvedNextAction = responsePayload.next_action as string;
  let resolvedBlockingFields = (responsePayload.blocking_fields as string[]).map((f) => f.trim()).filter(Boolean);
  let resolvedClarificationQuestion =
    typeof responsePayload.clarification_question === "string"
      ? responsePayload.clarification_question.trim()
      : null;

  // Plan §5.3: when the model returns scope='ambiguous' on edit modes, the
  // server forces a clarification turn even if a patch is also returned.
  // The decision is captured in scopeDecision so the response can carry
  // both the suppressed-patch flag and the resolved values.
  const scopeDecision = decideScopeAmbiguity({
    mode,
    scope: modelScope,
    modelNextAction: responsePayload.next_action,
    modelClarificationQuestion: resolvedClarificationQuestion,
    modelBlockingFields: resolvedBlockingFields,
  });
  if (scopeDecision.forced) {
    resolvedNextAction = scopeDecision.nextAction;
    resolvedClarificationQuestion = scopeDecision.clarificationQuestion;
    resolvedBlockingFields = scopeDecision.blockingFields;
  }

  if (
    shouldResolveVenue({
      mode,
      hasLocationIntent: shouldSendVenueCatalog,
      draftPayload: sanitizedDraft,
    })
  ) {
    const isCustomLocation =
      typeof sanitizedDraft.custom_location_name === "string" &&
      (sanitizedDraft.custom_location_name as string).trim().length > 0 &&
      !sanitizedDraft.venue_id;

    venueResolution = resolveVenue({
      draftVenueId: sanitizedDraft.venue_id as string | null | undefined,
      draftVenueName: (sanitizedDraft.venue_name as string | null | undefined) ??
        (sanitizedDraft.custom_location_name as string | null | undefined),
      userMessage: normalizedMessage,
      venueCatalog,
      draftLocationMode: sanitizedDraft.location_mode as string | null | undefined,
      draftOnlineUrl: sanitizedDraft.online_url as string | null | undefined,
      isCustomLocation,
    });

    // Apply resolution outcome — only escalate, never downgrade
    if (venueResolution.status === "resolved") {
      sanitizedDraft.venue_id = venueResolution.venueId;
      sanitizedDraft.venue_name = venueResolution.venueName;
      if (!sanitizedDraft.location_mode || sanitizedDraft.location_mode === "online") {
        sanitizedDraft.location_mode = "venue";
      }
    } else if (venueResolution.status === "ambiguous") {
      // Only escalate — if LLM already asked for clarification, don't override
      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        const candidateList = venueResolution.candidates
          .map((c, i) => `${i + 1}. ${c.name}`)
          .join(", ");
        resolvedClarificationQuestion =
          `I found multiple possible venues matching "${venueResolution.inputName}": ${candidateList}. Which one did you mean?`;
      }
      if (!resolvedBlockingFields.includes("venue_id")) {
        resolvedBlockingFields.push("venue_id");
      }
    } else if (venueResolution.status === "unresolved") {
      const needsOnlineUrl =
        sanitizedDraft.location_mode === "online" &&
        !(
          typeof sanitizedDraft.online_url === "string" &&
          sanitizedDraft.online_url.trim().length > 0
        );

      if (resolvedNextAction !== "ask_clarification") {
        resolvedNextAction = "ask_clarification";
        if (needsOnlineUrl) {
          resolvedClarificationQuestion =
            "Please provide the online event URL (Zoom, YouTube, etc.) for this online event.";
        } else {
          const inputHint = venueResolution.inputName
            ? ` matching "${venueResolution.inputName}"`
            : "";
          resolvedClarificationQuestion =
            `I couldn't find a known venue${inputHint}. Could you provide the venue name, or specify if this is an online event?`;
        }
      }
      const blockingField = needsOnlineUrl ? "online_url" : "venue_id";
      if (!resolvedBlockingFields.includes(blockingField)) {
        resolvedBlockingFields.push(blockingField);
      }
    }
    // online_explicit / custom_location → no changes needed
  }

  // Phase 9B: Reverse venue/custom exclusivity.
  // If venue resolution did NOT resolve to a known venue (custom_location, unresolved,
  // online_explicit, or skipped) AND draft has both venue_id (stale from locked_draft)
  // and custom_location_name (fresh from current LLM output), clear stale venue_id
  // so hardenDraftForCreateEdit doesn't wrongly force venue mode.
  // Note: by this point, the if/else chain above has already handled resolved/ambiguous/
  // unresolved, so remaining venueResolution statuses are online_explicit / custom_location.
  // The !venueResolution case covers when resolver was not called at all.
  const venueWasResolved = venueResolution?.status === "resolved";
  if (
    !venueWasResolved &&
    hasNonEmptyString(sanitizedDraft.custom_location_name) &&
    hasNonEmptyString(sanitizedDraft.venue_id)
  ) {
    sanitizedDraft.venue_id = null;
    sanitizedDraft.venue_name = null;
  }

  // If custom location details are now present, remove redundant location blockers.
  if (hasNonEmptyString(sanitizedDraft.custom_location_name)) {
    const redundant = new Set([
      "venue_id",
      "venue_name",
      "venue_name_confirmation",
      "venue_id/venue_name_confirmation",
      "custom_address",
      "custom_city",
      "custom_state",
      "custom_zip",
    ]);
    const filtered = resolvedBlockingFields.filter((f) => !redundant.has(f));
    resolvedBlockingFields = [...new Set(filtered)];
  }

  hardenDraftForCreateEdit({
    mode,
    draft: sanitizedDraft,
    message: normalizedMessage,
    conversationHistory,
    extractedImageText,
    extractionConfidence: extractionMetadata?.confidence,
  });

  if (mode === "create") {
    mergeLockedCreateDraft({
      draft: sanitizedDraft,
      lockedDraft,
      message: normalizedMessage,
      conversationHistory,
    });

    // Re-apply event-type hint after locked draft merge so explicit user intent
    // can override stale carried-forward event_type values.
    applyEventTypeHint({
      draft: sanitizedDraft,
      message: normalizedMessage,
      history: conversationHistory,
      extractedImageText,
    });

    const hasOnlineUrl = hasNonEmptyString(sanitizedDraft.online_url);
    const locationFallback = hasOnlineUrl ? "online" : "venue";
    sanitizedDraft.location_mode = normalizeInterpreterLocationMode(
      sanitizedDraft.location_mode,
      locationFallback
    );

    applyCreateTitleFallback({
      draft: sanitizedDraft,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
    });
    applyVenueTypeTitleDefault(sanitizedDraft);
  }

  if (mode === "create" || mode === "edit_series") {
    ensureEventTypeFromDraftSignals({
      draft: sanitizedDraft,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
    });
  }

  const futureDateGuardResult =
    mode === "create"
      ? applyFutureDateGuard({
          draft: sanitizedDraft,
          message: normalizedMessage,
          history: conversationHistory,
          extractedImageText,
          todayIso: currentDate,
        })
      : { applied: false as const };

  // INTERPRETER-08: Normalize series_mode when recurrence_rule is present.
  // Must run after recurrence intent guard + mergeLockedCreateDraft to avoid
  // re-enabling recurrence that was intentionally downgraded.
  normalizeSeriesModeConsistency(sanitizedDraft);

  // Drop stale blocking fields that are already satisfied in the current draft.
  resolvedBlockingFields = pruneSatisfiedBlockingFields(sanitizedDraft, resolvedBlockingFields);

  const optionalPrune = pruneOptionalBlockingFields(
    mode,
    resolvedBlockingFields,
    resolvedClarificationQuestion
  );
  resolvedBlockingFields = optionalPrune.blockingFields;
  resolvedClarificationQuestion = optionalPrune.clarificationQuestion;

  // Final guardrail: never 422 for missing required create fields.
  // Convert to ask_clarification so the conversation can continue.
  if (resolvedNextAction !== "ask_clarification") {
    const draftValidation = validateSanitizedDraftPayload(mode, sanitizedDraft);
    if (!draftValidation.ok) {
      resolvedNextAction = "ask_clarification";
      if (draftValidation.blockingField && !resolvedBlockingFields.includes(draftValidation.blockingField)) {
        resolvedBlockingFields.push(draftValidation.blockingField);
      }
      const missingField = draftValidation.blockingField || "required field";
      resolvedClarificationQuestion = buildMissingFieldQuestion(missingField);
    }
  }

  // Phase 7C: Reduce multiple blocking fields to a single primary question.
  if (resolvedNextAction === "ask_clarification") {
    const reduced = reduceClarificationToSingle(resolvedBlockingFields, resolvedClarificationQuestion);
    resolvedBlockingFields = reduced.blockingFields;
    resolvedClarificationQuestion = reduced.clarificationQuestion;
  }

  if (resolvedNextAction === "ask_clarification" && resolvedBlockingFields.length === 0) {
    resolvedClarificationQuestion = null;
    resolvedNextAction = "show_preview";
  }

  const shouldStripOptionalExternalUrlAsk =
    resolvedNextAction !== "ask_clarification" &&
    !resolvedBlockingFields.includes("external_url") &&
    !hasNonEmptyString(sanitizedDraft.external_url);
  const humanSummary = shouldStripOptionalExternalUrlAsk
    ? stripOptionalExternalUrlAskFromSummary(responsePayload.human_summary)
    : responsePayload.human_summary.trim();
  const finalHumanSummary =
    futureDateGuardResult.applied && !humanSummary.includes(futureDateGuardResult.to)
      ? futureDateGuardResult.reason === "future_year_pullback"
        ? `${humanSummary} Date set to ${futureDateGuardResult.to} (current year) — the source did not specify ${futureDateGuardResult.from.slice(0, 4)}.`
        : `${humanSummary} Date adjusted to ${futureDateGuardResult.to} because the source date would otherwise be in the past.`
      : humanSummary;

  const remainingBeforeVerifier = getRemainingRouteBudgetMs(requestStartedAt);
  const canRunDraftVerifier =
    remainingBeforeVerifier >= DRAFT_VERIFIER_TIMEOUT_MS + 4_000;
  const draftVerification =
    canRunDraftVerifier && (mode === "create" || mode === "edit_series") && resolvedNextAction !== "ask_clarification"
      ? await verifyDraftWithCritic({
          openAiKey,
          verifierModel,
          message: normalizedMessage,
          extractedImageText,
          draft: sanitizedDraft,
          currentDate,
          venueResolution,
          webSearchVerification,
          traceId,
        })
      : null;

  const appliedVerifierPatches = applyDraftVerifierPatches(sanitizedDraft, draftVerification);
  if (appliedVerifierPatches.length > 0) {
    hardenDraftForCreateEdit({
      mode,
      draft: sanitizedDraft,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
      extractionConfidence: extractionMetadata?.confidence,
    });
    if (mode === "create") {
      applyVenueTypeTitleDefault(sanitizedDraft);
    }
    normalizeSeriesModeConsistency(sanitizedDraft);
    enforceVenueCustomExclusivity(sanitizedDraft);
    resolvedBlockingFields = pruneSatisfiedBlockingFields(sanitizedDraft, resolvedBlockingFields);
  }

  if (mode === "create" || mode === "edit_series") {
    ensureEventTypeFromDraftSignals({
      draft: sanitizedDraft,
      message: normalizedMessage,
      conversationHistory,
      extractedImageText,
    });
    delete sanitizedDraft.categories;
  }

  const patchedFields = new Set(appliedVerifierPatches.map((patch) => patch.field));
  const highRiskVerificationIssue =
    draftVerification?.issues.find(
      (issue) =>
        issue.severity === "high" &&
        !patchedFields.has(issue.field) &&
        !shouldSuppressDraftVerifierIssue({
          issue,
          draft: sanitizedDraft,
          currentDate,
        })
    ) ?? null;
  if (highRiskVerificationIssue && resolvedNextAction !== "ask_clarification") {
    resolvedNextAction = "ask_clarification";
    resolvedBlockingFields = [highRiskVerificationIssue.field || "draft_verification"];
    resolvedClarificationQuestion =
      highRiskVerificationIssue.question ||
      `Please confirm ${highRiskVerificationIssue.field}: ${highRiskVerificationIssue.issue}`;
  }

  const qualityHints = buildQualityHints(sanitizedDraft);
  const visibleHumanSummary =
    appliedVerifierPatches.length > 0 && !highRiskVerificationIssue
      ? `${finalHumanSummary} I cleaned up ${appliedVerifierPatches.length === 1 ? "one draft detail" : `${appliedVerifierPatches.length} draft details`} before showing this to you.`
      : finalHumanSummary;
  const followupQuestion =
    resolvedNextAction !== "ask_clarification" && !highRiskVerificationIssue
      ? buildOptionalDraftFollowup(sanitizedDraft)
      : null;

  const response = {
    mode,
    next_action: resolvedNextAction,
    scope: modelScope,
    confidence: responsePayload.confidence,
    human_summary: highRiskVerificationIssue
      ? `${visibleHumanSummary} I found one thing worth confirming before this goes live.`
      : visibleHumanSummary,
    clarification_question: resolvedClarificationQuestion,
    followup_question: followupQuestion,
    blocking_fields: resolvedBlockingFields,
    draft_payload: sanitizedDraft,
    quality_hints: qualityHints,
    /**
     * PR 3 follow-up: stable correlation id for this edit turn. Echoed
     * to the client so it can post a matching EditTurnOutcomeEvent
     * after the user accepts or rejects. Only present on the success
     * path; error responses (4xx/502) MUST NOT include this field.
     * Field name `editTurnId` (not `turnId`) avoids collisions with any
     * future turn-related field.
     */
    editTurnId,
    ...(scopeDecision.forced
      ? {
          scope_decision: {
            forced: true,
            reason: scopeDecision.reason,
            patch_suppressed: scopeDecision.patchSuppressed,
          },
        }
      : {}),
    ...(extractionMetadata ? { extraction_metadata: extractionMetadata } : {}),
    ...(highRiskVerificationIssue && draftVerification ? { draft_verification: draftVerification } : {}),
    ...(webSearchVerification ? { web_search_verification: webSearchVerification } : {}),
  };

  console.info("[events/interpret] response", {
    userId: sessionUser.id,
    traceId,
    mode,
    nextAction: response.next_action,
    confidence: response.confidence,
    blockingFields: response.blocking_fields,
    verifierPatchFields: appliedVerifierPatches.map((patch) => patch.field),
    draft: redactEmails(truncate(JSON.stringify(response.draft_payload), 1200)),
    ...(googleMapsHint
      ? {
          googleMapsHint: {
            sourceUrl: googleMapsHint.source_url,
            finalUrl: googleMapsHint.final_url,
            placeName: googleMapsHint.place_name,
            hasAddress: !!googleMapsHint.address,
            hasCoords:
              typeof googleMapsHint.latitude === "number" &&
              typeof googleMapsHint.longitude === "number",
          },
        }
      : {}),
    ...(locationHintResult.applied ? { locationHintApplied: true } : {}),
    ...(futureDateGuardResult.applied ? { futureDateGuard: futureDateGuardResult } : {}),
    ...(venueResolution
      ? {
          venueResolution: {
            status: venueResolution.status,
            ...(venueResolution.status === "resolved"
              ? {
                  source: venueResolution.source,
                  confidence: venueResolution.confidence,
                  venueId: venueResolution.venueId,
                }
              : {}),
            ...(venueResolution.status === "ambiguous"
              ? {
                  candidateCount: venueResolution.candidates.length,
                  inputName: venueResolution.inputName,
                }
              : {}),
            ...(venueResolution.status === "unresolved"
              ? { inputName: venueResolution.inputName }
              : {}),
          },
        }
      : {}),
    ...(extractionMetadata
      ? {
          extraction: {
            imagesProcessed: extractionMetadata.images_processed,
            extractedFields: extractionMetadata.extracted_fields,
            confidence: extractionMetadata.confidence,
          },
        }
      : {}),
    ...(draftVerification
      ? {
          draftVerification: {
            status: draftVerification.status,
            issueCount: draftVerification.issues.length,
            highRisk: draftVerification.issues.some((issue) => issue.severity === "high"),
            model: verifierModel,
          },
        }
      : {}),
    ...(webSearchVerification
      ? {
          webSearchVerification: {
            status: webSearchVerification.status,
            sourceCount: webSearchVerification.sources.length,
            factCount: webSearchVerification.facts.length,
            domains: webSearchVerification.sources
              .map((source) => source.domain)
              .filter(Boolean)
              .slice(0, 5),
            model: webSearchModel,
          },
        }
      : {}),
  });

  // PR 3-wiring: edit-turn telemetry (collab plan §6 PR 3). One emit per
  // successful response. Risk tier and enforcement mode are derived from
  // the patch-field registry over the proposed draft keys; unknown
  // fields default to high+enforced per registry contract (§5.1).
  const telemetryProposedFields = Object.keys(sanitizedDraft);
  const telemetryClassifications = telemetryProposedFields.map(
    (field) =>
      getPatchFieldClassification(field as EventsColumn) ?? {
        risk_tier: "high" as const,
        enforcement_mode: "enforced" as const,
      },
  );
  const telemetryRiskTier: RiskTier = telemetryClassifications.some(
    (c) => c.risk_tier === "high",
  )
    ? "high"
    : telemetryClassifications.some((c) => c.risk_tier === "medium")
      ? "medium"
      : "low";
  const telemetryEnforcementMode: EnforcementMode = telemetryClassifications.some(
    (c) => c.enforcement_mode === "enforced",
  )
    ? "enforced"
    : "shadow";
  // blockedFields here = resolvedBlockingFields from the LLM (fields the model
  // declined to propose this turn). Distinct from the my-events PATCH gate's
  // blockedFields (= server-side gate-blocked, requires explicit confirmation).
  // Both fit the unified schema meaning "fields prevented from auto-application
  // this turn", but the blocker source differs by call site.
  emitEditTurnTelemetry(
    buildEditTurnTelemetryEvent({
      turnId: editTurnId,
      mode,
      currentEventId: eventId ?? null,
      priorStateHash: hashPriorState(currentEvent),
      scopeDecision: modelScope,
      proposedChangedFields: telemetryProposedFields,
      verifierAutoPatchedFields: appliedVerifierPatches.map((patch) => patch.field),
      riskTier: telemetryRiskTier,
      enforcementMode: telemetryEnforcementMode,
      blockedFields: resolvedBlockingFields,
      modelId: model,
      latencyMs: Date.now() - requestStartedAt,
      userOutcome: "unknown",
    }),
  );

  return NextResponse.json(response);
}
