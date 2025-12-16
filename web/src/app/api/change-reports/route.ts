import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Validation constants
const MAX_FIELD_NAME_LENGTH = 50;
const MAX_PROPOSED_VALUE_LENGTH = 500;
const MAX_NOTES_LENGTH = 1000;

// Valid field names that can be reported for changes
const VALID_FIELD_NAMES = [
  "title",
  "venue_name",
  "venue_address",
  "day_of_week",
  "start_time",
  "end_time",
  "signup_time",
  "description",
  "notes",
  "status", // e.g., "closed", "cancelled"
  "other",
];

// Strip HTML tags and sanitize to plain text
function sanitizeToPlainText(input: string): string {
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, "");
  // Decode common HTML entities
  sanitized = sanitized
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Trim whitespace
  return sanitized.trim();
}

interface ChangeReportBody {
  event_id: string;
  field_name: string;
  proposed_value: string;
  notes?: string;
  reporter_email?: string;
}

/**
 * POST /api/change-reports
 *
 * Allows anyone (authenticated or anonymous) to submit a change report
 * for an open mic event.
 *
 * Rate limiting: SKIPPED for v0.3.0 - will be implemented in a future version
 * if abuse becomes a concern. Consider using Vercel's rate limiting or
 * a middleware solution like upstash/ratelimit.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChangeReportBody;

    // Validate required fields
    if (!body.event_id) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 }
      );
    }

    if (!body.field_name) {
      return NextResponse.json(
        { error: "field_name is required" },
        { status: 400 }
      );
    }

    if (!body.proposed_value) {
      return NextResponse.json(
        { error: "proposed_value is required" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const fieldName = sanitizeToPlainText(body.field_name);
    const proposedValue = sanitizeToPlainText(body.proposed_value);
    const notes = body.notes ? sanitizeToPlainText(body.notes) : null;
    const reporterEmail = body.reporter_email
      ? sanitizeToPlainText(body.reporter_email)
      : null;

    // Validate field_name
    if (!VALID_FIELD_NAMES.includes(fieldName)) {
      return NextResponse.json(
        {
          error: `Invalid field_name. Must be one of: ${VALID_FIELD_NAMES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate lengths
    if (fieldName.length > MAX_FIELD_NAME_LENGTH) {
      return NextResponse.json(
        { error: `field_name must be ${MAX_FIELD_NAME_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    if (proposedValue.length > MAX_PROPOSED_VALUE_LENGTH) {
      return NextResponse.json(
        {
          error: `proposed_value must be ${MAX_PROPOSED_VALUE_LENGTH} characters or less`,
        },
        { status: 400 }
      );
    }

    if (notes && notes.length > MAX_NOTES_LENGTH) {
      return NextResponse.json(
        { error: `notes must be ${MAX_NOTES_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate UUID format for event_id
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.event_id)) {
      return NextResponse.json(
        { error: "Invalid event_id format" },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (reporterEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(reporterEmail)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    // Get Supabase client and check for authenticated user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify the event exists
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id")
      .eq("id", body.event_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Insert the change report
    // Cast to any because change_reports table is not yet in generated types
    const { data: changeReport, error: insertError } = await (supabase as any)
      .from("change_reports")
      .insert({
        event_id: body.event_id,
        field_name: fieldName,
        proposed_value: proposedValue,
        notes: notes,
        reporter_id: user?.id || null,
        reporter_email: reporterEmail,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting change report:", insertError);
      return NextResponse.json(
        { error: "Failed to submit change report" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Change report submitted successfully",
        id: changeReport.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in change reports API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
