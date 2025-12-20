// web/src/app/api/admin/event-update-suggestions/[id]/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { getSuggestionResponseEmail, type SuggestionStatus } from "@/lib/email/templates/suggestionResponse";

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

    type PatchBody = Partial<{ status: string; reviewed_by: string; admin_response: string }>;
    const body = (await request.json()) as PatchBody;
    const allowed: Partial<{ status: string; reviewed_by: string; admin_response: string }> = {};
    if (body.status) allowed.status = body.status;
    if (body.reviewed_by) allowed.reviewed_by = body.reviewed_by;
    if (body.admin_response) allowed.admin_response = body.admin_response;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // First fetch the current suggestion to get submitter info
    const { data: currentSuggestion } = await serviceClient
      .from('event_update_suggestions')
      .select('*, events(title)')
      .eq('id', id)
      .single();

    const { data, error } = await serviceClient
      .from('event_update_suggestions')
      .update({ ...allowed, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message ?? error }, { status: 500 });

    // Send email notification if submitter has email and status changed
    if (
      currentSuggestion?.submitter_email &&
      body.status &&
      ['approved', 'rejected', 'needs_info'].includes(body.status) &&
      isEmailConfigured()
    ) {
      const isNewEvent = currentSuggestion.field === '_new_event';

      // Parse event title from new_value if it's a new event submission
      let eventTitle = (currentSuggestion.events as { title?: string } | null)?.title;
      if (isNewEvent && currentSuggestion.new_value) {
        try {
          const parsed = JSON.parse(currentSuggestion.new_value);
          eventTitle = parsed.title || eventTitle;
        } catch {
          // Keep existing eventTitle
        }
      }

      const emailContent = getSuggestionResponseEmail({
        submitterName: currentSuggestion.submitter_name,
        status: body.status as SuggestionStatus,
        isNewEvent,
        eventTitle,
        adminMessage: body.admin_response || '',
      });

      try {
        await sendEmail({
          to: currentSuggestion.submitter_email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        console.log(`Sent suggestion response email to ${currentSuggestion.submitter_email}`);
      } catch (emailErr) {
        // Log but don't fail the request if email fails
        console.error('Failed to send suggestion response email:', emailErr);
      }
    }

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
