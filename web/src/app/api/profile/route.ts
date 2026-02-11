import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendAdminProfileAlert } from "@/lib/email/adminProfileAlerts";
import { MediaEmbedValidationError, normalizeMediaEmbedUrl } from "@/lib/mediaEmbeds";

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
    const youtubeRaw = typeof body.youtube_url === "string" ? body.youtube_url.trim() : "";
    const spotifyRaw = typeof body.spotify_url === "string" ? body.spotify_url.trim() : "";

    let youtubeValue: string | null = youtubeRaw || null;
    let spotifyValue: string | null = spotifyRaw || null;

    try {
      if (youtubeRaw && /^https?:\/\//i.test(youtubeRaw)) {
        youtubeValue = normalizeMediaEmbedUrl(youtubeRaw, {
          expectedProvider: "youtube",
          field: "youtube_url",
        })?.normalized_url ?? null;
      }
      if (spotifyRaw && /^https?:\/\//i.test(spotifyRaw)) {
        spotifyValue = normalizeMediaEmbedUrl(spotifyRaw, {
          expectedProvider: "spotify",
          field: "spotify_url",
        })?.normalized_url ?? null;
      }
    } catch (error) {
      if (error instanceof MediaEmbedValidationError && error.field) {
        return NextResponse.json(
          { error: "Validation failed", fieldErrors: { [error.field]: error.message } },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Invalid media URL" }, { status: 400 });
    }

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
      instagram_url: body.instagram_url || null,
      facebook_url: body.facebook_url || null,
      twitter_url: body.twitter_url || null,
      tiktok_url: body.tiktok_url || null,
      youtube_url: youtubeValue,
      spotify_url: spotifyValue,
      bandcamp_url: body.bandcamp_url || null,
      website_url: body.website_url || null,
      venmo_handle: body.venmo_handle || null,
      cashapp_handle: body.cashapp_handle || null,
      paypal_url: body.paypal_url || null,
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
      .select("slug, full_name, is_songwriter, is_host, is_studio, is_fan, bio, city, state, is_public, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url, spotify_url, bandcamp_url, website_url, venmo_handle, cashapp_handle, paypal_url, open_to_collabs, specialties, favorite_open_mic, available_for_hire, interested_in_cowriting, genres, instruments, song_links, featured_song_url")
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
