// web/src/app/api/event-update-suggestions/route.ts

import { NextResponse } from "next/server";
import { insertEventUpdateSuggestion } from "@/lib/eventUpdateSuggestions/server";

// Allowed fields that can be suggested for update
const ALLOWED_FIELDS = [
  'title',
  'start_time',
  'signup_time',
  'end_time',
  'recurrence_rule',
  'day_of_week',
  'venue_name',
  'venue_address',
  'venue_city',
  'venue_state',
  'notes',
  'description',
  'category',
  'status',
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

    // Build payload (only accept a small set of fields)
    const payload = {
      event_id: body.event_id ?? null,
      submitter_email: body.submitter_email ?? null,
      submitter_name: body.submitter_name ?? null,
      field: String(body.field),
      old_value: body.old_value ?? null,
      new_value: String(body.new_value),
      notes: body.notes ?? null,
      // Ensure defaults for DB-not-null fields so TypeScript matches the insert type
      status: body.status ?? "pending",
      batch_id: body.batch_id ?? undefined,
    };

    const { data, error } = await insertEventUpdateSuggestion(payload as any);

    if (error) {
      console.error("insertEventUpdateSuggestion error:", error);
      return NextResponse.json({ error: error.message ?? error }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/event-update-suggestions:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
