import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sendAdminProfileAlert } from '@/lib/email/adminProfileAlerts';
import {
  REFERRAL_COOKIE_NAME,
  deserializeReferralCookie,
  hasReferralParams,
} from '@/lib/referrals';
import { upsertMediaEmbeds } from '@/lib/mediaEmbedsServer';

/** Trim, convert blanks to null, optionally validate against allowed hosts. */
function sanitizeSocialUrl(raw: unknown, allowedHosts?: string[]): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    if (allowedHosts) {
      if (trimmed.includes(".")) {
        return sanitizeSocialUrl(`https://${trimmed}`, allowedHosts);
      }
      return null;
    }
    return trimmed;
  }

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

export async function POST(request: Request) {
  try {
    // 1. Verify user is logged in
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const {
      full_name,
      is_songwriter = false,
      is_host = false,
      is_studio = false,
      is_fan = false,
      bio,
      instagram_url,
      spotify_url,
      youtube_url,
      website_url,
      tiktok_url,
      bandcamp_url,
      venmo_handle,
      cashapp_handle,
      paypal_url,
      open_to_collabs = false,
      interested_in_cowriting = false,
      instruments,
      genres,
    } = body;
    const cookieStore = await cookies();
    const referralCookie = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
    const referral = deserializeReferralCookie(referralCookie);

    // 3. Use SERVICE ROLE to bypass RLS
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const embedWarnings: string[] = [];

    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('referred_by_profile_id, referral_via, referral_source, referral_captured_at, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();

    const shouldApplyReferral = hasReferralParams(referral);
    const profileUpdatePayload = {
      full_name: full_name || null,
      is_songwriter,
      is_host,
      is_studio,
      is_fan,
      bio: bio || null,
      instagram_url: sanitizeSocialUrl(instagram_url, ["instagram.com"]),
      spotify_url: sanitizeSocialUrl(spotify_url, ["open.spotify.com", "spotify.com"]),
      youtube_url: sanitizeSocialUrl(youtube_url, ["youtube.com", "youtu.be"]),
      website_url: sanitizeSocialUrl(website_url),
      tiktok_url: sanitizeSocialUrl(tiktok_url, ["tiktok.com"]),
      bandcamp_url: sanitizeSocialUrl(bandcamp_url, ["bandcamp.com"]),
      venmo_handle: sanitizeSocialUrl(venmo_handle),
      cashapp_handle: sanitizeSocialUrl(cashapp_handle),
      paypal_url: sanitizeSocialUrl(paypal_url),
      open_to_collabs,
      interested_in_cowriting,
      instruments: instruments?.length > 0 ? instruments : null,
      genres: genres?.length > 0 ? genres : null,
      referred_by_profile_id: shouldApplyReferral
        ? (existingProfile?.referred_by_profile_id ?? referral.ref ?? null)
        : undefined,
      referral_via: shouldApplyReferral
        ? (existingProfile?.referral_via ?? referral.via ?? null)
        : undefined,
      referral_source: shouldApplyReferral
        ? (existingProfile?.referral_source ?? referral.src ?? null)
        : undefined,
      referral_captured_at: shouldApplyReferral
        ? (existingProfile?.referral_captured_at ?? new Date().toISOString())
        : undefined,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    };

    // 4. Update profile with all fields
    const { data: updatedProfile, error: updateError } = await serviceClient
      .from('profiles')
      .update(profileUpdatePayload)
      .eq('id', user.id)
      .select('full_name, slug')
      .single();

    if (updateError) {
      console.error('Onboarding update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Upsert ordered media embeds if provided
    if (Array.isArray(body.media_embed_urls)) {
      try {
        const embedResult = await upsertMediaEmbeds(
          serviceClient,
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
        console.error("Onboarding media embeds upsert error:", embedError);
        embedWarnings.push(
          embedError instanceof Error
            ? `Could not save embedded players: ${embedError.message}`
            : "Could not save embedded players."
        );
      }
    }

    // Growth tracking: alert admin when signup completes (first onboarding)
    // and when onboarding profile is updated later.
    try {
      const profileIdentifier = updatedProfile?.slug || user.id;
      const profilePath = is_studio
        ? `/studios/${profileIdentifier}`
        : (is_songwriter || is_host)
          ? `/songwriters/${profileIdentifier}`
          : `/members/${profileIdentifier}`;
      const isInitialSignup = !existingProfile?.onboarding_complete;

      await sendAdminProfileAlert({
        type: isInitialSignup ? 'signup' : 'profile_update',
        userId: user.id,
        userEmail: user.email,
        userName: updatedProfile?.full_name || full_name || null,
        profileSlug: updatedProfile?.slug || null,
        profilePath,
      });
    } catch (alertError) {
      console.error('Admin onboarding alert failed:', alertError);
    }

    const response = NextResponse.json({
      success: true,
      ...(embedWarnings.length > 0 ? { embed_warnings: embedWarnings } : {}),
    });
    if (referralCookie) {
      response.cookies.set({
        name: REFERRAL_COOKIE_NAME,
        value: '',
        path: '/',
        maxAge: 0,
      });
    }
    return response;
  } catch (err) {
    console.error('Onboarding API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
