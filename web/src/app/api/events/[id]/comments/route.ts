import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendEmailWithPreferences } from "@/lib/email/sendWithPreferences";
import { getEventCommentNotificationEmail } from "@/lib/email/templates/eventCommentNotification";

// GET - Get comments for event (includes replies)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch all visible comments (top-level and replies)
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
      user:profiles!event_comments_user_id_profiles_fkey(id, full_name, avatar_url, slug)
    `
    )
    .eq("event_id", eventId)
    .eq("is_hidden", false)
    .eq("is_host_only", false)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST - Create comment (authenticated members only)
// Guest comments go through /api/guest/event-comment/verify-code
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, parent_id } = await request.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  // Limit comment length to prevent abuse
  if (content.length > 2000) {
    return NextResponse.json({ error: "Comment too long (max 2000 characters)" }, { status: 400 });
  }

  // Rate limiting: Check how many comments user has posted in last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentCommentCount } = await supabase
    .from("event_comments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .gte("created_at", fiveMinutesAgo);

  // Limit to 10 comments per 5 minutes per user
  if ((recentCommentCount || 0) >= 10) {
    return NextResponse.json(
      { error: "Too many comments. Please wait a few minutes before posting again." },
      { status: 429 }
    );
  }

  // Verify event exists (no DSC gate - comments work on all events)
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, slug")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get commenter's profile for notification
  const { data: commenterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .single();

  const commenterName = commenterProfile?.full_name || "A member";

  // Insert the comment
  const { data, error } = await supabase
    .from("event_comments")
    .insert({
      event_id: eventId,
      user_id: session.user.id,
      content: content.trim(),
      parent_id: parent_id || null,
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
      user:profiles!event_comments_user_id_profiles_fkey(id, full_name, avatar_url, slug)
    `
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notifications (fire and forget - don't block response)
  const eventUrl = `/events/${event.slug || eventId}`;

  if (parent_id) {
    // Reply: notify parent comment author
    notifyParentCommentAuthor(
      supabase,
      parent_id,
      session.user.id,
      commenterName,
      event.title || "Event",
      eventUrl,
      content.trim()
    ).catch(err => console.error("Failed to notify parent comment author:", err));
  } else {
    // Top-level comment: notify event host(s)
    notifyEventHosts(
      supabase,
      eventId,
      session.user.id,
      commenterName,
      event.title || "Event",
      eventUrl,
      content.trim()
    ).catch(err => console.error("Failed to notify event hosts:", err));
  }

  return NextResponse.json(data);
}

/**
 * Notify event host(s) about a new comment
 * Phase 4.51a: Fan-out order: event_hosts → events.host_id → event_watchers (fallback)
 */
async function notifyEventHosts(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  eventId: string,
  commenterId: string,
  commenterName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string
) {
  const notifiedUserIds = new Set<string>();

  // 1. Check event_hosts table for accepted hosts
  const { data: hosts } = await supabase
    .from("event_hosts")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("invitation_status", "accepted");

  if (hosts && hosts.length > 0) {
    // Notify each host (except the commenter)
    for (const host of hosts) {
      if (host.user_id !== commenterId) {
        await notifyUser(supabase, host.user_id, commenterName, eventTitle, eventUrl, commentPreview, false);
        notifiedUserIds.add(host.user_id);
      }
    }
    // Hosts exist - don't fall through to watchers
    return;
  }

  // 2. Check events.host_id
  const { data: event } = await supabase
    .from("events")
    .select("host_id")
    .eq("id", eventId)
    .single();

  if (event?.host_id && event.host_id !== commenterId) {
    await notifyUser(supabase, event.host_id, commenterName, eventTitle, eventUrl, commentPreview, false);
    notifiedUserIds.add(event.host_id);
    // Host exists - don't fall through to watchers
    return;
  }

  // 3. Fallback to event_watchers (only if no hosts)
  const { data: watchers } = await supabase
    .from("event_watchers")
    .select("user_id")
    .eq("event_id", eventId);

  if (watchers && watchers.length > 0) {
    for (const watcher of watchers) {
      if (watcher.user_id !== commenterId && !notifiedUserIds.has(watcher.user_id)) {
        await notifyUser(supabase, watcher.user_id, commenterName, eventTitle, eventUrl, commentPreview, false);
      }
    }
  }
}

/**
 * Notify parent comment author about a reply
 */
async function notifyParentCommentAuthor(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  parentCommentId: string,
  replierId: string,
  replierName: string,
  eventTitle: string,
  eventUrl: string,
  replyPreview: string
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
    await notifyUser(supabase, parentComment.user_id, replierName, eventTitle, eventUrl, replyPreview, true);
  }
  // Guest comments don't get reply notifications (no account)
}

/**
 * Send dashboard notification + optional email to a user
 */
async function notifyUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  commenterName: string,
  eventTitle: string,
  eventUrl: string,
  commentPreview: string,
  isReply: boolean
) {
  const title = isReply
    ? `${commenterName} replied to your comment`
    : `New comment on "${eventTitle}"`;

  const message = isReply
    ? `${commenterName} replied to your comment on "${eventTitle}"`
    : `${commenterName} commented on your event`;

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
    eventUrl: `${process.env.NEXT_PUBLIC_SITE_URL}${eventUrl}#comments`,
    commenterName,
    commentPreview: commentPreview.slice(0, 200),
    isReply,
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
