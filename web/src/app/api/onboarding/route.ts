import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
      is_fan = false
    } = body;

    // 3. Use SERVICE ROLE to bypass RLS
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. Update profile
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({
        full_name: full_name || null,
        is_songwriter,
        is_host,
        is_studio,
        is_fan,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Onboarding update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Onboarding API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
