/**
 * Tests for getPublicVerificationState helper
 * Phase 4.40: Simplified verification - all events unconfirmed until admin verifies
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

    it("returns cancelled even if last_verified_at is set", () => {
      const event: VerificationInput = {
        status: "cancelled",
        last_verified_at: "2026-01-01T00:00:00Z",
        verified_by: "admin-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("cancelled");
    });

    it("returns cancelled regardless of source or host_id", () => {
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

  describe("confirmed state", () => {
    it("returns confirmed when last_verified_at is set", () => {
      const event: VerificationInput = {
        status: "active",
        last_verified_at: "2026-01-01T00:00:00Z",
        verified_by: "admin-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
      expect(result.reason).toContain("Verified by admin");
      expect(result.lastVerifiedAt).toBe("2026-01-01T00:00:00Z");
      expect(result.verifiedBy).toBe("admin-123");
    });

    it("returns confirmed regardless of source when verified", () => {
      const event: VerificationInput = {
        status: "active",
        source: "import", // seeded source
        host_id: null, // unclaimed
        last_verified_at: "2026-01-15T12:00:00Z",
        verified_by: "admin-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });

    it("returns confirmed regardless of host_id when verified", () => {
      const event: VerificationInput = {
        status: "active",
        source: "community",
        host_id: "user-123",
        last_verified_at: "2026-01-15T12:00:00Z",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("confirmed");
    });
  });

  describe("unconfirmed state (default)", () => {
    it("returns unconfirmed when last_verified_at is null", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
      expect(result.reason).toContain("Awaiting admin verification");
    });

    it("returns unconfirmed when last_verified_at is undefined", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-123",
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns unconfirmed for community-sourced event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
        is_published: true,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns unconfirmed for import-sourced event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns unconfirmed for admin-sourced event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: "admin",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("returns unconfirmed for claimed event without verification", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: "user-456",
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });
  });

  describe("edge cases", () => {
    it("handles null status gracefully (defaults to unconfirmed)", () => {
      const event: VerificationInput = {
        status: null,
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("handles undefined source gracefully", () => {
      const event: VerificationInput = {
        status: "active",
        host_id: null,
        source: undefined,
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("handles draft status as unconfirmed when not verified", () => {
      const event: VerificationInput = {
        status: "draft",
        host_id: "user-123",
        source: "community",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });

    it("handles needs_verification status as unconfirmed", () => {
      const event: VerificationInput = {
        status: "needs_verification",
        host_id: null,
        source: "import",
        last_verified_at: null,
      };

      const result = getPublicVerificationState(event);
      expect(result.state).toBe("unconfirmed");
    });
  });
});

describe("Phase 4.40: All events unconfirmed until verified", () => {
  it("new community event is unconfirmed by default", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: null,
      is_published: true,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("unconfirmed");
  });

  it("new CSC event is unconfirmed by default", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("unconfirmed");
  });

  it("becomes confirmed only when admin sets last_verified_at", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: "2026-01-15T12:00:00Z",
      verified_by: "admin-123",
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("confirmed");
    expect(result.reason).toBe("Verified by admin");
  });

  it("cancelled overrides verified status", () => {
    const event: VerificationInput = {
      status: "cancelled",
      last_verified_at: "2026-01-15T12:00:00Z",
      verified_by: "admin-123",
    };

    const result = getPublicVerificationState(event);
    expect(result.state).toBe("cancelled");
  });
});

describe("isUnconfirmed helper", () => {
  it("returns true for unverified events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      last_verified_at: null,
    };

    expect(isUnconfirmed(event)).toBe(true);
  });

  it("returns false for verified events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      last_verified_at: "2026-01-15T12:00:00Z",
    };

    expect(isUnconfirmed(event)).toBe(false);
  });

  it("returns false for cancelled events", () => {
    const event: VerificationInput = {
      status: "cancelled",
    };

    expect(isUnconfirmed(event)).toBe(false);
  });
});

describe("isConfirmed helper", () => {
  it("returns true for verified events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      last_verified_at: "2026-01-15T12:00:00Z",
    };

    expect(isConfirmed(event)).toBe(true);
  });

  it("returns false for unverified events", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      last_verified_at: null,
    };

    expect(isConfirmed(event)).toBe(false);
  });

  it("returns false for cancelled events", () => {
    const event: VerificationInput = {
      status: "cancelled",
      last_verified_at: "2026-01-15T12:00:00Z",
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

describe("Event Detail Page Verification Block", () => {
  it("verified event shows verified date", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: "2026-01-15T12:00:00Z",
    };

    const result = getPublicVerificationState(event);

    expect(result.state).toBe("confirmed");
    expect(result.lastVerifiedAt).toBe("2026-01-15T12:00:00Z");

    const displayText = result.lastVerifiedAt
      ? `Verified ${formatVerifiedDate(result.lastVerifiedAt)}`
      : "Confirmed";

    expect(displayText).toMatch(/^Verified .* 2026$/);
  });

  it("unverified event shows awaiting verification", () => {
    const event: VerificationInput = {
      status: "active",
      host_id: "user-123",
      source: "community",
      last_verified_at: null,
    };

    const result = getPublicVerificationState(event);

    expect(result.state).toBe("unconfirmed");
    expect(result.reason).toBe("Awaiting admin verification");
  });
});
