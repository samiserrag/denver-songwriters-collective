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

    type PatchBody = Partial<{ status: string; reviewed_by: string; admin_response: string; edited_new_value: string }>;
    const body = (await request.json()) as PatchBody;
    const allowed: Partial<{ status: string; reviewed_by: string; admin_response: string; new_value: string }> = {};
    if (body.status) allowed.status = body.status;
    if (body.reviewed_by) allowed.reviewed_by = body.reviewed_by;
    if (body.admin_response) allowed.admin_response = body.admin_response;
    // If admin edited the value, update it in the suggestion record
    if (body.edited_new_value) allowed.new_value = body.edited_new_value;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // First fetch the current suggestion to get submitter info
    const { data: currentSuggestion } = await serviceClient
      .from('event_update_suggestions')
      .select('*, events(title, slug)')
      .eq('id', id)
      .single();

    const { data, error } = await serviceClient
      .from('event_update_suggestions')
      .update({ ...allowed, reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message ?? error }, { status: 500 });

    // If approved, apply the change to the event or occurrence override
    if (body.status === 'approved' && currentSuggestion?.event_id && currentSuggestion.field !== '_new_event') {
      const fieldToUpdate = currentSuggestion.field;
      // Use edited value if provided, otherwise use original suggestion value
      const newValue = body.edited_new_value || currentSuggestion.new_value;

      // Parse the scope from notes to determine if this is a date-specific update
      const notes = currentSuggestion.notes || '';
      const dateMatch = notes.match(/\[UPDATE SCOPE: This date only \((\d{4}-\d{2}-\d{2})\)\]/);
      const isDateSpecific = !!dateMatch;
      const dateKey = dateMatch ? dateMatch[1] : null;

      if (isDateSpecific && dateKey) {
        // For date-specific updates, create/update an occurrence override
        // Map field names to override column names
        const overrideFieldMap: Record<string, string> = {
          'start_time': 'override_start_time',
          'end_time': 'override_end_time',
          'status': 'status',
          'suggested_status': 'status',
        };

        const overrideField = overrideFieldMap[fieldToUpdate];

        if (overrideField) {
          // Check if override exists for this date
          const { data: existingOverride } = await serviceClient
            .from('occurrence_overrides')
            .select('id')
            .eq('event_id', currentSuggestion.event_id)
            .eq('date_key', dateKey)
            .maybeSingle();

          if (existingOverride) {
            // Update existing override
            const { error: overrideError } = await serviceClient
              .from('occurrence_overrides')
              .update({ [overrideField]: newValue })
              .eq('id', existingOverride.id);

            if (overrideError) {
              console.error('Failed to update occurrence override:', overrideError);
            } else {
              console.log(`Updated occurrence override for ${dateKey}: ${overrideField} = ${newValue}`);
            }
          } else {
            // Create new override
            const { error: overrideError } = await serviceClient
              .from('occurrence_overrides')
              .insert({
                event_id: currentSuggestion.event_id,
                date_key: dateKey,
                [overrideField]: newValue
              });

            if (overrideError) {
              console.error('Failed to create occurrence override:', overrideError);
            } else {
              console.log(`Created occurrence override for ${dateKey}: ${overrideField} = ${newValue}`);
            }
          }
        } else {
          // Field doesn't have an override mapping, apply to event directly with a note
          console.log(`Field ${fieldToUpdate} doesn't have override support, applying to event directly`);
          const { error: eventUpdateError } = await serviceClient
            .from('events')
            .update({ [fieldToUpdate]: newValue })
            .eq('id', currentSuggestion.event_id);

          if (eventUpdateError) {
            console.error('Failed to apply approved suggestion to event:', eventUpdateError);
          } else {
            console.log(`Applied approved suggestion: ${fieldToUpdate} = ${newValue} to event ${currentSuggestion.event_id}`);
          }
        }
      } else {
        // Series-wide update - apply directly to the event
        const { error: eventUpdateError } = await serviceClient
          .from('events')
          .update({ [fieldToUpdate]: newValue })
          .eq('id', currentSuggestion.event_id);

        if (eventUpdateError) {
          console.error('Failed to apply approved suggestion to event:', eventUpdateError);
          // Don't fail the request, but log the error
        } else {
          console.log(`Applied approved suggestion: ${fieldToUpdate} = ${newValue} to event ${currentSuggestion.event_id}`);
        }
      }
    }

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

      // Get event slug for the link
      const eventSlug = (currentSuggestion.events as { slug?: string } | null)?.slug;

      const emailContent = getSuggestionResponseEmail({
        submitterName: currentSuggestion.submitter_name,
        status: body.status as SuggestionStatus,
        isNewEvent,
        eventTitle,
        eventSlug,
        eventId: currentSuggestion.event_id,
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
