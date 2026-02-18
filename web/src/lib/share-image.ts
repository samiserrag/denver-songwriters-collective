export const DEFAULT_SHARE_IMAGE = "/images/hero-bg.jpg";

interface ShareImageSelectionInput {
  socialShareImageUrl?: string | null;
  heroImageUrl?: string | null;
  defaultImage?: string;
}

export function selectShareImageUrl({
  socialShareImageUrl,
  heroImageUrl,
  defaultImage = DEFAULT_SHARE_IMAGE,
}: ShareImageSelectionInput): string {
  const social = socialShareImageUrl?.trim();
  if (social) return social;

  const hero = heroImageUrl?.trim();
  if (hero) return hero;

  return defaultImage;
}
