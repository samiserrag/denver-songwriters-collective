export const SIGNUP_MODE_VALUES = [
  "walk_in",
  "in_person",
  "online",
  "both",
] as const;

export type SignupMode = (typeof SIGNUP_MODE_VALUES)[number];

const SIGNUP_MODE_SET = new Set<string>(SIGNUP_MODE_VALUES);

function normalizedText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isValidSignupMode(value: unknown): value is SignupMode {
  return typeof value === "string" && SIGNUP_MODE_SET.has(value.trim().toLowerCase());
}

/**
 * Normalizes free-form/signup-ish values into DB-valid enum values.
 *
 * DB constraint accepts only: walk_in | in_person | online | both | null
 */
export function normalizeSignupMode(value: unknown): SignupMode | null {
  const raw = normalizedText(value);
  if (!raw) return null;

  if (SIGNUP_MODE_SET.has(raw)) {
    return raw as SignupMode;
  }

  if (
    raw === "rsvp" ||
    raw === "platform" ||
    raw === "platform_rsvp" ||
    raw === "on_platform" ||
    raw === "not_specified" ||
    raw === "not specified" ||
    raw === "none" ||
    raw === "default"
  ) {
    return null;
  }

  if (
    raw === "in-person" ||
    raw === "in person" ||
    raw === "signup at venue" ||
    raw === "at venue" ||
    raw === "onsite" ||
    raw === "on_site"
  ) {
    return "in_person";
  }

  if (raw === "walk-in" || raw === "walk in" || raw === "no signup") {
    return "walk_in";
  }

  if (raw === "external" || raw === "external_signup" || raw === "link") {
    return "online";
  }

  if (
    raw === "hybrid" ||
    raw === "in person + online" ||
    raw === "online + in person"
  ) {
    return "both";
  }

  return null;
}
