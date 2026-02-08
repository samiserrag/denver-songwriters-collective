/**
 * Email Preview Script - All Templates
 *
 * Generates sample HTML files for all email templates.
 * Run with: npx tsx scripts/preview-all-emails.ts
 * Then open: scripts/email-previews/index.html
 */

import * as fs from "fs";
import * as path from "path";

// Import all email templates
import { getVerificationCodeEmail } from "../src/lib/email/templates/verificationCode";
import { getRsvpConfirmationEmail } from "../src/lib/email/templates/rsvpConfirmation";
import { getHostApprovalEmail } from "../src/lib/email/templates/hostApproval";
import { getHostRejectionEmail } from "../src/lib/email/templates/hostRejection";
import { getEventReminderEmail } from "../src/lib/email/templates/eventReminder";
import { getEventUpdatedEmail } from "../src/lib/email/templates/eventUpdated";
import { getEventCancelledEmail } from "../src/lib/email/templates/eventCancelled";
import { getWaitlistOfferEmail } from "../src/lib/email/templates/waitlistOffer";
import { getWaitlistPromotionEmail } from "../src/lib/email/templates/waitlistPromotion";
import { getClaimConfirmedEmail } from "../src/lib/email/templates/claimConfirmed";
import { getNewsletterWelcomeEmail } from "../src/lib/email/templates/newsletterWelcome";
import { getContactNotificationEmail } from "../src/lib/email/templates/contactNotification";
import { getSuggestionResponseEmail } from "../src/lib/email/templates/suggestionResponse";
import { getEventClaimSubmittedEmail } from "../src/lib/email/templates/eventClaimSubmitted";
import { getEventClaimApprovedEmail } from "../src/lib/email/templates/eventClaimApproved";
import { getEventClaimRejectedEmail } from "../src/lib/email/templates/eventClaimRejected";
import { getAdminEventClaimNotificationEmail } from "../src/lib/email/templates/adminEventClaimNotification";
import { getOccurrenceCancelledHostEmail } from "../src/lib/email/templates/occurrenceCancelledHost";
import { getOccurrenceModifiedHostEmail } from "../src/lib/email/templates/occurrenceModifiedHost";

// Create output directory
const outputDir = path.join(__dirname, "email-previews");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate all email previews
const emails: { name: string; subject: string; html: string }[] = [
  {
    name: "verification-code",
    ...getVerificationCodeEmail({
      guestName: "Sam",
      eventTitle: "Open Mic at The Walnut Room",
      code: "ABC123",
    }),
  },
  {
    name: "rsvp-confirmation",
    ...getRsvpConfirmationEmail({
      userName: "Alex",
      eventTitle: "Songwriter Showcase",
      eventDate: "Friday, January 10",
      eventTime: "7:00 PM",
      venueName: "The Walnut Room",
      venueAddress: "3131 Walnut St, Denver, CO 80205",
      eventId: "abc123",
      slotNumber: 5,
    }),
  },
  {
    name: "host-approval",
    ...getHostApprovalEmail({
      userName: "Jordan",
    }),
  },
  {
    name: "host-rejection",
    ...getHostRejectionEmail({
      userName: "Taylor",
      feedback: "We'd love to see you build up a bit more of a presence in the community first. Try attending a few more open mics and connecting with other songwriters. We'd be happy to reconsider in a few months!",
    }),
  },
  {
    name: "event-reminder-tonight",
    ...getEventReminderEmail({
      userName: "Casey",
      eventTitle: "Open Mic Night",
      eventDate: "Tonight",
      eventTime: "7:30 PM",
      venueName: "Meadowlark",
      venueAddress: "2701 Larimer St, Denver, CO 80205",
      eventId: "event123",
      reminderType: "tonight",
      slotNumber: 3,
    }),
  },
  {
    name: "event-reminder-tomorrow",
    ...getEventReminderEmail({
      userName: "Morgan",
      eventTitle: "Songwriter Circle",
      eventDate: "Tomorrow, January 11",
      eventTime: "6:00 PM",
      venueName: "Mutiny Information Cafe",
      eventId: "event456",
      reminderType: "tomorrow",
    }),
  },
  {
    name: "event-updated",
    ...getEventUpdatedEmail({
      userName: "Riley",
      eventTitle: "Open Mic at Hi-Dive",
      eventId: "event789",
      changes: {
        time: { old: "7:00 PM", new: "8:00 PM" },
        venue: { old: "Hi-Dive", new: "Lost Lake Lounge" },
        address: { old: "7 S Broadway", new: "3602 E Colfax Ave" },
      },
      eventDate: "Saturday, January 18",
      eventTime: "8:00 PM",
      venueName: "Lost Lake Lounge",
      venueAddress: "3602 E Colfax Ave, Denver, CO 80206",
    }),
  },
  {
    name: "event-cancelled",
    ...getEventCancelledEmail({
      userName: "Jamie",
      eventTitle: "Acoustic Night",
      eventDate: "January 15",
      venueName: "The Walnut Room",
      reason: "Due to a scheduling conflict, we need to cancel this week's event. We'll be back next week with an even bigger show!",
      hostName: "Mike",
    }),
  },
  {
    name: "event-cancelled-no-reason",
    ...getEventCancelledEmail({
      eventTitle: "Open Mic Monday",
      eventDate: "January 20",
      venueName: "Meadowlark",
    }),
  },
  {
    name: "waitlist-offer",
    ...getWaitlistOfferEmail({
      guestName: "Chris",
      eventTitle: "Songwriter Showcase",
      confirmUrl: "https://coloradosongwriterscollective.org/confirm?token=abc123",
      cancelUrl: "https://coloradosongwriterscollective.org/cancel?token=abc123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }),
  },
  {
    name: "waitlist-promotion",
    ...getWaitlistPromotionEmail({
      userName: "Drew",
      eventTitle: "Open Mic Night",
      eventDate: "Friday, January 17",
      eventTime: "7:00 PM",
      venueName: "The Walnut Room",
      eventId: "promo123",
      offerExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }),
  },
  {
    name: "claim-confirmed",
    ...getClaimConfirmedEmail({
      guestName: "Pat",
      eventTitle: "Open Mic at Meadowlark",
      slotNumber: 7,
      cancelUrl: "https://coloradosongwriterscollective.org/cancel?token=xyz789",
      status: "confirmed",
    }),
  },
  {
    name: "claim-waitlist",
    ...getClaimConfirmedEmail({
      guestName: "Quinn",
      eventTitle: "Songwriter Circle",
      cancelUrl: "https://coloradosongwriterscollective.org/cancel?token=wait123",
      status: "waitlist",
      waitlistPosition: 3,
    }),
  },
  {
    name: "newsletter-welcome",
    ...getNewsletterWelcomeEmail(),
  },
  {
    name: "contact-notification",
    ...getContactNotificationEmail({
      senderName: "Sarah Johnson",
      senderEmail: "sarah@example.com",
      message: "Hi there!\n\nI'm a local songwriter and I'd love to learn more about hosting an open mic at my venue. We're a small coffee shop in the RiNo area and I think it would be a great fit.\n\nLet me know if you'd like to chat!\n\nBest,\nSarah",
    }),
  },
  {
    name: "suggestion-approved",
    ...getSuggestionResponseEmail({
      submitterName: "Alex",
      status: "approved",
      isNewEvent: false,
      adminMessage: "Thanks for the correction! We've updated the venue address.",
      eventSlug: "open-mic-walnut-room",
    }),
  },
  {
    name: "suggestion-rejected",
    ...getSuggestionResponseEmail({
      submitterName: "Jordan",
      status: "rejected",
      isNewEvent: true,
      adminMessage: "Thanks for the suggestion, but we weren't able to verify this venue hosts regular open mics. If you have more details, please resubmit!",
    }),
  },
  {
    name: "event-claim-submitted",
    ...getEventClaimSubmittedEmail({
      userName: "Robin",
      eventTitle: "Tuesday Night Open Mic",
    }),
  },
  {
    name: "event-claim-approved",
    ...getEventClaimApprovedEmail({
      userName: "Sage",
      eventTitle: "Wednesday Songwriter Circle",
      eventId: "claim789",
    }),
  },
  {
    name: "event-claim-rejected",
    ...getEventClaimRejectedEmail({
      userName: "Avery",
      eventTitle: "Thursday Open Mic",
      reason: "We couldn't verify your connection to this event. Please provide documentation showing you're the organizer and we'll be happy to reconsider.",
    }),
  },
  {
    name: "admin-claim-notification",
    ...getAdminEventClaimNotificationEmail({
      requesterName: "Cameron Smith",
      eventTitle: "Friday Night Open Mic at Lost Lake",
      eventId: "admin123",
    }),
  },
  {
    name: "occurrence-cancelled",
    ...getOccurrenceCancelledHostEmail({
      userName: "Reese",
      eventTitle: "Weekly Songwriter Circle",
      occurrenceDate: "January 22",
      venueName: "Mutiny Information Cafe",
      reason: "The venue has a private event this week. See you next Wednesday!",
      hostName: "Mike",
      eventId: "occur123",
    }),
  },
  {
    name: "occurrence-modified",
    ...getOccurrenceModifiedHostEmail({
      userName: "Finley",
      eventTitle: "Open Mic Mondays",
      occurrenceDate: "January 27",
      eventId: "occur456",
      changes: {
        time: { old: "7:00 PM", new: "8:00 PM" },
      },
      newTime: "8:00 PM",
      venueName: "The Walnut Room",
      notes: "Starting an hour later this week due to a special event beforehand. Doors still open at 7:30!",
    }),
  },
];

// Write individual preview files
for (const email of emails) {
  const filePath = path.join(outputDir, `${email.name}.html`);
  fs.writeFileSync(filePath, email.html);
}

// Generate index page
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSC Email Template Previews</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1e3a5f;
    }
    .subtitle {
      margin: 0 0 32px 0;
      color: #737373;
      font-size: 16px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .card a {
      display: block;
      text-decoration: none;
      color: inherit;
    }
    .card-header {
      background: #1e3a5f;
      color: white;
      padding: 16px 20px;
    }
    .card-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 20px;
    }
    .card-body p {
      margin: 0;
      font-size: 14px;
      color: #525252;
      line-height: 1.5;
    }
    .preview-frame {
      width: 100%;
      height: 200px;
      border: none;
      border-bottom: 1px solid #e5e5e5;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <h1>The Colorado Songwriters Collective</h1>
  <p class="subtitle">Email Template Previews — Navy Blue Theme</p>

  <div class="grid">
    ${emails
      .map(
        (email) => `
    <div class="card">
      <a href="${email.name}.html" target="_blank">
        <iframe class="preview-frame" src="${email.name}.html" loading="lazy"></iframe>
        <div class="card-header">
          <h2>${email.name.replace(/-/g, " ")}</h2>
        </div>
        <div class="card-body">
          <p>${email.subject}</p>
        </div>
      </a>
    </div>
    `
      )
      .join("")}
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, "index.html"), indexHtml);

console.log(`✅ Generated ${emails.length} email previews`);
console.log(`📂 Output directory: ${outputDir}`);
console.log(`🌐 Open: ${path.join(outputDir, "index.html")}`);
