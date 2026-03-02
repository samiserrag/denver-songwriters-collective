import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendAdminProfileAlert } from "@/lib/email/adminProfileAlerts";
import { upsertMediaEmbeds } from "@/lib/mediaEmbedsServer";

// ---------------------------------------------------------------------------
// Social-link URL helpers
// ---------------------------------------------------------------------------

/** Trim, convert blanks to null, and optionally validate against allowed hosts. */
function sanitizeSocialUrl(
  raw: unknown,
  allowedHosts?: string[],
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If it doesn't look like a URL (no protocol), return as-is for non-URL
  // handles (e.g. Venmo "@user"). Callers that need a real URL should gate
  // on allowedHosts — those will reject non-URL strings below.
  if (!/^https?:\/\//i.test(trimmed)) {
    // If the caller specified allowed hosts we MUST have a real URL.
    // Attempt to prepend https:// if the value contains a dot (likely a URL
    // missing protocol, e.g. "tiktok.com/@user").
    if (allowedHosts) {
      if (trimmed.includes(".")) {
        return sanitizeSocialUrl(`https://${trimmed}`, allowedHosts);
      }
      // Not a URL at all — reject by returning null (caller can decide to 400)
      return null;
    }
    return trimmed;
  }

  // Has a protocol — validate the host if restrictions were given.
  if (allowedHosts) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      if (!allowedHosts.includes(host)) return null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

/** Validate a social URL field, returning a 400 NextResponse on failure. */
function validateSocialField(
  value: string | null,
  rawInput: unknown,
  fieldName: string,
  label: string,
): NextResponse | null {
  // If rawInput was non-empty but sanitized to null, the URL was invalid.
  const raw = typeof rawInput === "string" ? rawInput.trim() : "";
  if (raw && value === null) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: { [fieldName]: `Invalid ${label} URL.` } },
      { status: 400 },
    );
  }
  return null;
}

const TRACKED_PROFILE_FIELDS = [
  "full_name",
  "bio",
  "city",
  "state",
  "is_songwriter",
  "is_host",
  "is_studio",
  "is_fan",
  "is_public",
  "instagram_url",
  "facebook_url",
  "twitter_url",
  "tiktok_url",
  "youtube_url",
  "spotify_url",
  "bandcamp_url",
  "website_url",
  "venmo_handle",
  "cashapp_handle",
  "paypal_url",
  "buymeacoffee_url",
  "patreon_url",
  "open_to_collabs",
  "specialties",
  "favorite_open_mic",
  "available_for_hire",
  "interested_in_cowriting",
  "genres",
  "instruments",
  "song_links",
  "featured_song_url",
] as const;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return (a ?? null) === (b ?? null);
}

export async function PUT(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    // --- Sanitize all social-link URL fields ---
    // Each field gets trimmed, blanks→null, and domain-validated where appropriate.
    // The DB has a CHECK constraint on tiktok_url requiring https?:// prefix.
    const youtubeValue = sanitizeSocialUrl(body.youtube_url, ["youtube.com", "youtu.be"]);
    const ytErr = validateSocialField(youtubeValue, body.youtube_url, "youtube_url", "YouTube");
    if (ytErr) return ytErr;

    const spotifyValue = sanitizeSocialUrl(body.spotify_url, ["open.spotify.com", "spotify.com"]);
    const spErr = validateSocialField(spotifyValue, body.spotify_url, "spotify_url", "Spotify");
    if (spErr) return spErr;

    const tiktokValue = sanitizeSocialUrl(body.tiktok_url, ["tiktok.com"]);
    const tkErr = validateSocialField(tiktokValue, body.tiktok_url, "tiktok_url", "TikTok");
    if (tkErr) return tkErr;

    const instagramValue = sanitizeSocialUrl(body.instagram_url, ["instagram.com"]);
    const bandcampValue = sanitizeSocialUrl(body.bandcamp_url, ["bandcamp.com"]);
    // facebook, twitter, website, paypal — no domain restriction
    const facebookValue = sanitizeSocialUrl(body.facebook_url);
    const twitterValue = sanitizeSocialUrl(body.twitter_url);
    const websiteValue = sanitizeSocialUrl(body.website_url);
    const paypalValue = sanitizeSocialUrl(body.paypal_url);
    const buymeacoffeeValue = sanitizeSocialUrl(body.buymeacoffee_url, ["buymeacoffee.com"]);
    const bmcErr = validateSocialField(buymeacoffeeValue, body.buymeacoffee_url, "buymeacoffee_url", "Buy Me a Coffee");
    if (bmcErr) return bmcErr;
    const patreonValue = sanitizeSocialUrl(body.patreon_url, ["patreon.com"]);
    const patErr = validateSocialField(patreonValue, body.patreon_url, "patreon_url", "Patreon");
    if (patErr) return patErr;

    const updatePayload = {
      full_name: body.full_name || null,
      bio: body.bio || null,
      city: body.city || null,
      state: body.state || null,
      is_songwriter: Boolean(body.is_songwriter),
      is_host: Boolean(body.is_host),
      is_studio: Boolean(body.is_studio),
      is_fan: Boolean(body.is_fan),
      is_public: body.is_public !== false,
      instagram_url: instagramValue,
      facebook_url: facebookValue,
      twitter_url: twitterValue,
      tiktok_url: tiktokValue,
      youtube_url: youtubeValue,
      spotify_url: spotifyValue,
      bandcamp_url: bandcampValue,
      website_url: websiteValue,
      venmo_handle: sanitizeSocialUrl(body.venmo_handle),
      cashapp_handle: sanitizeSocialUrl(body.cashapp_handle),
      paypal_url: paypalValue,
      buymeacoffee_url: buymeacoffeeValue,
      patreon_url: patreonValue,
      open_to_collabs: Boolean(body.open_to_collabs),
      specialties: Array.isArray(body.specialties) && body.specialties.length > 0 ? body.specialties : null,
      favorite_open_mic: body.favorite_open_mic || null,
      available_for_hire: Boolean(body.available_for_hire),
      interested_in_cowriting: Boolean(body.interested_in_cowriting),
      genres: Array.isArray(body.genres) && body.genres.length > 0 ? body.genres : null,
      instruments: Array.isArray(body.instruments) && body.instruments.length > 0 ? body.instruments : null,
      song_links: Array.isArray(body.song_links) && body.song_links.length > 0 ? body.song_links : null,
      featured_song_url: body.featured_song_url || null,
    };

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("slug, full_name, is_songwriter, is_host, is_studio, is_fan, bio, city, state, is_public, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url, spotify_url, bandcamp_url, website_url, venmo_handle, cashapp_handle, paypal_url, buymeacoffee_url, patreon_url, open_to_collabs, specialties, favorite_open_mic, available_for_hire, interested_in_cowriting, genres, instruments, song_links, featured_song_url")
      .eq("id", user.id)
      .single();

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select("id, full_name, slug, is_songwriter, is_host, is_studio, is_fan")
      .single();

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const embedWarnings: string[] = [];

    // Upsert ordered media embeds if provided
    if (Array.isArray(body.media_embed_urls)) {
      try {
        const embedResult = await upsertMediaEmbeds(
          supabase,
          { type: "profile", id: user.id },
          body.media_embed_urls,
          user.id
        );
        if (embedResult.errors.length > 0) {
          embedWarnings.push(
            ...embedResult.errors.map((e) => `Link ${e.index + 1}: ${e.message}`)
          );
        }
      } catch (embedError) {
        console.error("Media embeds upsert error:", embedError);
        embedWarnings.push(
          embedError instanceof Error
            ? `Could not save embedded players: ${embedError.message}`
            : "Could not save embedded players."
        );
      }
    }

    const changedFields = TRACKED_PROFILE_FIELDS.filter((field) =>
      !valuesEqual((existingProfile as Record<string, unknown> | null)?.[field], (updatePayload as Record<string, unknown>)[field])
    );

    if (changedFields.length > 0) {
      try {
        const identifier = updatedProfile.slug || updatedProfile.id;
        const profilePath = updatedProfile.is_studio
          ? `/studios/${identifier}`
          : (updatedProfile.is_songwriter || updatedProfile.is_host)
            ? `/songwriters/${identifier}`
            : `/members/${identifier}`;

        await sendAdminProfileAlert({
          type: "profile_update",
          userId: user.id,
          userEmail: user.email,
          userName: updatedProfile.full_name || existingProfile?.full_name || null,
          profileSlug: updatedProfile.slug || null,
          profilePath,
          changedFields,
        });
      } catch (alertError) {
        console.error("Admin profile update alert failed:", alertError);
      }
    }

    return NextResponse.json({
      success: true,
      ...(embedWarnings.length > 0 ? { embed_warnings: embedWarnings } : {}),
    });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
