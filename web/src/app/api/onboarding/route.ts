import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  REFERRAL_COOKIE_NAME,
  deserializeReferralCookie,
  hasReferralParams,
} from '@/lib/referrals';

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

    const { data: existingProfile } = await serviceClient
      .from('profiles')
      .select('referred_by_profile_id, referral_via, referral_source, referral_captured_at')
      .eq('id', user.id)
      .maybeSingle();

    const shouldApplyReferral = hasReferralParams(referral);

    // 4. Update profile with all fields
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        full_name: full_name || null,
        is_songwriter,
        is_host,
        is_studio,
        is_fan,
        bio: bio || null,
        instagram_url: instagram_url || null,
        spotify_url: spotify_url || null,
        youtube_url: youtube_url || null,
        website_url: website_url || null,
        tiktok_url: tiktok_url || null,
        bandcamp_url: bandcamp_url || null,
        venmo_handle: venmo_handle || null,
        cashapp_handle: cashapp_handle || null,
        paypal_url: paypal_url || null,
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
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Onboarding update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });
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
