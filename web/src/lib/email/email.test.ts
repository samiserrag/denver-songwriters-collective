/**
 * Email Module Tests
 *
 * Tests for email templates, rendering, registry, and mailer functionality.
 * See docs/emails/EMAIL_INVENTORY.md for template documentation.
 */

import { describe, it, expect } from "vitest";

// Render utilities
import { getGreeting, wrapEmailHtml, wrapEmailText } from "./render";

// Registry
import {
  getTemplate,
  getAllTemplateKeys,
  getTemplateMetadata,
  TEMPLATE_REGISTRY,
} from "./registry";

// Guest templates
import { getVerificationCodeEmail } from "./templates/verificationCode";
import { getClaimConfirmedEmail } from "./templates/claimConfirmed";
import { getWaitlistOfferEmail } from "./templates/waitlistOffer";

// Member templates
import { getRsvpConfirmationEmail } from "./templates/rsvpConfirmation";
import { getWaitlistPromotionEmail } from "./templates/waitlistPromotion";
import { getHostApprovalEmail } from "./templates/hostApproval";
import { getHostRejectionEmail } from "./templates/hostRejection";

// Other templates
import { getContactNotificationEmail } from "./templates/contactNotification";
import { getNewsletterWelcomeEmail } from "./templates/newsletterWelcome";
import { getEventReminderEmail } from "./templates/eventReminder";
import { getEventUpdatedEmail } from "./templates/eventUpdated";
import { getEventCancelledEmail } from "./templates/eventCancelled";
import { getSuggestionResponseEmail } from "./templates/suggestionResponse";
import { getEventClaimSubmittedEmail } from "./templates/eventClaimSubmitted";
import { getEventClaimApprovedEmail } from "./templates/eventClaimApproved";
import { getEventClaimRejectedEmail } from "./templates/eventClaimRejected";
import { getAdminEventClaimNotificationEmail } from "./templates/adminEventClaimNotification";
import { getOccurrenceCancelledHostEmail } from "./templates/occurrenceCancelledHost";
import { getOccurrenceModifiedHostEmail } from "./templates/occurrenceModifiedHost";

describe("Email Templates", () => {
  describe("getVerificationCodeEmail", () => {
    it("generates correct subject with event title", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic at The Walnut Room",
        code: "ABC123",
        expiresInMinutes: 15,
      });

      expect(result.subject).toBe(
        "Your code for Open Mic at The Walnut Room — The Denver Songwriters Collective"
      );
    });

    it("includes code in HTML body", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        code: "XYZ789",
        expiresInMinutes: 15,
      });

      expect(result.html).toContain("XYZ789");
    });

    it("includes code in plain text body", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        code: "XYZ789",
        expiresInMinutes: 15,
      });

      expect(result.text).toContain("XYZ789");
    });

    it("includes expiry time in body", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        code: "ABC123",
        expiresInMinutes: 10,
      });

      expect(result.html).toContain("10 minutes");
      expect(result.text).toContain("10 minutes");
    });

    it("uses greeting with name when provided", () => {
      const result = getVerificationCodeEmail({
        guestName: "Sarah",
        eventTitle: "Open Mic",
        code: "ABC123",
        expiresInMinutes: 15,
      });

      expect(result.html).toContain("Hi Sarah,");
      expect(result.text).toContain("Hi Sarah,");
    });

    it("uses fallback greeting when name is null", () => {
      const result = getVerificationCodeEmail({
        guestName: null,
        eventTitle: "Open Mic",
        code: "ABC123",
        expiresInMinutes: 15,
      });

      expect(result.html).toContain("Hi there,");
      expect(result.text).toContain("Hi there,");
    });

    it("does not include full recipient email in body", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        code: "ABC123",
        expiresInMinutes: 15,
      });

      // Should not contain any email-like patterns
      expect(result.html).not.toMatch(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      expect(result.text).not.toMatch(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    });
  });

  describe("getClaimConfirmedEmail", () => {
    it("generates confirmed variant with slot number", () => {
      const result = getClaimConfirmedEmail({
        guestName: "John",
        eventTitle: "Open Mic Night",
        slotNumber: 3,
        cancelUrl: "https://example.com/cancel",
        status: "confirmed",
      });

      expect(result.subject).toBe(
        "You're on the lineup for Open Mic Night — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("slot #3");
      expect(result.text).toContain("slot #3");
    });

    it("generates waitlist variant with position", () => {
      const result = getClaimConfirmedEmail({
        guestName: "John",
        eventTitle: "Open Mic Night",
        cancelUrl: "https://example.com/cancel",
        status: "waitlist",
        waitlistPosition: 2,
      });

      expect(result.subject).toBe(
        "You're on the waitlist for Open Mic Night — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("#2");
      expect(result.text).toContain("#2");
    });

    it("includes cancel link in both variants", () => {
      const cancelUrl = "https://example.com/guest/action?token=abc123";

      const confirmed = getClaimConfirmedEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        cancelUrl,
        status: "confirmed",
      });

      const waitlist = getClaimConfirmedEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        cancelUrl,
        status: "waitlist",
      });

      expect(confirmed.html).toContain(cancelUrl);
      expect(confirmed.text).toContain(cancelUrl);
      expect(waitlist.html).toContain(cancelUrl);
      expect(waitlist.text).toContain(cancelUrl);
    });

    it("uses fallback greeting when name is empty string", () => {
      const result = getClaimConfirmedEmail({
        guestName: "   ",
        eventTitle: "Open Mic",
        cancelUrl: "https://example.com/cancel",
        status: "confirmed",
      });

      expect(result.html).toContain("Hi there,");
    });
  });

  describe("getWaitlistOfferEmail", () => {
    it("generates subject with event title", () => {
      const result = getWaitlistOfferEmail({
        guestName: "John",
        eventTitle: "Songwriter Showcase",
        confirmUrl: "https://example.com/confirm",
        cancelUrl: "https://example.com/cancel",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(result.subject).toBe(
        "A spot just opened up at Songwriter Showcase — The Denver Songwriters Collective"
      );
    });

    it("includes confirm and cancel URLs", () => {
      const confirmUrl = "https://example.com/confirm?token=abc";
      const cancelUrl = "https://example.com/cancel?token=xyz";

      const result = getWaitlistOfferEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        confirmUrl,
        cancelUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(result.html).toContain(confirmUrl);
      expect(result.html).toContain(cancelUrl);
      expect(result.text).toContain(confirmUrl);
      expect(result.text).toContain(cancelUrl);
    });

    it("includes formatted expiry time", () => {
      const expiresAt = new Date("2025-12-18T14:30:00Z").toISOString();

      const result = getWaitlistOfferEmail({
        guestName: "John",
        eventTitle: "Open Mic",
        confirmUrl: "https://example.com/confirm",
        cancelUrl: "https://example.com/cancel",
        expiresAt,
      });

      // Should contain some formatted date/time
      expect(result.html).toMatch(/Dec|December|12/);
      expect(result.text).toMatch(/Dec|December|12/);
    });
  });
});

describe("Email Rendering", () => {
  describe("getGreeting", () => {
    it("returns personalized greeting with name", () => {
      expect(getGreeting("John")).toBe("Hi John,");
    });

    it("escapes HTML in name", () => {
      expect(getGreeting("<script>alert(1)</script>")).toBe(
        "Hi &lt;script&gt;alert(1)&lt;/script&gt;,"
      );
    });

    it("returns fallback for null name", () => {
      expect(getGreeting(null)).toBe("Hi there,");
    });

    it("returns fallback for empty string", () => {
      expect(getGreeting("")).toBe("Hi there,");
    });

    it("returns fallback for whitespace-only name", () => {
      expect(getGreeting("   ")).toBe("Hi there,");
    });
  });

  describe("wrapEmailHtml", () => {
    it("includes Denver Songwriters Collective header", () => {
      const html = wrapEmailHtml("<p>Test content</p>");
      expect(html).toContain("Denver Songwriters Collective");
    });

    it("includes content in body", () => {
      const content = "<p>This is my test content</p>";
      const html = wrapEmailHtml(content);
      expect(html).toContain(content);
    });

    it("includes footer with reply message", () => {
      const html = wrapEmailHtml("<p>Test</p>");
      expect(html).toContain("You can reply directly to this email");
    });

    it("is valid HTML document", () => {
      const html = wrapEmailHtml("<p>Test</p>");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });
  });

  describe("wrapEmailText", () => {
    it("includes content", () => {
      const text = wrapEmailText("My test content");
      expect(text).toContain("My test content");
    });

    it("includes footer signature", () => {
      const text = wrapEmailText("Test");
      expect(text).toContain("Denver Songwriters Collective");
      expect(text).toContain("You can reply directly to this email");
    });
  });
});

describe("Email Security", () => {
  it("templates do not include sensitive patterns", () => {
    const templates = [
      getVerificationCodeEmail({
        guestName: "Test",
        eventTitle: "Event",
        code: "ABC123",
        expiresInMinutes: 15,
      }),
      getClaimConfirmedEmail({
        guestName: "Test",
        eventTitle: "Event",
        cancelUrl: "https://example.com/cancel",
        status: "confirmed",
      }),
      getWaitlistOfferEmail({
        guestName: "Test",
        eventTitle: "Event",
        confirmUrl: "https://example.com/confirm",
        cancelUrl: "https://example.com/cancel",
        expiresAt: new Date().toISOString(),
      }),
    ];

    for (const template of templates) {
      // Should not contain common sensitive patterns
      expect(template.html.toLowerCase()).not.toContain("password");
      expect(template.text.toLowerCase()).not.toContain("password");
      expect(template.html.toLowerCase()).not.toContain("smtp_");
      expect(template.text.toLowerCase()).not.toContain("smtp_");
    }
  });
});

describe("Email Registry", () => {
  it("has all expected template keys", () => {
    const keys = getAllTemplateKeys();
    expect(keys).toContain("verificationCode");
    expect(keys).toContain("claimConfirmed");
    expect(keys).toContain("waitlistOffer");
    expect(keys).toContain("rsvpConfirmation");
    expect(keys).toContain("waitlistPromotion");
    expect(keys).toContain("hostApproval");
    expect(keys).toContain("hostRejection");
    expect(keys).toContain("contactNotification");
    expect(keys).toContain("newsletterWelcome");
    expect(keys).toContain("eventReminder");
    expect(keys).toContain("eventUpdated");
    expect(keys).toContain("eventCancelled");
    expect(keys).toContain("suggestionResponse");
    expect(keys).toContain("eventClaimSubmitted");
    expect(keys).toContain("eventClaimApproved");
    expect(keys).toContain("eventClaimRejected");
    expect(keys).toContain("adminEventClaimNotification");
    expect(keys).toContain("adminSuggestionNotification");
    expect(keys).toContain("occurrenceCancelledHost");
    expect(keys).toContain("occurrenceModifiedHost");
    expect(keys).toContain("feedbackNotification");
    expect(keys).toContain("weeklyOpenMicsDigest");
    expect(keys).toContain("weeklyHappeningsDigest");
    expect(keys.length).toBe(23);
  });

  it("getTemplate returns valid output for all templates", () => {
    // Test each template via registry
    const verificationCode = getTemplate("verificationCode", {
      guestName: "Test",
      eventTitle: "Event",
      code: "ABC123",
      expiresInMinutes: 15,
    });
    expect(verificationCode.subject).toBeTruthy();
    expect(verificationCode.html).toBeTruthy();
    expect(verificationCode.text).toBeTruthy();

    const rsvpConfirmation = getTemplate("rsvpConfirmation", {
      eventTitle: "Event",
      eventDate: "Dec 20",
      eventTime: "7pm",
      venueName: "The Walnut Room",
      eventId: "123",
      isWaitlist: false,
    });
    expect(rsvpConfirmation.subject).toBeTruthy();
    expect(rsvpConfirmation.html).toBeTruthy();
    expect(rsvpConfirmation.text).toBeTruthy();
  });

  it("getTemplateMetadata returns correct metadata", () => {
    const metadata = getTemplateMetadata("verificationCode");
    expect(metadata.key).toBe("verificationCode");
    expect(metadata.name).toBe("Verification Code");
    expect(metadata.audience).toBe("guest");
    expect(metadata.requiresEventTitle).toBe(true);
  });

  it("TEMPLATE_REGISTRY has metadata for all keys", () => {
    const keys = getAllTemplateKeys();
    for (const key of keys) {
      expect(TEMPLATE_REGISTRY[key]).toBeDefined();
      expect(TEMPLATE_REGISTRY[key].key).toBe(key);
      expect(TEMPLATE_REGISTRY[key].name).toBeTruthy();
      expect(TEMPLATE_REGISTRY[key].description).toBeTruthy();
    }
  });
});

describe("New Email Templates", () => {
  describe("getRsvpConfirmationEmail", () => {
    it("generates confirmed variant", () => {
      const result = getRsvpConfirmationEmail({
        userName: "Sarah",
        eventTitle: "DSC Showcase",
        eventDate: "Dec 20, 2025",
        eventTime: "7:00 PM",
        venueName: "The Walnut Room",
        eventId: "abc123",
        isWaitlist: false,
      });

      expect(result.subject).toBe(
        "You're going to DSC Showcase — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Sarah,");
      expect(result.html).toContain("DSC Showcase");
      expect(result.html).toContain("Dec 20, 2025");
      expect(result.text).toContain("You're confirmed");
    });

    it("generates waitlist variant", () => {
      const result = getRsvpConfirmationEmail({
        eventTitle: "DSC Showcase",
        eventDate: "Dec 20, 2025",
        eventTime: "7:00 PM",
        venueName: "The Walnut Room",
        eventId: "abc123",
        isWaitlist: true,
        waitlistPosition: 3,
      });

      expect(result.subject).toBe(
        "You're on the waitlist for DSC Showcase — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("#3");
      expect(result.text).toContain("#3");
    });
  });

  describe("getWaitlistPromotionEmail", () => {
    it("generates subject with event title", () => {
      const result = getWaitlistPromotionEmail({
        userName: "John",
        eventTitle: "Open Mic Night",
        eventDate: "Dec 20",
        eventTime: "7pm",
        venueName: "The Walnut Room",
        eventId: "123",
        offerExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(result.subject).toBe(
        "A spot just opened up at Open Mic Night — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Confirm");
    });
  });

  describe("getHostApprovalEmail", () => {
    it("generates approval email", () => {
      const result = getHostApprovalEmail({
        userName: "Alex",
      });

      expect(result.subject).toBe(
        "You're approved as a host! — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Alex,");
      expect(result.html).toContain("host privileges");
      expect(result.text).toContain("Congratulations");
    });
  });

  describe("getHostRejectionEmail", () => {
    it("generates rejection email with reason", () => {
      const result = getHostRejectionEmail({
        userName: "Alex",
        reason: "Please complete your profile first",
      });

      expect(result.subject).toBe(
        "Update on your host application — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Alex,");
      expect(result.html).toContain("complete your profile");
      expect(result.text).toContain("reapply in the future");
    });

    it("generates rejection email without reason", () => {
      const result = getHostRejectionEmail({
        userName: "Alex",
      });

      expect(result.subject).toBe(
        "Update on your host application — The Denver Songwriters Collective"
      );
      expect(result.html).not.toContain("Feedback");
    });
  });

  describe("getContactNotificationEmail", () => {
    it("generates admin notification", () => {
      const result = getContactNotificationEmail({
        senderName: "Jane Doe",
        senderEmail: "jane@example.com",
        message: "I have a question about hosting.",
      });

      expect(result.subject).toBe("[DSC Contact] Message from Jane Doe");
      expect(result.html).toContain("Jane Doe");
      expect(result.html).toContain("jane@example.com");
      expect(result.html).toContain("question about hosting");
    });
  });

  describe("getNewsletterWelcomeEmail", () => {
    it("generates welcome email", () => {
      const result = getNewsletterWelcomeEmail();

      expect(result.subject).toBe("Welcome to The Denver Songwriters Collective!");
      expect(result.html).toContain("Open mics and songwriter events");
      expect(result.html).toContain("/happenings");
      expect(result.text).toContain("Tips and resources");
    });
  });

  describe("getEventReminderEmail", () => {
    it("generates tonight reminder", () => {
      const result = getEventReminderEmail({
        userName: "Pat",
        eventTitle: "Open Mic",
        eventDate: "Dec 20",
        eventTime: "7pm",
        venueName: "The Walnut Room",
        eventId: "123",
        reminderType: "tonight",
      });

      expect(result.subject).toBe("Reminder: Open Mic is tonight! — The Denver Songwriters Collective");
      expect(result.html).toContain("tonight");
    });

    it("generates tomorrow reminder with slot", () => {
      const result = getEventReminderEmail({
        userName: "Pat",
        eventTitle: "Open Mic",
        eventDate: "Dec 21",
        eventTime: "7pm",
        venueName: "The Walnut Room",
        eventId: "123",
        reminderType: "tomorrow",
        slotNumber: 5,
      });

      expect(result.subject).toBe("Reminder: Open Mic is tomorrow! — The Denver Songwriters Collective");
      expect(result.html).toContain("slot");
      expect(result.html).toContain("#5");
    });
  });

  describe("getEventUpdatedEmail", () => {
    it("generates update email with changes", () => {
      const result = getEventUpdatedEmail({
        userName: "Chris",
        eventTitle: "Songwriter Circle",
        eventId: "456",
        changes: {
          time: { old: "7pm", new: "8pm" },
          venue: { old: "Old Place", new: "New Venue" },
        },
        eventDate: "Dec 22",
        eventTime: "8pm",
        venueName: "New Venue",
      });

      expect(result.subject).toBe("Update: Songwriter Circle details have changed — The Denver Songwriters Collective");
      expect(result.html).toContain("7pm");
      expect(result.html).toContain("8pm");
      expect(result.html).toContain("Old Place");
      expect(result.html).toContain("New Venue");
    });
  });

  describe("getEventCancelledEmail", () => {
    it("generates cancellation email", () => {
      const result = getEventCancelledEmail({
        userName: "Sam",
        eventTitle: "Open Mic",
        eventDate: "Dec 25",
        venueName: "The Walnut Room",
        reason: "Due to weather conditions",
        hostName: "Host Name",
      });

      expect(result.subject).toBe("Cancelled: Open Mic on Dec 25 — The Denver Songwriters Collective");
      expect(result.html).toContain("cancelled");
      expect(result.html).toContain("weather conditions");
      expect(result.html).toContain("Host Name");
    });

    it("generates cancellation email without reason", () => {
      const result = getEventCancelledEmail({
        eventTitle: "Open Mic",
        eventDate: "Dec 25",
        venueName: "The Walnut Room",
      });

      expect(result.subject).toBe("Cancelled: Open Mic on Dec 25 — The Denver Songwriters Collective");
      expect(result.html).toContain("cancelled");
      expect(result.html).not.toContain("Note from");
    });
  });

  describe("getSuggestionResponseEmail", () => {
    it("generates approved email for new event", () => {
      const result = getSuggestionResponseEmail({
        submitterName: "Alex",
        status: "approved",
        isNewEvent: true,
        eventTitle: "Monday Night Mic",
        adminMessage: "This is a great addition!",
      });

      expect(result.subject).toBe(
        "Your open mic submission is live! — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Alex,");
      expect(result.html).toContain("Monday Night Mic");
      expect(result.html).toContain("This is a great addition!");
      expect(result.text).toContain("happenings?type=open_mic");
    });

    it("generates needs_info email - always says reply to email", () => {
      const result = getSuggestionResponseEmail({
        status: "needs_info",
        isNewEvent: false,
        adminMessage: "What time does it start?",
      });

      expect(result.subject).toBe(
        "Quick question about your suggestion — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("What time does it start?");
      // Always tell user to reply to email for more info
      expect(result.text).toContain("reply to this email");
      // Should NOT contain submit-open-mic link
      expect(result.text).not.toContain("submit-open-mic");
    });

    it("generates needs_info email with event link for reference", () => {
      const result = getSuggestionResponseEmail({
        status: "needs_info",
        isNewEvent: false,
        eventSlug: "test-open-mic",
        eventId: "uuid-123",
        adminMessage: "What time does it start?",
      });

      expect(result.subject).toBe(
        "Quick question about your suggestion — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("What time does it start?");
      // Event link shown for reference (View the happening)
      expect(result.text).toContain("/open-mics/test-open-mic");
      expect(result.text).toContain("View the happening");
      // But closing still says reply to email
      expect(result.text).toContain("reply to this email");
    });

    it("generates needs_info email for new event - no submit-open-mic link", () => {
      const result = getSuggestionResponseEmail({
        status: "needs_info",
        isNewEvent: true,
        adminMessage: "Please provide more details",
      });

      expect(result.subject).toBe(
        "Quick question about your open mic submission — The Denver Songwriters Collective"
      );
      // Always tell user to reply to email - no link to submit-open-mic
      expect(result.text).toContain("reply to this email");
      expect(result.text).not.toContain("submit-open-mic");
    });

    it("generates rejected email", () => {
      const result = getSuggestionResponseEmail({
        status: "rejected",
        isNewEvent: true,
        adminMessage: "This venue closed down.",
      });

      expect(result.subject).toBe(
        "About your open mic submission — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("This venue closed down.");
    });
  });

  describe("getEventClaimSubmittedEmail", () => {
    it("generates submitted email", () => {
      const result = getEventClaimSubmittedEmail({
        userName: "Alex",
        eventTitle: "Monday Night Mic",
      });

      expect(result.subject).toBe(
        "Your claim for Monday Night Mic is under review — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Alex,");
      expect(result.html).toContain("Monday Night Mic");
      expect(result.html).toContain("under review");
      expect(result.text).toContain("1-2 business days");
    });

    it("uses fallback greeting when name is null", () => {
      const result = getEventClaimSubmittedEmail({
        eventTitle: "Open Mic",
      });

      expect(result.html).toContain("Hi there,");
    });
  });

  describe("getEventClaimApprovedEmail", () => {
    it("generates approval email", () => {
      const result = getEventClaimApprovedEmail({
        userName: "Jordan",
        eventTitle: "Thursday Showcase",
        eventId: "123",
      });

      expect(result.subject).toBe(
        "You're now the host of Thursday Showcase — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Jordan,");
      expect(result.html).toContain("Thursday Showcase");
      expect(result.html).toContain("official host");
      expect(result.html).toContain("Welcome to the table");
      expect(result.text).toContain("Edit event details");
    });
  });

  describe("getEventClaimRejectedEmail", () => {
    it("generates rejection email with reason", () => {
      const result = getEventClaimRejectedEmail({
        userName: "Pat",
        eventTitle: "Open Mic Night",
        reason: "The current host is still active.",
      });

      expect(result.subject).toBe(
        "Update on your claim for Open Mic Night — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Pat,");
      expect(result.html).toContain("not able to approve");
      expect(result.html).toContain("current host is still active");
      expect(result.text).toContain("Feedback");
    });

    it("generates rejection email without reason", () => {
      const result = getEventClaimRejectedEmail({
        userName: "Pat",
        eventTitle: "Open Mic Night",
      });

      expect(result.subject).toBe(
        "Update on your claim for Open Mic Night — The Denver Songwriters Collective"
      );
      expect(result.html).not.toContain("Feedback");
    });
  });

  describe("getAdminEventClaimNotificationEmail", () => {
    it("generates admin notification", () => {
      const result = getAdminEventClaimNotificationEmail({
        requesterName: "Jane Doe",
        eventTitle: "Friday Night Mic",
        eventId: "456",
      });

      expect(result.subject).toBe("[DSC Claim] Jane Doe wants to host Friday Night Mic");
      expect(result.html).toContain("Jane Doe");
      expect(result.html).toContain("Friday Night Mic");
      expect(result.html).toContain("/dashboard/admin/claims");
      expect(result.text).toContain("Review claim");
    });

    it("does not include email addresses in body", () => {
      const result = getAdminEventClaimNotificationEmail({
        requesterName: "Jane Doe",
        eventTitle: "Open Mic",
        eventId: "789",
      });

      // Should not contain email-like patterns (except site domain)
      const unexpectedEmails = result.html.match(/@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const filtered = unexpectedEmails.filter(
        email => !email.includes("denversongwriterscollective")
      );
      expect(filtered).toEqual([]);
    });
  });

  describe("getOccurrenceCancelledHostEmail", () => {
    it("generates cancellation email for single occurrence", () => {
      const result = getOccurrenceCancelledHostEmail({
        userName: "Sam",
        eventTitle: "Weekly Jam",
        occurrenceDate: "Dec 25, 2025",
        venueName: "The Walnut Room",
        reason: "Holiday closure",
        hostName: "Alex",
        eventId: "123",
      });

      expect(result.subject).toBe(
        "Cancelled: Weekly Jam on Dec 25, 2025 — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Sam,");
      expect(result.html).toContain("Weekly Jam");
      expect(result.html).toContain("Dec 25, 2025 only");
      expect(result.html).toContain("Holiday closure");
      expect(result.html).toContain("Note from Alex");
      expect(result.text).toContain("regular series continues");
    });

    it("generates cancellation without reason", () => {
      const result = getOccurrenceCancelledHostEmail({
        eventTitle: "Open Mic",
        occurrenceDate: "Dec 30",
        venueName: "Venue",
        eventId: "456",
      });

      expect(result.html).not.toContain("Note from");
      expect(result.html).toContain("Dec 30 only");
    });
  });

  describe("getOccurrenceModifiedHostEmail", () => {
    it("generates modification email with time change", () => {
      const result = getOccurrenceModifiedHostEmail({
        userName: "Chris",
        eventTitle: "Songwriter Circle",
        occurrenceDate: "Dec 22, 2025",
        eventId: "789",
        changes: {
          time: { old: "7pm", new: "8pm" },
        },
        newTime: "8pm",
        venueName: "New Venue",
        notes: "Starting an hour later this week.",
      });

      expect(result.subject).toBe(
        "Update: Songwriter Circle on Dec 22, 2025 — The Denver Songwriters Collective"
      );
      expect(result.html).toContain("Hi Chris,");
      expect(result.html).toContain("Dec 22, 2025 only");
      expect(result.html).toContain("7pm");
      expect(result.html).toContain("8pm");
      expect(result.html).toContain("Starting an hour later");
      expect(result.text).toContain("Hope to see you there!");
    });

    it("generates modification email without changes", () => {
      const result = getOccurrenceModifiedHostEmail({
        eventTitle: "Open Mic",
        occurrenceDate: "Dec 28",
        eventId: "101",
        changes: {},
        venueName: "Venue",
      });

      expect(result.html).toContain("Dec 28 only");
      expect(result.html).not.toContain("What changed");
    });
  });
});

describe("All Templates - Common Requirements", () => {
  // Helper to get all templates with test params
  const getAllTemplateOutputs = () => [
    getVerificationCodeEmail({ guestName: "Test", eventTitle: "Event", code: "ABC123", expiresInMinutes: 15 }),
    getClaimConfirmedEmail({ guestName: "Test", eventTitle: "Event", cancelUrl: "https://example.com/cancel", status: "confirmed" }),
    getWaitlistOfferEmail({ guestName: "Test", eventTitle: "Event", confirmUrl: "https://example.com/confirm", cancelUrl: "https://example.com/cancel", expiresAt: new Date().toISOString() }),
    getRsvpConfirmationEmail({ eventTitle: "Event", eventDate: "Dec 20", eventTime: "7pm", venueName: "Venue", eventId: "123", isWaitlist: false }),
    getWaitlistPromotionEmail({ eventTitle: "Event", eventDate: "Dec 20", eventTime: "7pm", venueName: "Venue", eventId: "123" }),
    getHostApprovalEmail({ userName: "Test" }),
    getHostRejectionEmail({ userName: "Test" }),
    getContactNotificationEmail({ senderName: "Test", senderEmail: "test@example.com", message: "Hello" }),
    getNewsletterWelcomeEmail(),
    getEventReminderEmail({ eventTitle: "Event", eventDate: "Dec 20", eventTime: "7pm", venueName: "Venue", eventId: "123", reminderType: "tonight" }),
    getEventUpdatedEmail({ eventTitle: "Event", eventId: "123", changes: {}, eventDate: "Dec 20", eventTime: "7pm", venueName: "Venue" }),
    getEventCancelledEmail({ eventTitle: "Event", eventDate: "Dec 20", venueName: "Venue" }),
    getSuggestionResponseEmail({ status: "approved", isNewEvent: true, adminMessage: "Looks great!" }),
    getEventClaimSubmittedEmail({ userName: "Test", eventTitle: "Event" }),
    getEventClaimApprovedEmail({ userName: "Test", eventTitle: "Event", eventId: "123" }),
    getEventClaimRejectedEmail({ userName: "Test", eventTitle: "Event" }),
    getAdminEventClaimNotificationEmail({ requesterName: "Test", eventTitle: "Event", eventId: "123" }),
    getOccurrenceCancelledHostEmail({ userName: "Test", eventTitle: "Event", occurrenceDate: "Dec 20", venueName: "Venue", eventId: "123" }),
    getOccurrenceModifiedHostEmail({ userName: "Test", eventTitle: "Event", occurrenceDate: "Dec 20", eventId: "123", changes: {}, venueName: "Venue" }),
  ];

  it("all templates render both html and text", () => {
    const templates = getAllTemplateOutputs();
    for (const template of templates) {
      expect(template.html).toBeTruthy();
      expect(template.text).toBeTruthy();
      expect(template.html.length).toBeGreaterThan(100);
      expect(template.text.length).toBeGreaterThan(20);
    }
  });

  it("all templates have non-empty subjects", () => {
    const templates = getAllTemplateOutputs();
    for (const template of templates) {
      expect(template.subject).toBeTruthy();
      expect(template.subject.length).toBeGreaterThan(5);
    }
  });

  it("no template includes full recipient email in body", () => {
    const templates = getAllTemplateOutputs();
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    for (const template of templates) {
      // Find all emails in HTML
      const htmlEmails = template.html.match(emailPattern) || [];
      // Filter out expected emails (site domain, sender in contact notification)
      const unexpectedHtmlEmails = htmlEmails.filter(
        email => !email.includes("denversongwriterscollective") && !email.includes("example.com")
      );
      expect(unexpectedHtmlEmails).toEqual([]);
    }
  });

  it("greeting fallback works when name missing", () => {
    const withoutName = getVerificationCodeEmail({
      guestName: null,
      eventTitle: "Event",
      code: "ABC123",
      expiresInMinutes: 15,
    });
    expect(withoutName.html).toContain("Hi there,");
    expect(withoutName.text).toContain("Hi there,");

    const withEmptyName = getRsvpConfirmationEmail({
      userName: "   ",
      eventTitle: "Event",
      eventDate: "Dec 20",
      eventTime: "7pm",
      venueName: "Venue",
      eventId: "123",
      isWaitlist: false,
    });
    expect(withEmptyName.html).toContain("Hi there,");
  });
});
