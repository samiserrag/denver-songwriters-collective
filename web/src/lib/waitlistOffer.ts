/**
 * Server-side waitlist offer utilities
 * For client-safe utilities, import from waitlistOfferClient.ts
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { getWaitlistPromotionEmail } from "@/lib/emailTemplates";
import {
  calculateOfferExpiry,
  isOfferExpired,
} from "@/lib/waitlistOfferClient";

// Re-export client utilities for server-side usage
export { calculateOfferExpiry, isOfferExpired, formatTimeRemaining } from "@/lib/waitlistOfferClient";

/**
 * Process expired offers for an event and promote next waitlist person
 * This is called opportunistically on page loads and mutations
 */
export async function processExpiredOffers(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ processed: number; promoted: string | null }> {
  // Find expired offers for this event
  const now = new Date().toISOString();
  const { data: expiredOffers, error: fetchError } = await supabase
    .from("event_rsvps")
    .select("id, user_id, offer_expires_at")
    .eq("event_id", eventId)
    .eq("status", "offered")
    .lt("offer_expires_at", now);

  if (fetchError || !expiredOffers || expiredOffers.length === 0) {
    return { processed: 0, promoted: null };
  }

  let promoted: string | null = null;

  for (const expiredOffer of expiredOffers) {
    // Move expired offer back to waitlist at the end
    const { data: lastWaitlist } = await supabase
      .from("event_rsvps")
      .select("waitlist_position")
      .eq("event_id", eventId)
      .eq("status", "waitlist")
      .order("waitlist_position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = (lastWaitlist?.waitlist_position || 0) + 1;

    await supabase
      .from("event_rsvps")
      .update({
        status: "waitlist",
        offer_expires_at: null,
        waitlist_position: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq("id", expiredOffer.id);

    // Promote next in line (skip the one we just moved back)
    const promotedId = await promoteNextWaitlistPerson(supabase, eventId, expiredOffer.id);
    if (promotedId && !promoted) {
      promoted = promotedId;
    }
  }

  return { processed: expiredOffers.length, promoted };
}

/**
 * Promote next waitlist person to "offered" status with 24-hour window
 * Returns the promoted RSVP ID if successful, null otherwise
 */
export async function promoteNextWaitlistPerson(
  supabase: SupabaseClient,
  eventId: string,
  excludeRsvpId?: string
): Promise<string | null> {
  // Get next person in waitlist
  let query = supabase
    .from("event_rsvps")
    .select("id, user_id")
    .eq("event_id", eventId)
    .eq("status", "waitlist")
    .order("waitlist_position", { ascending: true })
    .limit(1);

  if (excludeRsvpId) {
    query = query.neq("id", excludeRsvpId);
  }

  const { data: nextInLine } = await query.maybeSingle();

  if (!nextInLine) {
    return null;
  }

  const offerExpiresAt = calculateOfferExpiry();

  // Update to "offered" status with expiry
  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "offered",
      offer_expires_at: offerExpiresAt,
      waitlist_position: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nextInLine.id);

  if (updateError) {
    console.error("Failed to promote waitlist user:", updateError);
    return null;
  }

  return nextInLine.id;
}

/**
 * Send offer notification email and in-app notification
 */
export async function sendOfferNotifications(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  offerExpiresAt: string
): Promise<void> {
  // Get event details
  const { data: eventData } = await supabase
    .from("events")
    .select("title, slug, event_date, start_time, venue_name")
    .eq("id", eventId)
    .single();

  if (!eventData?.title) {
    console.error("Event not found for notifications:", eventId);
    return;
  }

  // Get user email
  const { data: userData } = await supabase.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email;

  // Prefer slug for SEO-friendly URLs, fallback to id
  const eventIdentifier = eventData.slug || eventId;

  // Send in-app notification
  const { error: notifyError } = await supabase.rpc("create_user_notification", {
    p_user_id: userId,
    p_type: "waitlist_offer",
    p_title: "A Spot Opened Up!",
    p_message: `A spot is available for "${eventData.title}". Confirm within 24 hours to secure it!`,
    p_link: `/events/${eventIdentifier}?confirm=true#rsvp`,
  });

  if (notifyError) {
    console.error("Failed to send waitlist offer notification:", notifyError);
  }

  // Send email
  if (userEmail) {
    try {
      const emailData = getWaitlistPromotionEmail({
        eventTitle: eventData.title,
        eventDate: eventData.event_date || "TBA",
        eventTime: eventData.start_time || "TBA",
        venueName: eventData.venue_name || "TBA",
        eventId,
        eventSlug: eventData.slug,
        offerExpiresAt,
      });

      await sendEmail({
        to: userEmail,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });
    } catch (emailError) {
      console.error("Failed to send waitlist offer email:", emailError);
    }
  }
}

/**
 * Confirm an offered spot (user accepting their offer)
 * Returns { success: true } or { error: string }
 */
export async function confirmOffer(
  supabase: SupabaseClient,
  eventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Get user's RSVP
  const { data: rsvp } = await supabase
    .from("event_rsvps")
    .select("id, status, offer_expires_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!rsvp) {
    return { success: false, error: "No RSVP found" };
  }

  // If already confirmed, success
  if (rsvp.status === "confirmed") {
    return { success: true };
  }

  // Must be in "offered" status
  if (rsvp.status !== "offered") {
    return { success: false, error: "No pending offer to confirm" };
  }

  // Check if offer expired
  if (isOfferExpired(rsvp.offer_expires_at)) {
    // Process the expiration
    await processExpiredOffers(supabase, eventId);
    return { success: false, error: "Your offer has expired. The spot has been offered to the next person." };
  }

  // Confirm the offer
  const { error: updateError } = await supabase
    .from("event_rsvps")
    .update({
      status: "confirmed",
      offer_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rsvp.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
