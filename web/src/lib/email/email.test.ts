/**
 * Email Module Tests
 *
 * Tests for email templates, rendering, and mailer functionality.
 */

import { describe, it, expect } from "vitest";
import { getVerificationCodeEmail } from "./templates/verificationCode";
import { getClaimConfirmedEmail } from "./templates/claimConfirmed";
import { getWaitlistOfferEmail } from "./templates/waitlistOffer";
import { getGreeting, wrapEmailHtml, wrapEmailText } from "./render";

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
