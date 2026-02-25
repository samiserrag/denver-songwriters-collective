/**
 * Phase 5 — Deterministic server-side venue resolution.
 *
 * Pure, stateless module that runs post-LLM in the interpret route.
 * Validates or enhances the LLM's venue output by matching against a
 * known venue catalog using normalized text comparison.
 *
 * Never auto-picks low-confidence matches. Never silently defaults to online.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VenueCatalogEntry {
  id: string;
  name: string;
  slug?: string | null;
}

export interface VenueResolverInput {
  /** venue_id from the LLM draft (may be null/undefined) */
  draftVenueId: string | null | undefined;
  /** Any venue name hint from the LLM (venue_name or custom_location_name) */
  draftVenueName: string | null | undefined;
  /** The user's original message text */
  userMessage: string;
  /** Known venues from DB */
  venueCatalog: VenueCatalogEntry[];
  /** draft_payload.location_mode */
  draftLocationMode: string | null | undefined;
  /** draft_payload.online_url */
  draftOnlineUrl: string | null | undefined;
  /** Whether draftVenueName originated from custom_location_name (not venue_name) */
  isCustomLocation?: boolean;
}

export interface ShouldResolveVenueInput {
  mode: string;
  hasLocationIntent: boolean;
  draftPayload: Record<string, unknown>;
}

export type VenueResolutionOutcome =
  | {
      status: "resolved";
      venueId: string;
      venueName: string;
      confidence: number;
      source: "llm_validated" | "server_exact" | "server_fuzzy";
    }
  | {
      status: "ambiguous";
      candidates: Array<{ id: string; name: string; score: number }>;
      inputName: string;
    }
  | { status: "unresolved"; inputName: string | null }
  | { status: "online_explicit" }
  | { status: "custom_location" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Score at or above which a single best match is auto-resolved */
export const RESOLVE_THRESHOLD = 0.80;

/** Score at or above which a match is included in ambiguous candidates */
export const AMBIGUOUS_THRESHOLD = 0.40;

/** Minimum gap between 1st and 2nd best scores to auto-resolve */
export const TIE_GAP = 0.05;

/** Maximum candidates returned for ambiguous results */
export const MAX_AMBIGUOUS_CANDIDATES = 3;

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * True when draft payload includes concrete location identifiers/hints.
 * Do not use location_mode alone here because models may default it.
 */
export function hasVenueSignalsInDraft(draftPayload: Record<string, unknown>): boolean {
  return (
    hasNonEmptyString(draftPayload.venue_id) ||
    hasNonEmptyString(draftPayload.venue_name) ||
    hasNonEmptyString(draftPayload.custom_location_name) ||
    hasNonEmptyString(draftPayload.online_url)
  );
}

/**
 * Gate for running venue resolution post-LLM.
 *
 * - create: always resolve
 * - edit_series: only resolve when location intent is present in message or
 *   draft contains concrete location hints
 * - other modes: never resolve
 */
export function shouldResolveVenue(input: ShouldResolveVenueInput): boolean {
  if (input.mode === "create") return true;
  if (input.mode !== "edit_series") return false;
  return input.hasLocationIntent || hasVenueSignalsInDraft(input.draftPayload);
}

// ---------------------------------------------------------------------------
// Normalization helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Normalize a name for matching: lowercase, strip non-alphanumeric (except
 * spaces), collapse whitespace, trim.
 */
export function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a slug from a name (same logic as eventImportDedupe.generateSlug).
 * Used for slug-based matching when catalog entries include slugs.
 */
export function generateMatchSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Tokenize a name into a set of lowercase alpha-numeric words.
 */
export function tokenize(name: string): Set<string> {
  const tokens = name
    .toLowerCase()
    .replace(/&/g, "and")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

/**
 * Jaccard similarity: |intersection| / |union|.
 */
export function tokenJaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score how well a candidate name matches a catalog entry.
 * Returns a number between 0 and 1.
 */
export function scoreVenueMatch(
  candidate: string,
  entry: VenueCatalogEntry
): number {
  // 1. Exact match (case-insensitive, trimmed)
  if (normalizeForMatch(candidate) === normalizeForMatch(entry.name)) {
    return 1.0;
  }

  // 2. Slug match
  const candidateSlug = generateMatchSlug(candidate);
  const entrySlug = entry.slug || generateMatchSlug(entry.name);
  if (candidateSlug.length > 0 && candidateSlug === entrySlug) {
    return 0.95;
  }

  // 3. Token Jaccard with first-token boost
  const candidateTokens = tokenize(candidate);
  const entryTokens = tokenize(entry.name);
  let score = tokenJaccardScore(candidateTokens, entryTokens);

  // First-token boost: venue names often start with the distinguishing word
  if (candidateTokens.size > 0 && entryTokens.size > 0) {
    const candidateFirst = [...candidateTokens][0];
    const entryFirst = [...entryTokens][0];
    if (candidateFirst === entryFirst) {
      score = Math.min(1.0, score + 0.05);
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Name extraction from user message
// ---------------------------------------------------------------------------

/**
 * Extract a venue name from the user's message by finding the longest
 * catalog name (normalized) that appears as a substring in the normalized
 * message.
 */
export function extractVenueNameFromMessage(
  message: string,
  catalog: VenueCatalogEntry[]
): string | null {
  if (!message.trim() || catalog.length === 0) return null;

  const normalizedMessage = normalizeForMatch(message);
  let bestMatch: string | null = null;
  let bestLength = 0;

  for (const entry of catalog) {
    const normalizedName = normalizeForMatch(entry.name);
    if (normalizedName.length > bestLength && normalizedMessage.includes(normalizedName)) {
      bestMatch = entry.name;
      bestLength = normalizedName.length;
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a venue from interpreter draft output.
 *
 * Decision flow:
 * 1. Online short-circuit
 * 2. Validate LLM-provided venue_id
 * 3. Custom location check (preserve intent or redirect to known venue)
 * 4. Extract candidate name → score against catalog → threshold decision
 */
export function resolveVenue(input: VenueResolverInput): VenueResolutionOutcome {
  const {
    draftVenueId,
    draftVenueName,
    userMessage,
    venueCatalog,
    draftLocationMode,
    draftOnlineUrl,
    isCustomLocation,
  } = input;

  // 1. Online short-circuit
  if (
    draftLocationMode === "online" &&
    typeof draftOnlineUrl === "string" &&
    draftOnlineUrl.trim().length > 0
  ) {
    return { status: "online_explicit" };
  }

  // 2. LLM venue_id validation
  if (typeof draftVenueId === "string" && draftVenueId.trim().length > 0) {
    const match = venueCatalog.find((v) => v.id === draftVenueId.trim());
    if (match) {
      return {
        status: "resolved",
        venueId: match.id,
        venueName: match.name,
        confidence: 1.0,
        source: "llm_validated",
      };
    }
    // LLM venue_id is stale/hallucinated — fall through to name matching
  }

  // 3. Determine candidate name
  const candidateName =
    (typeof draftVenueName === "string" && draftVenueName.trim().length > 0
      ? draftVenueName.trim()
      : null) ?? extractVenueNameFromMessage(userMessage, venueCatalog);

  // Nothing to match against
  if (!candidateName || venueCatalog.length === 0) {
    // If custom_location_name was provided, preserve that intent
    if (isCustomLocation && typeof draftVenueName === "string" && draftVenueName.trim().length > 0) {
      return { status: "custom_location" };
    }
    return { status: "unresolved", inputName: candidateName };
  }

  // 4. Score all catalog entries
  const scored = venueCatalog
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: scoreVenueMatch(candidateName, entry),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const secondBest = scored.length > 1 ? scored[1] : null;

  // 5. Threshold decisions
  if (best.score >= RESOLVE_THRESHOLD) {
    // Check for too-close tie
    if (secondBest && secondBest.score >= RESOLVE_THRESHOLD && best.score - secondBest.score < TIE_GAP) {
      // Ambiguous — two venues are too close in score
      return {
        status: "ambiguous",
        candidates: scored
          .filter((s) => s.score >= AMBIGUOUS_THRESHOLD)
          .slice(0, MAX_AMBIGUOUS_CANDIDATES),
        inputName: candidateName,
      };
    }

    return {
      status: "resolved",
      venueId: best.id,
      venueName: best.name,
      confidence: best.score,
      source: best.score >= 0.95 ? "server_exact" : "server_fuzzy",
    };
  }

  if (best.score >= AMBIGUOUS_THRESHOLD) {
    return {
      status: "ambiguous",
      candidates: scored
        .filter((s) => s.score >= AMBIGUOUS_THRESHOLD)
        .slice(0, MAX_AMBIGUOUS_CANDIDATES),
      inputName: candidateName,
    };
  }

  // Below ambiguous threshold — if this was a custom location, preserve that intent
  if (isCustomLocation) {
    return { status: "custom_location" };
  }

  return { status: "unresolved", inputName: candidateName };
}
