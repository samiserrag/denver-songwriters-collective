import { escapeHtml } from "@/lib/highlight";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";

// Base email wrapper with consistent styling
function wrapEmail(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #171717; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #0a0a0a; font-size: 20px; font-weight: bold;">
                ${escapeHtml(title)}
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px; border-top: 1px solid #262626; text-align: center;">
              <p style="margin: 0; color: #525252; font-size: 12px;">
                Denver Songwriters Collective
              </p>
              <p style="margin: 8px 0 0 0; color: #525252; font-size: 11px;">
                <a href="${SITE_URL}" style="color: #d4a853; text-decoration: none;">denversongwriterscollective.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// RSVP Confirmation Email
export function getRsvpConfirmationEmail(params: {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  venueAddress?: string;
  eventId: string;
  isWaitlist: boolean;
  waitlistPosition?: number;
}): { html: string; text: string; subject: string } {
  const { eventTitle, eventDate, eventTime, venueName, venueAddress, eventId, isWaitlist, waitlistPosition } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);
  const safeAddress = venueAddress ? escapeHtml(venueAddress) : null;

  const statusMessage = isWaitlist
    ? `You're on the waitlist (position #${waitlistPosition}). We'll notify you if a spot opens up!`
    : "You're confirmed for this event!";

  const statusColor = isWaitlist ? "#f59e0b" : "#22c55e";
  const statusLabel = isWaitlist ? "Waitlisted" : "Confirmed";

  const content = `
    <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
      ${statusMessage}
    </p>

    <div style="background-color: #262626; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Event</p>
      <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; font-weight: 600;">${safeTitle}</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 16px; width: 50%;">
            <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</p>
            <p style="margin: 0; color: #d4a853; font-size: 15px;">${escapeHtml(eventDate)}</p>
          </td>
          <td style="width: 50%;">
            <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</p>
            <p style="margin: 0; color: #d4a853; font-size: 15px;">${escapeHtml(eventTime)}</p>
          </td>
        </tr>
      </table>

      <p style="margin: 16px 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Venue</p>
      <p style="margin: 0; color: #ffffff; font-size: 15px;">${safeVenue}</p>
      ${safeAddress ? `<p style="margin: 4px 0 0 0; color: #a3a3a3; font-size: 14px;">${safeAddress}</p>` : ""}

      <p style="margin: 16px 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Status</p>
      <span style="display: inline-block; padding: 4px 12px; background-color: ${statusColor}20; color: ${statusColor}; border-radius: 16px; font-size: 13px; font-weight: 500;">
        ${statusLabel}
      </span>
    </div>

    <table cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
      <tr>
        <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
          <a href="${SITE_URL}/events/${eventId}" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
            View Event Details
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; color: #737373; font-size: 13px;">
      Need to cancel? <a href="${SITE_URL}/events/${eventId}?cancel=true" style="color: #d4a853; text-decoration: none;">Cancel your RSVP</a>
    </p>
  `;

  const subject = isWaitlist
    ? `Waitlisted: ${eventTitle}`
    : `RSVP Confirmed: ${eventTitle}`;

  const text = `
${isWaitlist ? "You're on the Waitlist!" : "RSVP Confirmed!"}
${"=".repeat(30)}

${statusMessage}

Event: ${eventTitle}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${venueName}${venueAddress ? `\nAddress: ${venueAddress}` : ""}
Status: ${statusLabel}

View event: ${SITE_URL}/events/${eventId}

Need to cancel? ${SITE_URL}/events/${eventId}?cancel=true

---
Denver Songwriters Collective
`;

  return {
    html: wrapEmail(isWaitlist ? "You're on the Waitlist!" : "RSVP Confirmed!", content),
    text,
    subject,
  };
}

// Waitlist Promotion Email (Offer with 2-hour window)
export function getWaitlistPromotionEmail(params: {
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName: string;
  eventId: string;
  offerExpiresAt?: string; // ISO timestamp for when offer expires
}): { html: string; text: string; subject: string } {
  const { eventTitle, eventDate, eventTime, venueName, eventId, offerExpiresAt } = params;

  const safeTitle = escapeHtml(eventTitle);
  const safeVenue = escapeHtml(venueName);

  // Format expiry time for display
  let expiryMessage = "";
  if (offerExpiresAt) {
    const expiryDate = new Date(offerExpiresAt);
    const formattedExpiry = expiryDate.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
    expiryMessage = `This offer expires at ${formattedExpiry}. After that, the spot will be offered to the next person on the waitlist.`;
  }

  const content = `
    <p style="margin: 0 0 16px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
      Great news! A spot opened up for this event and you&apos;re next in line!
    </p>

    <div style="background-color: #f59e0b15; border: 1px solid #f59e0b30; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #f59e0b; font-size: 15px; font-weight: 600;">
        ⏰ Confirm within 2 hours to secure your spot
      </p>
      ${expiryMessage ? `<p style="margin: 0; color: #a3a3a3; font-size: 13px;">${expiryMessage}</p>` : ""}
    </div>

    <div style="background-color: #262626; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Event</p>
      <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 18px; font-weight: 600;">${safeTitle}</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right: 16px; width: 50%;">
            <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</p>
            <p style="margin: 0; color: #d4a853; font-size: 15px;">${escapeHtml(eventDate)}</p>
          </td>
          <td style="width: 50%;">
            <p style="margin: 0 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Time</p>
            <p style="margin: 0; color: #d4a853; font-size: 15px;">${escapeHtml(eventTime)}</p>
          </td>
        </tr>
      </table>

      <p style="margin: 16px 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Venue</p>
      <p style="margin: 0; color: #ffffff; font-size: 15px;">${safeVenue}</p>

      <p style="margin: 16px 0 4px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Status</p>
      <span style="display: inline-block; padding: 4px 12px; background-color: #f59e0b20; color: #f59e0b; border-radius: 16px; font-size: 13px; font-weight: 500;">
        Spot Offered - Action Required
      </span>
    </div>

    <table cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
      <tr>
        <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 8px;">
          <a href="${SITE_URL}/events/${eventId}?confirm=true" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
            Confirm My Spot
          </a>
        </td>
      </tr>
    </table>

    <p style="margin: 0; color: #737373; font-size: 13px;">
      Can&apos;t make it? <a href="${SITE_URL}/events/${eventId}?cancel=true" style="color: #d4a853; text-decoration: none;">Decline this offer</a> so the next person can attend.
    </p>
  `;

  const subject = `Action Required: Spot Available for ${eventTitle}`;

  const text = `
A Spot Opened Up!
${"=".repeat(30)}

Great news! A spot opened up for this event and you're next in line.

⏰ CONFIRM WITHIN 2 HOURS to secure your spot.
${expiryMessage}

Event: ${eventTitle}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${venueName}
Status: Spot Offered - Action Required

Confirm your spot: ${SITE_URL}/events/${eventId}?confirm=true

Can't make it? Decline so the next person can attend: ${SITE_URL}/events/${eventId}?cancel=true

---
Denver Songwriters Collective
`;

  return {
    html: wrapEmail("A Spot Opened Up!", content),
    text,
    subject,
  };
}

// Host Approval Email
export function getHostApprovalEmail(params: {
  userName: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(params.userName);

  const content = `
    <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px;">
      Hi ${safeName},
    </p>

    <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
      Congratulations! Your request to become a host has been approved. You can now create and manage events on the Denver Songwriters Collective platform.
    </p>

    <div style="background-color: #22c55e15; border: 1px solid #22c55e30; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; color: #22c55e; font-size: 15px; font-weight: 500;">
        Your host privileges are now active!
      </p>
    </div>

    <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
      As a host, you can:
    </p>
    <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #a3a3a3; font-size: 15px; line-height: 1.8;">
      <li>Create and manage your own events</li>
      <li>Track RSVPs and attendance</li>
      <li>Be featured in the community directory</li>
    </ul>

    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
          <a href="${SITE_URL}/dashboard/my-events" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
            Create Your First Event
          </a>
        </td>
      </tr>
    </table>
  `;

  const subject = "You're Approved as a Host!";

  const text = `
You're Approved as a Host!
${"=".repeat(30)}

Hi ${params.userName},

Congratulations! Your request to become a host has been approved. You can now create and manage events on the Denver Songwriters Collective platform.

As a host, you can:
- Create and manage your own events
- Track RSVPs and attendance
- Be featured in the community directory

Get started: ${SITE_URL}/dashboard/my-events

---
Denver Songwriters Collective
`;

  return {
    html: wrapEmail("You're Approved as a Host!", content),
    text,
    subject,
  };
}

// Host Rejection Email
export function getHostRejectionEmail(params: {
  userName: string;
  reason?: string;
}): { html: string; text: string; subject: string } {
  const safeName = escapeHtml(params.userName);
  const safeReason = params.reason ? escapeHtml(params.reason) : null;

  const content = `
    <p style="margin: 0 0 16px 0; color: #ffffff; font-size: 16px;">
      Hi ${safeName},
    </p>

    <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
      Thank you for your interest in becoming a host with the Denver Songwriters Collective. After reviewing your application, we're unable to approve your host request at this time.
    </p>

    ${safeReason ? `
    <div style="background-color: #262626; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px 0; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Feedback</p>
      <p style="margin: 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">${safeReason}</p>
    </div>
    ` : ""}

    <p style="margin: 0 0 24px 0; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
      You're welcome to reapply in the future. In the meantime, we encourage you to stay active in the community!
    </p>

    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="background: linear-gradient(135deg, #d4a853 0%, #b8943f 100%); border-radius: 8px;">
          <a href="${SITE_URL}/open-mics" style="display: inline-block; padding: 12px 24px; color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px;">
            Explore Open Mics
          </a>
        </td>
      </tr>
    </table>
  `;

  const subject = "Update on Your Host Application";

  const text = `
Update on Your Host Application
${"=".repeat(30)}

Hi ${params.userName},

Thank you for your interest in becoming a host with the Denver Songwriters Collective. After reviewing your application, we're unable to approve your host request at this time.

${params.reason ? `Feedback: ${params.reason}\n` : ""}
You're welcome to reapply in the future. In the meantime, we encourage you to stay active in the community!

Explore open mics: ${SITE_URL}/open-mics

---
Denver Songwriters Collective
`;

  return {
    html: wrapEmail("Update on Your Host Application", content),
    text,
    subject,
  };
}
