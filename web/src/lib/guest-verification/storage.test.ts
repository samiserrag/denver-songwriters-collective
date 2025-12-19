import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveGuestClaim,
  getGuestClaim,
  removeGuestClaim,
  getAllGuestClaims,
  clearAllGuestClaims,
  type GuestClaimData,
} from "./storage";

/**
 * Guest Claim Storage Tests
 *
 * Tests for localStorage helpers used for guest claim UX.
 * These are best-effort UX only - not security mechanisms.
 */

describe("Guest Claim Storage", () => {
  // Mock localStorage
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);

    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
      get length() {
        return Object.keys(mockStorage).length;
      },
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
      }),
    });
  });

  const sampleClaim: GuestClaimData = {
    claim_id: "claim-123",
    guest_name: "John Doe",
    event_id: "event-456",
    timeslot_id: "timeslot-789",
    slot_index: 2,
    status: "confirmed",
    cancel_token: "cancel-token-abc",
    created_at: "2024-12-17T12:00:00Z",
  };

  describe("saveGuestClaim", () => {
    it("saves claim data to localStorage", () => {
      saveGuestClaim("event-456", sampleClaim);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "dsc_guest_claim_event-456",
        JSON.stringify(sampleClaim)
      );
    });

    it("uses correct storage key prefix", () => {
      saveGuestClaim("my-event", sampleClaim);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "dsc_guest_claim_my-event",
        expect.any(String)
      );
    });
  });

  describe("getGuestClaim", () => {
    it("retrieves claim data from localStorage", () => {
      mockStorage["dsc_guest_claim_event-456"] = JSON.stringify(sampleClaim);

      const result = getGuestClaim("event-456");

      expect(result).toEqual(sampleClaim);
    });

    it("returns null when no claim exists", () => {
      const result = getGuestClaim("nonexistent-event");

      expect(result).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      mockStorage["dsc_guest_claim_event-456"] = "invalid json{";

      const result = getGuestClaim("event-456");

      expect(result).toBeNull();
    });
  });

  describe("removeGuestClaim", () => {
    it("removes claim from localStorage", () => {
      mockStorage["dsc_guest_claim_event-456"] = JSON.stringify(sampleClaim);

      removeGuestClaim("event-456");

      expect(localStorage.removeItem).toHaveBeenCalledWith("dsc_guest_claim_event-456");
    });
  });

  describe("getAllGuestClaims", () => {
    it("returns all guest claims", () => {
      const claim1 = { ...sampleClaim, event_id: "event-1" };
      const claim2 = { ...sampleClaim, event_id: "event-2" };

      mockStorage["dsc_guest_claim_event-1"] = JSON.stringify(claim1);
      mockStorage["dsc_guest_claim_event-2"] = JSON.stringify(claim2);
      mockStorage["other_key"] = "not a claim";

      const results = getAllGuestClaims();

      expect(results).toHaveLength(2);
      expect(results).toContainEqual(claim1);
      expect(results).toContainEqual(claim2);
    });

    it("returns empty array when no claims exist", () => {
      const results = getAllGuestClaims();

      expect(results).toEqual([]);
    });

    it("skips invalid JSON entries", () => {
      mockStorage["dsc_guest_claim_event-1"] = JSON.stringify(sampleClaim);
      mockStorage["dsc_guest_claim_event-2"] = "invalid json";

      const results = getAllGuestClaims();

      expect(results).toHaveLength(1);
    });
  });

  describe("clearAllGuestClaims", () => {
    it("removes all guest claims", () => {
      mockStorage["dsc_guest_claim_event-1"] = JSON.stringify(sampleClaim);
      mockStorage["dsc_guest_claim_event-2"] = JSON.stringify(sampleClaim);
      mockStorage["other_key"] = "should not be removed";

      clearAllGuestClaims();

      expect(localStorage.removeItem).toHaveBeenCalledWith("dsc_guest_claim_event-1");
      expect(localStorage.removeItem).toHaveBeenCalledWith("dsc_guest_claim_event-2");
      expect(localStorage.removeItem).not.toHaveBeenCalledWith("other_key");
    });
  });
});
