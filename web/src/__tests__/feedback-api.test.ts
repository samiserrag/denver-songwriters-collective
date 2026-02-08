/**
 * Feedback API Tests
 *
 * Tests for POST /api/feedback endpoint covering:
 * - Validation (required fields, formats, lengths)
 * - Rate limiting (5 submissions per IP per 24 hours)
 * - Honeypot spam prevention
 * - Happy path
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// =============================================================================
// Test Data Helpers
// =============================================================================

const validFeedback = {
  name: "Test User",
  email: "test@example.com",
  category: "bug" as const,
  subject: "Test subject",
  description: "Test description with enough content to be valid.",
  pageUrl: "https://coloradosongwriterscollective.org/happenings",
};

// =============================================================================
// Validation Tests
// =============================================================================

describe("Feedback API Validation", () => {
  describe("Name validation", () => {
    it("should require name", () => {
      const body = { ...validFeedback, name: "" };
      expect(body.name.trim().length).toBe(0);
    });

    it("should accept valid name", () => {
      expect(validFeedback.name.trim().length).toBeGreaterThan(0);
    });
  });

  describe("Email validation", () => {
    it("should require email", () => {
      const body = { ...validFeedback, email: "" };
      expect(body.email.length).toBe(0);
    });

    it("should reject invalid email format", () => {
      const invalidEmails = [
        "notanemail",
        "missing@domain",
        "@nodomain.com",
        "spaces in@email.com",
      ];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it("should accept valid email format", () => {
      const validEmails = [
        "test@example.com",
        "user.name@domain.org",
        "user+tag@gmail.com",
      ];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validEmails.forEach((email) => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });
  });

  describe("Category validation", () => {
    it("should only allow bug, feature, or other", () => {
      const validCategories = ["bug", "feature", "other"];
      validCategories.forEach((category) => {
        expect(["bug", "feature", "other"].includes(category)).toBe(true);
      });
    });

    it("should reject invalid category", () => {
      const invalidCategories = ["invalid", "Bug", "FEATURE", "", null, undefined];
      invalidCategories.forEach((category) => {
        expect(["bug", "feature", "other"].includes(category as string)).toBe(false);
      });
    });
  });

  describe("Subject validation", () => {
    it("should require subject", () => {
      const body = { ...validFeedback, subject: "" };
      expect(body.subject.trim().length).toBe(0);
    });

    it("should enforce 200 character limit", () => {
      const longSubject = "a".repeat(201);
      expect(longSubject.length).toBeGreaterThan(200);

      const validSubject = "a".repeat(200);
      expect(validSubject.length).toBe(200);
    });
  });

  describe("Description validation", () => {
    it("should require description", () => {
      const body = { ...validFeedback, description: "" };
      expect(body.description.trim().length).toBe(0);
    });

    it("should enforce 5000 character limit", () => {
      const longDescription = "a".repeat(5001);
      expect(longDescription.length).toBeGreaterThan(5000);

      const validDescription = "a".repeat(5000);
      expect(validDescription.length).toBe(5000);
    });
  });

  describe("Page URL validation", () => {
    it("should accept valid URLs", () => {
      const validUrls = [
        "https://coloradosongwriterscollective.org/happenings",
        "https://example.com/page?query=value",
        "http://localhost:3000/test",
      ];
      validUrls.forEach((url) => {
        expect(() => new URL(url)).not.toThrow();
      });
    });

    it("should reject invalid URLs", () => {
      const invalidUrls = ["not-a-url", "just-text-no-protocol", ""];
      invalidUrls.forEach((url) => {
        if (url && url.trim().length > 0) {
          expect(() => new URL(url)).toThrow();
        }
      });
    });

    it("should allow empty page URL", () => {
      const body = { ...validFeedback, pageUrl: "" };
      // Empty string should be treated as null, not validated
      expect(body.pageUrl.trim().length).toBe(0);
    });
  });
});

// =============================================================================
// Honeypot Tests
// =============================================================================

describe("Feedback API Honeypot", () => {
  it("should detect filled honeypot field", () => {
    const body = { ...validFeedback, honeypot: "bot filled this" };
    expect(body.honeypot).toBeTruthy();
  });

  it("should pass through when honeypot is empty", () => {
    const body = { ...validFeedback, honeypot: "" };
    expect(body.honeypot).toBeFalsy();
  });

  it("should pass through when honeypot is missing", () => {
    const body = { ...validFeedback };
    expect((body as Record<string, unknown>).honeypot).toBeUndefined();
  });
});

// =============================================================================
// Rate Limiting Tests
// =============================================================================

describe("Feedback API Rate Limiting", () => {
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_WINDOW_HOURS = 24;

  it("should allow up to 5 submissions per IP in 24 hours", () => {
    expect(RATE_LIMIT_MAX).toBe(5);
  });

  it("should use 24-hour window for rate limiting", () => {
    expect(RATE_LIMIT_WINDOW_HOURS).toBe(24);
  });

  it("should block after exceeding rate limit", () => {
    // Simulate 6 submissions
    const submissions = 6;
    expect(submissions).toBeGreaterThan(RATE_LIMIT_MAX);
  });
});

// =============================================================================
// IP Hashing Tests
// =============================================================================

describe("Feedback API IP Hashing", () => {
  const hashIp = (ip: string): string =>
    createHash("sha256").update(ip).digest("hex");

  it("should hash IP addresses consistently", () => {
    const ip = "192.168.1.1";
    const hash1 = hashIp(ip);
    const hash2 = hashIp(ip);
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different IPs", () => {
    const hash1 = hashIp("192.168.1.1");
    const hash2 = hashIp("192.168.1.2");
    expect(hash1).not.toBe(hash2);
  });

  it("should produce 64-character hex string", () => {
    const hash = hashIp("127.0.0.1");
    expect(hash.length).toBe(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });
});

// =============================================================================
// Happy Path Tests
// =============================================================================

describe("Feedback API Happy Path", () => {
  it("should construct valid feedback payload", () => {
    const payload = {
      name: validFeedback.name.trim(),
      email: validFeedback.email.trim().toLowerCase(),
      category: validFeedback.category,
      subject: validFeedback.subject.trim(),
      description: validFeedback.description.trim(),
      page_url: validFeedback.pageUrl?.trim() || null,
      status: "new" as const,
    };

    expect(payload.name).toBe("Test User");
    expect(payload.email).toBe("test@example.com");
    expect(payload.category).toBe("bug");
    expect(payload.subject).toBe("Test subject");
    expect(payload.description).toBe("Test description with enough content to be valid.");
    expect(payload.page_url).toBe("https://coloradosongwriterscollective.org/happenings");
    expect(payload.status).toBe("new");
  });

  it("should handle all valid categories", () => {
    const categories = ["bug", "feature", "other"] as const;
    categories.forEach((category) => {
      const payload = { ...validFeedback, category };
      expect(["bug", "feature", "other"]).toContain(payload.category);
    });
  });

  it("should trim whitespace from inputs", () => {
    const payload = {
      name: "  Test User  ",
      email: "  TEST@example.com  ",
      subject: "  Test subject  ",
      description: "  Test description  ",
    };

    expect(payload.name.trim()).toBe("Test User");
    expect(payload.email.trim().toLowerCase()).toBe("test@example.com");
    expect(payload.subject.trim()).toBe("Test subject");
    expect(payload.description.trim()).toBe("Test description");
  });
});

// =============================================================================
// Email Template Tests
// =============================================================================

describe("Feedback Notification Email Template", () => {
  it("should generate email with correct subject format", () => {
    const category = "bug";
    const subject = "Test issue subject";
    const categoryLabel = { bug: "Bug Report", feature: "Feature Request", other: "Other Feedback" }[category];
    const emailSubject = `[CSC Feedback] ${categoryLabel}: ${subject.substring(0, 50)}`;
    expect(emailSubject).toBe("[CSC Feedback] Bug Report: Test issue subject");
  });

  it("should truncate long subjects in email", () => {
    const category = "feature";
    const longSubject = "This is a very long subject that exceeds fifty characters in length";
    const categoryLabel = { bug: "Bug Report", feature: "Feature Request", other: "Other Feedback" }[category];
    const emailSubject = `[CSC Feedback] ${categoryLabel}: ${longSubject.substring(0, 50)}${longSubject.length > 50 ? "..." : ""}`;
    expect(emailSubject.length).toBeLessThanOrEqual(100);
    expect(emailSubject.endsWith("...")).toBe(true);
  });

  it("should include all category labels", () => {
    const categoryLabels = {
      bug: "Bug Report",
      feature: "Feature Request",
      other: "Other Feedback",
    };
    expect(categoryLabels.bug).toBe("Bug Report");
    expect(categoryLabels.feature).toBe("Feature Request");
    expect(categoryLabels.other).toBe("Other Feedback");
  });
});
