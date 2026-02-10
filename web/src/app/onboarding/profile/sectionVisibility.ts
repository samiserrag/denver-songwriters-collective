/**
 * Section keys for onboarding accordion visibility.
 */
export type SectionKey =
  | "identity"
  | "instruments"
  | "about"
  | "social"
  | "tipping"
  | "collab";

export interface IdentityFlags {
  is_songwriter: boolean;
  is_host: boolean;
  is_studio: boolean;
  is_fan: boolean;
}

/**
 * Determines which optional onboarding sections are relevant based on identity flags.
 */
export function getRelevantSections(flags: IdentityFlags): SectionKey[] {
  const { is_songwriter, is_host, is_studio, is_fan } = flags;

  const hasAnyIdentity = is_songwriter || is_host || is_studio || is_fan;
  if (!hasAnyIdentity) {
    return ["identity", "instruments", "about", "social", "tipping", "collab"];
  }

  const sections = new Set<SectionKey>();
  sections.add("identity");

  if (is_songwriter) {
    sections.add("instruments");
    sections.add("about");
    sections.add("social");
    sections.add("tipping");
    sections.add("collab");
  }

  if (is_host) {
    sections.add("about");
    sections.add("social");
  }

  if (is_studio) {
    sections.add("about");
    sections.add("social");
  }

  if (is_fan) {
    sections.add("about");
    sections.add("instruments");
  }

  const ordered: SectionKey[] = [
    "identity",
    "instruments",
    "about",
    "social",
    "tipping",
    "collab",
  ];
  return ordered.filter((section) => sections.has(section));
}
