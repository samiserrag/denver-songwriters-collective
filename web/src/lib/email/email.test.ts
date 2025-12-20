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
  type EmailTemplateKey,
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

describe("Email Templates", () => {
  describe("getVerificationCodeEmail", () => {
    it("generates correct subject with event title", () => {
      const result = getVerificationCodeEmail({
        guestName: "John",
        eventTitle: "Open Mic at The Walnut Room",
        code: "ABC123",
        expiresInMinutes: 15,
      });

      expect(result.subject).toBe("Your code for Open Mic at The Walnut Room");
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

      expect(result.subject).toBe("You're on the lineup for Open Mic Night");
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

      expect(result.subject).toBe("You're on the waitlist for Open Mic Night");
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

      expect(result.subject).toBe("A spot just opened up at Songwriter Showcase");
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
    expect(keys.length).toBe(12);
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

      expect(result.subject).toBe("You're going to DSC Showcase");
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

      expect(result.subject).toBe("You're on the waitlist for DSC Showcase");
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

      expect(result.subject).toBe("A spot just opened up at Open Mic Night");
      expect(result.html).toContain("Confirm");
    });
  });

  describe("getHostApprovalEmail", () => {
    it("generates approval email", () => {
      const result = getHostApprovalEmail({
        userName: "Alex",
      });

      expect(result.subject).toBe("You're approved as a host!");
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

      expect(result.subject).toBe("Update on your host application");
      expect(result.html).toContain("Hi Alex,");
      expect(result.html).toContain("complete your profile");
      expect(result.text).toContain("reapply in the future");
    });

    it("generates rejection email without reason", () => {
      const result = getHostRejectionEmail({
        userName: "Alex",
      });

      expect(result.subject).toBe("Update on your host application");
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

      expect(result.subject).toBe("Welcome to the Denver Songwriters Collective!");
      expect(result.html).toContain("Weekly roundups");
      expect(result.html).toContain("open-mics");
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

      expect(result.subject).toBe("Reminder: Open Mic is tonight!");
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

      expect(result.subject).toBe("Reminder: Open Mic is tomorrow!");
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

      expect(result.subject).toBe("Update: Songwriter Circle details have changed");
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

      expect(result.subject).toBe("Cancelled: Open Mic on Dec 25");
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

      expect(result.subject).toBe("Cancelled: Open Mic on Dec 25");
      expect(result.html).toContain("cancelled");
      expect(result.html).not.toContain("Note from");
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
