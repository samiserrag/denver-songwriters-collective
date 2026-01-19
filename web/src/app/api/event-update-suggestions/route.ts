// web/src/app/api/event-update-suggestions/route.ts

import { NextResponse } from "next/server";
import { insertEventUpdateSuggestion, EventUpdateSuggestionInsert } from "@/lib/eventUpdateSuggestions/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sendEmail, ADMIN_EMAIL, getAdminSuggestionNotificationEmail } from "@/lib/email";

// Allowed fields that can be suggested for update
// Phase 4.1: Expanded to include Phase 3/4 event fields
const ALLOWED_FIELDS = [
  // Basic info
  'title',
  'description',
  'category',
  'status',
  'notes',
  // Schedule
  'start_time',
  'end_time',
  'signup_time',
  'recurrence_rule',
  'day_of_week',
  // Location - venue
  'venue_name',
  'venue_address',
  'venue_city',
  'venue_state',
  // Location - custom (Phase 4.0)
  'location_mode',
  'online_url',
  'custom_location_name',
  'custom_address',
  'custom_city',
  'custom_state',
  'location_notes',
  // Cost (Phase 3.1)
  'is_free',
  'cost_label',
  // Signup (Phase 3.1)
  'signup_mode',
  'signup_url',
  // Age policy (Phase 3.1)
  'age_policy',
];

// Maximum length for text fields
const MAX_VALUE_LENGTH = 2000;
const MAX_NOTES_LENGTH = 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body?.event_id) {
      return NextResponse.json(
        { error: 'event_id is required' },
        { status: 400 }
      );
    }

    if (!body.field || typeof body.field !== 'string') {
      return NextResponse.json(
        { error: 'field is required and must be a string' },
        { status: 400 }
      );
    }

    if (!body.new_value || typeof body.new_value !== 'string') {
      return NextResponse.json(
        { error: 'new_value is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate field is in whitelist
    if (!ALLOWED_FIELDS.includes(body.field)) {
      return NextResponse.json(
        { error: `Invalid field. Allowed fields: ${ALLOWED_FIELDS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate lengths
    if (body.new_value.length > MAX_VALUE_LENGTH) {
      return NextResponse.json(
        { error: `new_value exceeds maximum length of ${MAX_VALUE_LENGTH}` },
        { status: 400 }
      );
    }

    if (body.notes && typeof body.notes === 'string' && body.notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `notes exceeds maximum length of ${MAX_NOTES_LENGTH}` },
        { status: 400 }
      );
    }

    // Validate event_id is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.event_id)) {
      return NextResponse.json(
        { error: 'event_id must be a valid UUID' },
        { status: 400 }
      );
    }

    // Build payload with proper typing
    const payload: EventUpdateSuggestionInsert = {
      event_id: body.event_id,
      submitter_email: body.submitter_email ?? null,
      submitter_name: body.submitter_name ?? null,
      field: body.field,
      old_value: body.old_value ?? null,
      new_value: body.new_value,
      notes: body.notes ?? null,
      status: body.status ?? "pending",
      batch_id: body.batch_id ?? undefined,
    };

    const { data, error } = await insertEventUpdateSuggestion(payload);

    if (error) {
      console.error("insertEventUpdateSuggestion error:", error);
      return NextResponse.json({ error: error.message ?? error }, { status: 500 });
    }

    // Send admin notification email
    try {
      const supabase = createServiceRoleClient();
      const { data: event } = await supabase
        .from("events")
        .select("title, slug")
        .eq("id", body.event_id)
        .single();

      if (event) {
        const emailContent = getAdminSuggestionNotificationEmail({
          submitterName: body.submitter_name ?? null,
          submitterEmail: body.submitter_email ?? null,
          eventTitle: event.title,
          eventId: body.event_id,
          eventSlug: event.slug,
          field: body.field,
          oldValue: body.old_value ?? null,
          newValue: body.new_value,
          notes: body.notes ?? null,
        });

        await sendEmail({
          to: ADMIN_EMAIL,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          templateName: "adminSuggestionNotification",
        });
      }
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error("Failed to send admin notification email:", emailError);
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/event-update-suggestions:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
