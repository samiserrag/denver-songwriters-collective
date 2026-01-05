/**
 * Tests for getPublicVerificationState helper
 * Phase 4.37: Verification status UX
 */

import { describe, it, expect } from "vitest";
import {
  getPublicVerificationState,
  isUnconfirmed,
  isConfirmed,
  formatVerifiedDate,
  type VerificationInput,
} from "@/lib/events/verification";

describe("getPublicVerificationState", () => {
  describe("cancelled state", () => {
    it("returns cancelled for status=cancelled", () => {
      const event: VerificationInput = {
        status: "cancelled",
        host_id: "user-123",
        source: "community",
        last_verified_at: "2026-01-01T00:00:00Z",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("cancelled");
      expect(result.reason).toContain("cancelled");
    });

    it("returns cancelled even for seeded events", () => {
      const event: VerificationInput = {
        status: "cancelled",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("cancelled");
    });
  });

  describe("unconfirmed state", () => {
    it("returns unconfirmed for needs_verification status", () => {
      const event: VerificationInput = {
        status: "needs_verification",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
      expect(result.reason).toContain("not been confirmed");
    });

    it("returns unconfirmed for unverified status", () => {
      const event: VerificationInput = {
        status: "unverified",
        host_id: null,
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns unconfirmed for seeded active event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
      expect(result.reason).toContain("imported");
    });

    it("returns unconfirmed for admin-seeded active event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "admin",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns confirmed for seeded event that has been verified", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "import",
        last_verified_at: "2026-01-01T00:00:00Z",
        verified_by: "admin-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
      expect(result.lastVerifiedAt).toBe("2026-01-01T00:00:00Z");
    });
  });

  describe("confirmed state", () => {
    it("returns confirmed for host-owned published event", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
        is_published: true,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
      expect(result.reason).toContain("Published by host");
    });

    it("returns confirmed for host-owned event with verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: "2026-01-01T00:00:00Z",
        verified_by: "admin-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
      expect(result.reason).toContain("Verified by admin");
    });

    it("returns confirmed for community-sourced unclaimed event", () => {
      // Community-sourced events are NOT seeded, so they're considered confirmed
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });

    it("returns confirmed for venue-sourced event", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "venue",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });
  });

  describe("edge cases", () => {
    it("handles null status gracefully", () => {
      const event: VerificationInput = {
        status: null,
        host_id: "user-123",
        source: "community",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });

    it("handles undefined source gracefully", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: undefined,
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      // Without source, can't determine if seeded
      expect(result.state).toBe("confirmed");
    });

    it("handles draft status as confirmed (not public anyway)", () => {
      const event: VerificationInput = {
        status: "draft",
        host_id: "user-123",
        source: "community",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });

    it("handles inactive status with seeded source as unconfirmed", () => {
      // Inactive from seeded source without verification is still unconfirmed
      const event: VerificationInput = {
        status: "inactive",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      // Inactive seeded events are still unconfirmed since they haven't been verified
      expect(result.state).toBe("unconfirmed");
    });

    it("handles inactive status with host as confirmed", () => {
      const event: VerificationInput = {
        status: "inactive",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });
  });
});

describe("isUnconfirmed helper", () => {
  it("returns true for unconfirmed events", () => {
    const event: VerificationInput = {
      status: "needs_verification",
      host_id: null,
    };

    expect(isUnconfirmed(event)).toBe(true);
  });

  it("returns false for confirmed events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
    };

    expect(isUnconfirmed(event)).toBe(false);
  });
});

describe("isConfirmed helper", () => {
  it("returns true for confirmed events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
    };

    expect(isConfirmed(event)).toBe(true);
  });

  it("returns false for cancelled events", () => {
    const event: VerificationInput = {
      status: "cancelled",
    };

    expect(isConfirmed(event)).toBe(false);
  });
});

describe("formatVerifiedDate", () => {
  it("formats valid date string", () => {
    const result = formatVerifiedDate("2026-01-15T12:00:00Z");
    expect(result).toMatch(/Jan 15, 2026/);
  });

  it("returns null for null input", () => {
    expect(formatVerifiedDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatVerifiedDate(undefined)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(formatVerifiedDate("not-a-date")).toBeNull();
  });
});

describe("Phase 4.39: Seeded events with host_id stay unconfirmed", () => {
  it("returns unconfirmed for seeded event claimed by host but not verified", () => {
    // Phase 4.39: Seeded events MUST have last_verified_at to be confirmed,
    // even if they have a host_id (claimed)
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123", // Claimed by a host
      source: "import", // Seeded source
      last_verified_at: null, // Not yet verified
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("unconfirmed");
    expect(result.reason).toContain("awaiting admin verification");
  });

  it("returns unconfirmed for admin-seeded event claimed by host but not verified", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-456",
      source: "admin", // Admin-seeded source
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("unconfirmed");
    expect(result.reason).toContain("awaiting admin verification");
  });

  it("returns confirmed for seeded event claimed by host AND verified", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-789",
      source: "import",
      last_verified_at: "2026-01-15T12:00:00Z",
      verified_by: "admin-123",
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("confirmed");
    expect(result.reason).toContain("Verified by admin");
  });

  it("returns unconfirmed for unclaimed seeded event without verification", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: null, // Unclaimed
      source: "import",
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("unconfirmed");
    expect(result.reason).toContain("imported");
  });

  it("returns confirmed for community-sourced event even if unclaimed", () => {
    // Community source is NOT a seeded source, so it's trusted
    const event: VerificationInput = {
      status: "active",
      host_id: null,
      source: "community",
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("confirmed");
  });

  it("returns confirmed for community-sourced event with host", () => {
    // Community-created events with host are always confirmed
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("confirmed");
    expect(result.reason).toContain("Published by host");
  });
});

describe("Event Detail Page Verification Block", () => {
  it("confirmed renders green block even when last_verified_at is null", () => {
    // Simulating the event detail page logic:
    // If verificationState === "confirmed", render the green block
    // - If lastVerifiedAt exists: "Verified {date}"
    // - Else: "Confirmed"

    const event: VerificationInput = {
      status: "active",
      host_id: "user-123", // Claimed by host → confirmed
      source: "community",
      last_verified_at: null, // No verification date
    };

    const result = getPublicVerificationState(event);

    // Should be confirmed
    expect(result.state).toBe("confirmed");

    // In the detail page, this would render:
    // - Green block shown because state === "confirmed"
    // - Text shows "Confirmed" (not "Verified {date}" since lastVerifiedAt is null)
    const displayText = result.lastVerifiedAt
      ? `Verified ${formatVerifiedDate(result.lastVerifiedAt)}`
      : "Confirmed";

    expect(displayText).toBe("Confirmed");
  });

  it("confirmed with last_verified_at renders verified date", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: "2026-01-15T12:00:00Z", // Use noon UTC to avoid timezone edge cases
    };

    const result = getPublicVerificationState(event);

    expect(result.state).toBe("confirmed");
    expect(result.lastVerifiedAt).toBe("2026-01-15T12:00:00Z");

    const displayText = result.lastVerifiedAt
      ? `Verified ${formatVerifiedDate(result.lastVerifiedAt)}`
      : "Confirmed";

    // Date formatting varies by timezone, so just check it starts with "Verified" and contains "2026"
    expect(displayText).toMatch(/^Verified .* 2026$/);
  });
});
