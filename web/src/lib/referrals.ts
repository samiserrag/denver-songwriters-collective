export interface ReferralParams {
  ref?: string;
  via?: string;
  src?: string;
}

type ReferralInput =
  | URLSearchParams
  | { get?: (key: string) => string | null; [key: string]: unknown }
  | null
  | undefined;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const REFERRAL_COOKIE_NAME = "dsc_referral";
export const INVITE_CTA_HEADLINE =
  "Know a songwriter or open mic friend who should be here?";
export const INVITE_CTA_BODY =
  "Invite them to join the Denver Songwriters Collective.";
export const INVITE_CTA_LABEL = "Invite a Friend";

function getInputValue(input: ReferralInput, key: "ref" | "via" | "src"): string | undefined {
  if (!input) return undefined;
  if (typeof input.get === "function") {
    const value = input.get(key);
    return value ?? undefined;
  }
  const raw = input[key];
  return typeof raw === "string" ? raw : undefined;
}

function sanitizeToken(raw?: string): string | undefined {
  if (!raw) return undefined;
  const token = raw.trim().toLowerCase();
  if (!token || !TOKEN_RE.test(token)) return undefined;
  return token;
}

export function sanitizeReferralParams(input: ReferralInput): ReferralParams {
  const refRaw = getInputValue(input, "ref");
  const viaRaw = getInputValue(input, "via");
  const srcRaw = getInputValue(input, "src");

  const ref = refRaw && UUID_RE.test(refRaw.trim()) ? refRaw.trim().toLowerCase() : undefined;
  const via = sanitizeToken(viaRaw);
  const src = sanitizeToken(srcRaw);

  return { ref, via, src };
}

export function hasReferralParams(params: ReferralParams | null | undefined): boolean {
  return Boolean(params?.ref || params?.via || params?.src);
}

export function applyReferralParams(
  searchParams: URLSearchParams,
  params: ReferralParams | null | undefined,
): void {
  if (!params) return;
  if (params.ref) searchParams.set("ref", params.ref);
  if (params.via) searchParams.set("via", params.via);
  if (params.src) searchParams.set("src", params.src);
}

export function serializeReferralCookie(params: ReferralParams): string {
  const safe = sanitizeReferralParams(params);
  return encodeURIComponent(JSON.stringify(safe));
}

export function deserializeReferralCookie(value: string | undefined): ReferralParams {
  if (!value) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>;
    return sanitizeReferralParams(parsed);
  } catch {
    return {};
  }
}
