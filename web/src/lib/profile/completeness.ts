// Profile completeness scoring logic
// Total = 100 points, weights are easy to tweak

export interface ProfileData {
  // Identity flags
  is_songwriter?: boolean;
  is_host?: boolean;
  is_studio?: boolean;
  is_fan?: boolean;
  is_public?: boolean;
  // Basics
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  // Music details
  instruments?: string[] | null;
  genres?: string[] | null;
  // Social links
  instagram_url?: string | null;
  facebook_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  spotify_url?: string | null;
  website_url?: string | null;
  // Tip links
  venmo_handle?: string | null;
  cashapp_handle?: string | null;
  paypal_url?: string | null;
}

export interface CompletionItem {
  id: string;
  label: string;
  points: number;
  earned: boolean;
  suggestion: string;
  sectionId: string; // For anchor scrolling
}

export interface CompletenessResult {
  score: number;
  maxScore: number;
  percentage: number;
  items: CompletionItem[];
  suggestions: CompletionItem[]; // Top 3 missing items
  isComplete: boolean;
}

// Scoring weights (easy to tweak)
const WEIGHTS = {
  // Identity (20 points)
  identity: 20,
  // Basics (30 points)
  fullName: 10,
  bio: 10,
  avatar: 10,
  // Music Details (30 points)
  instruments: 15,
  genres: 15,
  // Engagement (20 points)
  socialLink: 10,
  tipLink: 10,
} as const;

const BIO_MIN_LENGTH = 50;

export function calculateCompleteness(profile: ProfileData): CompletenessResult {
  const items: CompletionItem[] = [];

  // Identity (20 points) - at least one identity flag
  const hasIdentity = Boolean(
    profile.is_songwriter || profile.is_host || profile.is_studio || profile.is_fan
  );
  items.push({
    id: "identity",
    label: "Identity",
    points: WEIGHTS.identity,
    earned: hasIdentity,
    suggestion: "Tell us how you identify in the music community",
    sectionId: "identity-section",
  });

  // Public visibility (0 points) - helpful nudge only
  const isPublic = profile.is_public !== false;
  const publicVisibilityItem: CompletionItem = {
    id: "publicProfile",
    label: "Public Profile",
    points: 0,
    earned: isPublic,
    suggestion: "Turn on Public profile to appear in search",
    sectionId: "visibility-section",
  };
  items.push(publicVisibilityItem);

  // Full name (10 points)
  const hasName = Boolean(profile.full_name?.trim());
  items.push({
    id: "fullName",
    label: "Display Name",
    points: WEIGHTS.fullName,
    earned: hasName,
    suggestion: "Add your display name",
    sectionId: "basic-info-section",
  });

  // Bio (10 points) - at least 50 characters
  const hasBio = Boolean(profile.bio && profile.bio.trim().length >= BIO_MIN_LENGTH);
  items.push({
    id: "bio",
    label: "Bio",
    points: WEIGHTS.bio,
    earned: hasBio,
    suggestion: "Write a bio (at least 50 characters) to introduce yourself",
    sectionId: "basic-info-section",
  });

  // Avatar (10 points)
  const hasAvatar = Boolean(profile.avatar_url?.trim());
  items.push({
    id: "avatar",
    label: "Profile Picture",
    points: WEIGHTS.avatar,
    earned: hasAvatar,
    suggestion: "Add a profile picture",
    sectionId: "avatar-section",
  });

  // Instruments (15 points)
  const hasInstruments = Boolean(profile.instruments && profile.instruments.length >= 1);
  items.push({
    id: "instruments",
    label: "Instruments",
    points: WEIGHTS.instruments,
    earned: hasInstruments,
    suggestion: "Add instruments to help people find you",
    sectionId: "music-skills-section",
  });

  // Genres (15 points)
  const hasGenres = Boolean(profile.genres && profile.genres.length >= 1);
  items.push({
    id: "genres",
    label: "Genres",
    points: WEIGHTS.genres,
    earned: hasGenres,
    suggestion: "Add genres so others know your style",
    sectionId: "music-skills-section",
  });

  // Social link (10 points) - at least one
  const hasSocialLink = Boolean(
    profile.instagram_url?.trim() ||
    profile.facebook_url?.trim() ||
    profile.twitter_url?.trim() ||
    profile.tiktok_url?.trim() ||
    profile.youtube_url?.trim() ||
    profile.spotify_url?.trim() ||
    profile.website_url?.trim()
  );
  items.push({
    id: "socialLink",
    label: "Social Link",
    points: WEIGHTS.socialLink,
    earned: hasSocialLink,
    suggestion: "Add a social link so fans can follow you",
    sectionId: "social-links-section",
  });

  // Tip link (10 points) - at least one
  const hasTipLink = Boolean(
    profile.venmo_handle?.trim() ||
    profile.cashapp_handle?.trim() ||
    profile.paypal_url?.trim()
  );
  items.push({
    id: "tipLink",
    label: "Tip Link",
    points: WEIGHTS.tipLink,
    earned: hasTipLink,
    suggestion: "Add a tip link so fans can support you",
    sectionId: "tip-links-section",
  });

  // Calculate totals
  const maxScore = items.reduce((sum, item) => sum + item.points, 0);
  const score = items.reduce((sum, item) => sum + (item.earned ? item.points : 0), 0);
  const percentage = Math.round((score / maxScore) * 100);

  // Get top 3 missing items (sorted by points descending for highest impact)
  let suggestions = items
    .filter((item) => !item.earned)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  if (!isPublic) {
    suggestions = [publicVisibilityItem, ...suggestions.filter((item) => item.id !== "publicProfile")].slice(0, 3);
  }

  return {
    score,
    maxScore,
    percentage,
    items,
    suggestions,
    isComplete: percentage === 100,
  };
}
