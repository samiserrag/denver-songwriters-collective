import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { NextResponse } from "next/server";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getEventCommentNotificationEmail } from "@/lib/email/templates/eventCommentNotification";
import {
  validateDateKeyForWrite,
  resolveEffectiveDateKey,
  dateKeyErrorResponse,
  formatDateKeyShort,
} from "@/lib/events/dateKeyContract";
import { SITE_URL } from "@/lib/email/render";
import { checkInviteeAccess } from "@/lib/attendee-session/checkInviteeAccess";

// GET - Get comments for event (includes replies)
// Phase ABC6: Comments are scoped by date_key for per-occurrence threads
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  // PR5: Check event visibility — gate invite-only events
  const eventAccess = await checkEventAccess(supabase, eventId);
  if (!eventAccess.allowed) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Phase ABC6: Get date_key from query params
  const url = new URL(request.url);
  const providedDateKey = url.searchParams.get("date_key");

  // Resolve effective date_key (compute if not provided)
  const dateKeyResult = await resolveEffectiveDateKey(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Fetch all visible comments (top-level and replies) for this occurrence
  // Client-side will organize into threads
  // Note: Uses event_comments_user_id_profiles_fkey for PostgREST join
  const { data, error } = await supabase
    .from("event_comments")
    .select(
      `
      id,
      content,
      created_at,
      parent_id,
      user_id,
      guest_name,
      guest_verified,
      is_deleted,
      is_hidden,
      date_key,
      user:profiles!event_comments_user_id_profiles_fkey(id, full_name, avatar_url, slug)
    `
    )
    .eq("event_id", eventId)
    .eq("date_key", effectiveDateKey)
    .eq("is_hidden", false)
    .eq("is_host_only", false)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase ABC6: Return date_key in response for client awareness
  return NextResponse.json({ comments: data, date_key: effectiveDateKey });
}

// POST - Create comment (authenticated members only)
// Guest comments go through /api/guest/event-comment/verify-code
// Phase ABC6: Comments are scoped by date_key for per-occurrence threads
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, parent_id, date_key: providedDateKey } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Limit comment length to prevent abuse
  if (content.length > 2000) {
    return NextResponse.json({ error: "Comment too long (max 2000 characters)" }, { status: 400 });
  }

  // Phase ABC6: Validate date_key and check for cancelled occurrence
  const dateKeyResult = await validateDateKeyForWrite(eventId, providedDateKey);
  if (!dateKeyResult.success) {
    return dateKeyErrorResponse(dateKeyResult.error);
  }
  const { effectiveDateKey } = dateKeyResult;

  // Rate limiting: Check how many comments user has posted in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentCommentCount } = await supabase
    .from("event_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", sessionUser.id)
    .gte("created_at", fiveMinutesAgo);

  // Limit to 10 comments per 5 minutes per user
  if ((recentCommentCount || 0) >= 10) {
    return NextResponse.json(
      { error: "Too many comments. Please wait a few minutes before posting again." },
      { status: 429 }
    );
  }

  // Verify event exists (no CSC gate - comments work on all events)
  // PR5: For invite-only events, try user-scoped first, then service-role + invitee check
  let event: { id: string; title: string | null; slug: string | null } | null = null;

  const { data: userScopedEvent } = await supabase
    .from("events")
    .select("id, title, slug, visibility")
    .eq("id", eventId)
    .single();

  if (userScopedEvent) {
    event = userScopedEvent;
  } else {
    // PR5: Check if it's an invite-only event the user is invited to
    const serviceClient = createServiceRoleClient();
    const { data: serviceEvent } = await serviceClient
      .from("events")
      .select("id, title, slug, visibility")
      .eq("id", eventId)
      .eq("visibility", "invite_only")
      .single();

    if (serviceEvent) {
      const inviteeResult = await checkInviteeAccess(eventId, sessionUser.id);
      if (inviteeResult.hasAccess) {
        event = serviceEvent;
      }
    }
  }

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get commenter's profile for notification
  const { data: commenterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", sessionUser.id)
    .single();

  const commenterName = commenterProfile?.full_name || "A member";

  // Insert the comment with date_key
  const { data, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: eventId,
      user_id: sessionUser.id,
      content: content.trim(),
      parent_id: parent_id || null,
      date_key: effectiveDateKey,
    })
    .select(
      `
      id,
      content,
      created_at,
      parent_id,
      user_id,
      guest_name,
      guest_verified,
      is_deleted,
      is_hidden,
      date_key,
      user:profiles!event_comments_user_id_profiles_fkey(id, full_name, avatar_url, slug)
    `
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase ABC6: Include date in event URL for per-occurrence deep-linking
  const eventUrl = `/events/${event.slug || eventId}?date=${effectiveDateKey}`;

  // Format occurrence date for notification message
  const occurrenceDateDisplay = formatDateKeyShort(effectiveDateKey);

  // Send notifications (fire and forget - don't block response)
  if (parent_id) {
    // Reply: notify parent comment author
    notifyParentCommentAuthor(
      supabase,
      parent_id,
      sessionUser.id,
      commenterName,
      event.title || "Event",
      eventUrl,
      content.trim(),
      occurrenceDateDisplay
    ).catch(err => console.error("Failed to notify parent comment author:", err));
  } else {
    // Top-level comment: notify event host(s)
    notifyEventHosts(
      supabase,
      eventId,
      sessionUser.id,
      commenterName,
      event.title || "Event",
      eventUrl,
      content.trim(),
      occurrenceDateDisplay
    ).catch(err => console.error("Failed to notify event hosts:", err));
  }

  // Phase ABC6: Return date_key in response
  return NextResponse.json({ comment: data, date_key: effectiveDateKey });
}

/**
 * Notify event host(s) AND watchers about a new comment
 * Phase 4.51d: Fan-out: event_hosts ∪ events.host_id ∪ event_watchers (union with dedupe)
 * Watchers are always notified regardless of host existence (opt-in monitoring).
 * Phase ABC6: Now includes occurrenceDate for per-occurrence context in notifications
 */
async function notifyEventHosts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  commenterId: string,
  commenterName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string,
  occurrenceDate?: string
) {
  const notifiedUserIds = new Set<string>();

  // 1. Notify event_hosts (accepted)
  const { data: hosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("invitation_status", "accepted");

  if (hosts && hosts.length > 0) {
    for (const host of hosts) {
      if (host.user_id !== commenterId && !notifiedUserIds.has(host.user_id)) {
        await notifyUser(supabase, host.user_id, commenterName, eventTitle, eventUrl, commentPreview, false, occurrenceDate);
        notifiedUserIds.add(host.user_id);
      }
    }
    // NO RETURN - continue to check host_id and watchers
  }

  // 2. Notify events.host_id (if not already notified)
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (event?.host_id && event.host_id !== commenterId && !notifiedUserIds.has(event.host_id)) {
    await notifyUser(supabase, event.host_id, commenterName, eventTitle, eventUrl, commentPreview, false, occurrenceDate);
    notifiedUserIds.add(event.host_id);
    // NO RETURN - continue to check watchers
  }

  // 3. Also notify event_watchers (if not already notified)
  const { data: watchers } = await supabase
    .from("event_watchers")
    .select("user_id")
    .eq("event_id", eventId);

  if (watchers && watchers.length > 0) {
    for (const watcher of watchers) {
      if (watcher.user_id !== commenterId && !notifiedUserIds.has(watcher.user_id)) {
        await notifyUser(supabase, watcher.user_id, commenterName, eventTitle, eventUrl, commentPreview, false, occurrenceDate);
        notifiedUserIds.add(watcher.user_id);
      }
    }
  }
}

/**
 * Notify parent comment author about a reply
 * Phase ABC6: Now includes occurrenceDate for per-occurrence context
 */
async function notifyParentCommentAuthor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  parentCommentId: string,
  replierId: string,
  replierName: string,
  eventTitle: string,
  eventUrl: string,
  replyPreview: string,
  occurrenceDate?: string
) {
  // Get parent comment author
  const { data: parentComment } = await supabase
    .from("event_comments")
    .select("user_id, guest_email")
    .eq("id", parentCommentId)
    .single();

  if (!parentComment) return;

  // If parent was a member (has user_id), notify them
  if (parentComment.user_id && parentComment.user_id !== replierId) {
    await notifyUser(supabase, parentComment.user_id, replierName, eventTitle, eventUrl, replyPreview, true, occurrenceDate);
  }
  // Guest comments don't get reply notifications (no account)
}

/**
 * Send dashboard notification + optional email to a user
 * Phase ABC6: Now includes occurrenceDate for per-occurrence context in messages
 */
async function notifyUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  commenterName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string,
  isReply: boolean,
  occurrenceDate?: string
) {
  // Phase ABC6: Include occurrence date in notification messages
  const dateText = occurrenceDate ? ` (${occurrenceDate})` : "";

  const title = isReply
    ? `${commenterName} replied to your comment`
    : `${commenterName} commented on "${eventTitle}"${dateText}`;

  const message = isReply
    ? `${commenterName} replied to your comment on "${eventTitle}"${dateText}`
    : `${commenterName} commented on your event${dateText}`;

  // Get user's email for email notification
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) return;

  // Use auth.admin to get email (profiles don't store email)
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  // Build email content
  const emailData = getEventCommentNotificationEmail({
    eventTitle,
    eventUrl: `${SITE_URL}${eventUrl}#comments`,
    commenterName,
    commentPreview: commentPreview.slice(0, 200),
    isReply,
    occurrenceDate, // Phase ABC6: Pass occurrence date to email template
  });

  // Send notification + email with preferences
  await sendEmailWithPreferences({
    supabase,
    userId,
    templateKey: "eventCommentNotification",
    payload: userEmail ? {
      to: userEmail,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    } : {
      to: "", // Will skip email if no address
      subject: "",
      html: "",
      text: "",
    },
    notification: {
      type: "event_comment",
      title,
      message,
      link: `${eventUrl}#comments`,
    },
  });
}

/**
 * PR5: Check if the current request has access to this event's comments.
 * For public events, always allowed.
 * For invite-only events, must be host/co-host/admin/accepted-invitee.
 *
 * Uses user-scoped RLS first (which covers public + host/admin).
 * If that fails, checks service-role for invite-only + invitee access.
 */
async function checkEventAccess(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string
): Promise<{ allowed: boolean }> {
  // Try user-scoped fetch (covers public events + hosts/co-hosts/admins via RLS)
  const { data: event } = await supabase
    .from("events")
    .select("id, visibility")
    .eq("id", eventId)
    .single();

  if (event) {
    return { allowed: true };
  }

  // User-scoped fetch failed — check if it's an invite-only event
  const serviceClient = createServiceRoleClient();
  const { data: serviceEvent } = await serviceClient
    .from("events")
    .select("id, visibility")
    .eq("id", eventId)
    .eq("visibility", "invite_only")
    .single();

  if (!serviceEvent) {
    return { allowed: false };
  }

  // It's invite-only — check invitee access
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  const inviteeResult = await checkInviteeAccess(
    eventId,
    sessionUser?.id ?? null
  );
  return { allowed: inviteeResult.hasAccess };
}
