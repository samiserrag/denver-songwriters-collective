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

export interface VenueSearchCandidateInput {
  sources: ReadonlyArray<string | null | undefined>;
  explicitVenueNames?: ReadonlyArray<string | null | undefined>;
  maxCandidates?: number;
}

export type VenueResolutionOutcome =
  | {
      status: "resolved";
      venueId: string;
      venueName: string;
      confidence: number;
      source: "llm_validated" | "server_exact" | "server_alias" | "server_fuzzy";
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

/** Curated alias overrides keyed by venue slug (or generated slug) */
export const CURATED_ALIAS_OVERRIDES: Record<string, string[]> = {
  "long-table-brewhouse": ["ltb"],
  "sunshine-studios-live": ["ssl", "sslive"],
};

const ACRONYM_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "at",
  "in",
  "on",
  "for",
  "to",
  "a",
  "an",
]);

const VENUE_CONTEXT_ONLY_TERMS = new Set([
  "breckenridge",
  "summit",
  "summit county",
  "colorado",
  "denver",
  "boulder",
  "pueblo",
  "aurora",
  "co",
  "flyer",
  "flyer ocr",
  "ocr",
  "source",
  "search",
  "venue",
  "location",
  "unknown",
  "yet",
  "know",
]);

const EVENT_CANDIDATE_WORDS = new Set([
  "open",
  "mic",
  "night",
  "jam",
  "session",
  "showcase",
  "workshop",
  "concert",
  "event",
  "every",
  "weekly",
  "wednesday",
  "wednesdays",
  "thursday",
  "thursdays",
  "friday",
  "fridays",
  "tonight",
  "tomorrow",
]);

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function pushUnique(values: string[], value: string): void {
  const normalized = normalizeForMatch(value);
  const alias = normalizeAlias(value);
  if (!normalized && !alias) return;
  if (values.some((existing) => normalizeForMatch(existing) === normalized || normalizeAlias(existing) === alias)) {
    return;
  }
  values.push(value);
}

function stripVenueCandidateTail(value: string): string {
  return value
    .replace(/\s+(?:open\s+mic|jam\s+session|mic\s+night|event|series|calendar|tonight|starting|every)\b.*$/i, "")
    .replace(/\s+(?:please|thanks|thank\s+you)\b.*$/i, "")
    .trim();
}

function cleanVenueSearchCandidate(raw: string): string | null {
  const candidate = stripVenueCandidateTail(
    raw
      .replace(/^[@\s]*$/g, "")
      .replace(/^[\s"'`({[]+|[\s"'`)}\]]+$/g, "")
      .replace(/^(?:at|venue|location|search\s+for|look\s+up|find|google)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );

  if (candidate.length < 2 || candidate.length > 80) return null;
  if (!/[a-z0-9@]/i.test(candidate)) return null;

  const normalized = normalizeForMatch(candidate);
  if (!normalized && !candidate.startsWith("@")) return null;
  if (VENUE_CONTEXT_ONLY_TERMS.has(normalized)) return null;

  const tokens = [...tokenize(candidate)];
  if (tokens.length > 0 && tokens.every((token) => EVENT_CANDIDATE_WORDS.has(token))) {
    return null;
  }

  return candidate;
}

function addVenueCandidateWithExpansions(values: string[], raw: string, combinedContext: string): void {
  if (/[\/|]/.test(raw)) {
    for (const part of raw.split(/[\/|]+/)) {
      addVenueCandidateWithExpansions(values, part, combinedContext);
    }
    return;
  }

  const candidate = cleanVenueSearchCandidate(raw);
  if (!candidate) return;

  const candidateAlias = normalizeAlias(candidate);
  const normalized = normalizeForMatch(candidate);
  const hasBreckenridgeContext = /\bbreck(?:enridge)?\b/i.test(combinedContext);

  pushUnique(values, candidate);

  if (/\bbreck\b/i.test(candidate) && !/\bbreckenridge\b/i.test(candidate)) {
    pushUnique(values, candidate.replace(/\bbreck\b/gi, "Breckenridge"));
  }

  if (
    hasBreckenridgeContext &&
    !candidate.startsWith("@") &&
    !/\bbreck(?:enridge)?\b/i.test(candidate) &&
    tokenize(candidate).size <= 2
  ) {
    pushUnique(values, `${candidate} Breckenridge`);
  }

  if (candidateAlias === "rmubreck" || /\brmu\s+breck(?:enridge)?\b/i.test(normalized)) {
    pushUnique(values, "RMU Breck");
    pushUnique(values, "RMU Breckenridge");
    pushUnique(values, "@rmubreck");
  }
}

/**
 * Build venue-name search candidates from user text, OCR text, handles, and
 * known draft hints. This is intentionally broad enough for concierge search:
 * it expands aliases before the assistant asks the host for searchable facts.
 */
export function buildVenueSearchCandidates(input: VenueSearchCandidateInput): string[] {
  const maxCandidates = input.maxCandidates ?? 8;
  const sources = input.sources.filter((source): source is string => typeof source === "string" && source.trim().length > 0);
  const combined = sources.join("\n");
  const values: string[] = [];

  for (const explicit of input.explicitVenueNames ?? []) {
    if (typeof explicit === "string") {
      addVenueCandidateWithExpansions(values, explicit, combined);
    }
  }

  for (const match of combined.matchAll(/@[a-z0-9_][a-z0-9_.-]{1,40}/gi)) {
    addVenueCandidateWithExpansions(values, match[0].toLowerCase(), combined);
  }

  const cuePatterns = [
    /\b(?:search\s+for|look\s+up|find|google|check)\s+([@a-z0-9][^,.;!?\n]{1,80})/gi,
    /\b(?:venue|location)\s*(?:is|:)?\s+([@a-z0-9][^,.;!?\n]{1,80})/gi,
    /\bat\s+([@a-z0-9][^,.;!?\n]{1,80})/gi,
  ];
  for (const pattern of cuePatterns) {
    for (const match of combined.matchAll(pattern)) {
      addVenueCandidateWithExpansions(values, match[1], combined);
    }
  }

  for (const match of combined.matchAll(/\b(?:[A-Z]{2,}|[A-Z][a-z][A-Za-z0-9'.&-]*)(?:\s+(?:[A-Z]{2,}|[A-Z][a-z][A-Za-z0-9'.&-]*)){0,3}\b/g)) {
    addVenueCandidateWithExpansions(values, match[0], combined);
  }

  const hasRmuBreck = values.some((value) => normalizeAlias(value) === "rmubreck" || /rmu\s+breck/i.test(value));
  if (hasRmuBreck) {
    const priority = ["RMU Breck", "RMU Breckenridge", "@rmubreck"];
    const rest = values.filter((value) => !priority.some((candidate) => normalizeAlias(candidate) === normalizeAlias(value)));
    return [...priority, ...rest].slice(0, maxCandidates);
  }

  return values.slice(0, maxCandidates);
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
 * Normalize short aliases: lowercase + alphanumeric only.
 */
export function normalizeAlias(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
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
 * Build a deterministic acronym alias from a venue name.
 * Example: "Long Table Brewhouse" -> "ltb".
 */
export function generateAcronymAlias(name: string): string | null {
  const tokens = [...tokenize(name)].filter((t) => !ACRONYM_STOPWORDS.has(t));
  if (tokens.length < 2) return null;
  const acronym = tokens.map((t) => t[0]).join("");
  const normalized = normalizeAlias(acronym);
  return normalized.length >= 2 ? normalized : null;
}

export type VenueAliasIndex = Map<string, VenueCatalogEntry[]>;

function addAlias(index: VenueAliasIndex, alias: string, entry: VenueCatalogEntry): void {
  const key = normalizeAlias(alias);
  if (key.length < 2) return;
  const existing = index.get(key);
  if (!existing) {
    index.set(key, [entry]);
    return;
  }
  if (!existing.some((v) => v.id === entry.id)) {
    existing.push(entry);
  }
}

/**
 * Build alias index from deterministic acronym aliases + curated overrides.
 */
export function buildVenueAliasIndex(catalog: VenueCatalogEntry[]): VenueAliasIndex {
  const index: VenueAliasIndex = new Map();

  for (const entry of catalog) {
    const slug = entry.slug || generateMatchSlug(entry.name);

    const acronym = generateAcronymAlias(entry.name);
    if (acronym) {
      addAlias(index, acronym, entry);
    }

    const curated = CURATED_ALIAS_OVERRIDES[slug] || [];
    for (const alias of curated) {
      addAlias(index, alias, entry);
    }
  }

  return index;
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

/**
 * Extract an alias token from user message if it exactly matches known aliases.
 */
export function extractVenueAliasFromMessage(
  message: string,
  aliasIndex: VenueAliasIndex
): string | null {
  if (!message.trim() || aliasIndex.size === 0) return null;
  const tokens = message
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((t) => normalizeAlias(t))
    .filter((t) => t.length >= 2)
    .filter((t) => !ACRONYM_STOPWORDS.has(t));

  const unique = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  for (const token of unique) {
    if (aliasIndex.has(token)) return token;
  }
  return null;
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
  const aliasIndex = buildVenueAliasIndex(venueCatalog);

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
      : null) ??
    extractVenueNameFromMessage(userMessage, venueCatalog) ??
    extractVenueAliasFromMessage(userMessage, aliasIndex);

  // Nothing to match against
  if (!candidateName || venueCatalog.length === 0) {
    // If custom_location_name was provided, preserve that intent
    if (isCustomLocation && typeof draftVenueName === "string" && draftVenueName.trim().length > 0) {
      return { status: "custom_location" };
    }
    return { status: "unresolved", inputName: candidateName };
  }

  // 4. Deterministic exact name/slug/alias checks before fuzzy scoring
  const normalizedCandidate = normalizeForMatch(candidateName);
  const candidateSlug = generateMatchSlug(candidateName);
  const candidateAlias = normalizeAlias(candidateName);

  const nameMatches = venueCatalog.filter(
    (entry) => normalizeForMatch(entry.name) === normalizedCandidate
  );
  if (nameMatches.length === 1) {
    const match = nameMatches[0];
    return {
      status: "resolved",
      venueId: match.id,
      venueName: match.name,
      confidence: 1.0,
      source: "server_exact",
    };
  }
  if (nameMatches.length > 1) {
    return {
      status: "ambiguous",
      candidates: nameMatches
        .map((entry) => ({ id: entry.id, name: entry.name, score: 1.0 }))
        .slice(0, MAX_AMBIGUOUS_CANDIDATES),
      inputName: candidateName,
    };
  }

  const slugMatches = venueCatalog.filter((entry) => {
    const entrySlug = entry.slug || generateMatchSlug(entry.name);
    return candidateSlug.length > 0 && entrySlug === candidateSlug;
  });
  if (slugMatches.length === 1) {
    const match = slugMatches[0];
    return {
      status: "resolved",
      venueId: match.id,
      venueName: match.name,
      confidence: 0.95,
      source: "server_exact",
    };
  }
  if (slugMatches.length > 1) {
    return {
      status: "ambiguous",
      candidates: slugMatches
        .map((entry) => ({ id: entry.id, name: entry.name, score: 0.95 }))
        .slice(0, MAX_AMBIGUOUS_CANDIDATES),
      inputName: candidateName,
    };
  }

  const aliasMatches = aliasIndex.get(candidateAlias) || [];
  if (aliasMatches.length === 1) {
    const match = aliasMatches[0];
    return {
      status: "resolved",
      venueId: match.id,
      venueName: match.name,
      confidence: 0.93,
      source: "server_alias",
    };
  }
  if (aliasMatches.length > 1) {
    return {
      status: "ambiguous",
      candidates: aliasMatches
        .map((entry) => ({ id: entry.id, name: entry.name, score: 0.93 }))
        .slice(0, MAX_AMBIGUOUS_CANDIDATES),
      inputName: candidateName,
    };
  }

  // 5. Fuzzy score all catalog entries
  const scored = venueCatalog
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      score: scoreVenueMatch(candidateName, entry),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const secondBest = scored.length > 1 ? scored[1] : null;

  // 6. Threshold decisions
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
