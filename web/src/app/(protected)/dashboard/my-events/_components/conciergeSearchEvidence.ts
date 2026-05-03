import type {
  WebSearchCategoryResult,
  WebSearchVerificationResult,
  WebSearchVerificationSource,
} from "@/lib/events/interpretEventContract";

export type ConciergeSearchDisplayKind =
  | "venue_partial"
  | "all_timeout"
  | "event_verified"
  | "no_confidence"
  | "searched";

export interface ConciergeSearchEvidenceDisplay {
  kind: ConciergeSearchDisplayKind;
  tone: "success" | "warning";
  label: string;
  summary: string;
  details: string[];
  sourceLinks: WebSearchVerificationSource[];
  missingFields: string[];
  followupQuestion: string | null;
  suppressAddressQuestion: boolean;
}

const GOOGLE_MAPS_LINK_REGEX =
  /\bhttps?:\/\/(?:maps\.app\.goo\.gl\/[^\s]+|goo\.gl\/maps\/[^\s]+|(?:www\.)?google\.com\/maps\/[^\s]+|maps\.google\.com\/[^\s]+)\b/i;

function isGoogleMapsUrl(value: unknown): boolean {
  return typeof value === "string" && GOOGLE_MAPS_LINK_REGEX.test(value.trim());
}

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: string[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatAttemptedQueries(label: string, queries: string[] | undefined): string | null {
  const attempted = uniqueStrings(queries ?? [], 8);
  if (attempted.length === 0) return null;
  return `${label} tried: ${attempted.join(", ")}`;
}

function categoryIsVerified(category: WebSearchCategoryResult | undefined): boolean {
  return category?.status === "verified";
}

function categoryIsUseful(category: WebSearchCategoryResult | undefined): boolean {
  return categoryIsVerified(category) && ((category?.facts.length ?? 0) > 0 || (category?.sources.length ?? 0) > 0);
}

function normalizeMissingField(value: string): string | null {
  const lower = value.trim().toLowerCase();
  if (!lower) return null;
  if (lower.includes("cost") || lower.includes("free") || lower.includes("price")) return "cost";
  if (lower.includes("signup") || lower.includes("sign-up") || lower.includes("registration")) return "signup link";
  if (lower.includes("source") || lower.includes("direct") || lower.includes("event listing")) return "source link";
  if (lower.includes("exact public event")) return null;
  if (lower.includes("venue") || lower.includes("address") || lower.includes("location")) return null;
  return value.trim();
}

function getMissingEventFields(input: {
  verification: WebSearchVerificationResult;
  venueUseful: boolean;
}): string[] {
  const trueUnknowns = input.verification.fact_buckets?.true_unknowns ?? [];
  const normalized = trueUnknowns
    .map(normalizeMissingField)
    .filter((field): field is string => field !== null);
  return uniqueStrings(normalized, 4);
}

function getVenueName(draftPayload?: Record<string, unknown> | null, verification?: WebSearchVerificationResult): string {
  return (
    coerceString(draftPayload?.venue_name) ??
    coerceString(draftPayload?.custom_location_name) ??
    coerceString(verification?.venue_search?.sources[0]?.title) ??
    "the venue"
  );
}

function hasAddressEvidence(input: {
  draftPayload?: Record<string, unknown> | null;
  venueSearch?: WebSearchCategoryResult;
  verification?: WebSearchVerificationResult;
}): boolean {
  const draft = input.draftPayload;
  const draftHasStreet = !!(coerceString(draft?.address) ?? coerceString(draft?.custom_address));
  const draftHasCityOrState = !!(
    coerceString(draft?.city) ??
    coerceString(draft?.custom_city) ??
    coerceString(draft?.state) ??
    coerceString(draft?.custom_state) ??
    coerceString(draft?.zip) ??
    coerceString(draft?.custom_zip)
  );
  if (draftHasStreet && draftHasCityOrState) return true;

  const evidenceText = [
    ...(input.venueSearch?.facts ?? []),
    ...(input.verification?.fact_buckets?.searched_verified ?? []),
    input.venueSearch?.summary ?? "",
  ].join(" ");
  return /\b(address|street|city|state|zip|co\s+\d{5}|[0-9]{2,}\s+[a-z0-9 .'-]+(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|main)\b)/i.test(
    evidenceText
  );
}

function filterDisplaySources(sources: WebSearchVerificationSource[]): WebSearchVerificationSource[] {
  const seen = new Set<string>();
  const result: WebSearchVerificationSource[] = [];
  for (const source of sources) {
    if (isGoogleMapsUrl(source.url)) continue;
    const key = source.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(source);
    if (result.length >= 4) break;
  }
  return result;
}

export function buildConciergeSearchEvidenceDisplay(input: {
  verification: WebSearchVerificationResult | null | undefined;
  draftPayload?: Record<string, unknown> | null;
}): ConciergeSearchEvidenceDisplay | null {
  const verification = input.verification;
  if (!verification) return null;

  const venueSearch = verification.venue_search;
  const eventSearch = verification.event_search;
  const venueUseful = categoryIsUseful(venueSearch);
  const eventVerified = categoryIsVerified(eventSearch);
  const sourceLinks = filterDisplaySources([
    ...verification.sources,
    ...(venueSearch?.sources ?? []),
    ...(eventSearch?.sources ?? []),
  ]);
  const missingFields = getMissingEventFields({ verification, venueUseful });
  const addressBacked = hasAddressEvidence({
    draftPayload: input.draftPayload,
    venueSearch,
    verification,
  });
  const followupQuestion =
    missingFields.length > 0 ? `Optional details still unknown: ${formatList(missingFields)}.` : null;

  if (venueSearch?.status === "timeout" && eventSearch?.status === "timeout") {
    return {
      kind: "all_timeout",
      tone: "warning",
      label: "Search timed out",
      summary: "Search timed out before returning reliable venue or exact-event sources.",
      details: [
        formatAttemptedQueries("Venue search", venueSearch.attempted_queries),
        formatAttemptedQueries("Exact-event search", eventSearch.attempted_queries),
      ].filter((detail): detail is string => detail !== null),
      sourceLinks,
      missingFields,
      followupQuestion,
      suppressAddressQuestion: false,
    };
  }

  if (venueUseful && !eventVerified) {
    const venueName = getVenueName(input.draftPayload, verification);
    const eventMiss =
      eventSearch?.status === "timeout"
        ? "Exact-event search timed out before finding a public listing"
        : "I did not find a public listing for this exact event";
    return {
      kind: "venue_partial",
      tone: "success",
      label: "Venue found, event source missing",
      summary: `I found source-backed venue details for ${venueName}. ${eventMiss}, so I'll keep event details limited to the flyer/post.`,
      details: [
        `Venue confidence: ${venueSearch?.confidence ?? "unknown"}`,
        eventSearch?.summary ? `Exact event: ${eventSearch.summary}` : null,
        followupQuestion,
      ].filter((detail): detail is string => detail !== null),
      sourceLinks,
      missingFields,
      followupQuestion,
      suppressAddressQuestion: addressBacked,
    };
  }

  if (eventVerified) {
    return {
      kind: "event_verified",
      tone: "success",
      label: "Checked online",
      summary: verification.summary,
      details: [
        venueUseful ? `Venue confidence: ${venueSearch?.confidence ?? "unknown"}` : null,
        followupQuestion,
      ].filter((detail): detail is string => detail !== null),
      sourceLinks,
      missingFields,
      followupQuestion,
      suppressAddressQuestion: false,
    };
  }

  if (verification.status === "no_reliable_sources") {
    return {
      kind: "no_confidence",
      tone: "warning",
      label: "Search tried",
      summary: verification.summary,
      details: [
        formatAttemptedQueries("Venue search", venueSearch?.attempted_queries),
        formatAttemptedQueries("Exact-event search", eventSearch?.attempted_queries),
        followupQuestion,
      ].filter((detail): detail is string => detail !== null),
      sourceLinks,
      missingFields,
      followupQuestion,
      suppressAddressQuestion: false,
    };
  }

  return {
    kind: "searched",
    tone: "success",
    label: "Checked online",
    summary: verification.summary,
    details: [followupQuestion].filter((detail): detail is string => detail !== null),
    sourceLinks,
    missingFields,
    followupQuestion,
    suppressAddressQuestion: false,
  };
}

export function shouldSuppressVenueAddressQuestion(input: {
  display: ConciergeSearchEvidenceDisplay | null;
  clarificationQuestion?: string | null;
  blockingFields?: string[];
}): boolean {
  if (!input.display?.suppressAddressQuestion) return false;
  const question = input.clarificationQuestion ?? "";
  const asksForAddress = /\b(street address|address|city|state|zip|where is|where's)\b/i.test(question);
  const blocksAddress = (input.blockingFields ?? []).some((field) =>
    ["address", "custom_address", "custom_city", "custom_state", "custom_zip"].includes(field)
  );
  return asksForAddress || blocksAddress;
}
