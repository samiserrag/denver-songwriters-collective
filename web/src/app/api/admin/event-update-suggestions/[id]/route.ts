// web/src/app/api/admin/event-update-suggestions/[id]/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Use service role client for admin operations that bypass RLS
    const serviceClient = createServiceRoleClient();

    type PatchBody = Partial<{ status: string; reviewed_by: string }>;
    const body = (await request.json()) as PatchBody;
    const allowed: PatchBody = {};
    if (body.status) allowed.status = body.status;
    if (body.reviewed_by) allowed.reviewed_by = body.reviewed_by;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from('event_update_suggestions')
      .update({ ...allowed, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message ?? error }, { status: 500 });

    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Use service role client for admin operations that bypass RLS
    const serviceClient = createServiceRoleClient();

    const { error } = await serviceClient
      .from('event_update_suggestions')
      .delete()
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message ?? error }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
