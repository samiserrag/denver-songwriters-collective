/**
 * Phase 4.95 — Event Invite Redirect Preservation Tests
 *
 * Tests the redirect preservation logic for invite acceptance flows
 * that require login or signup.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
});

// Import after mocking
import {
  setPendingRedirect,
  consumePendingRedirect,
  hasPendingRedirect,
  clearPendingRedirect,
} from "@/lib/auth/pendingRedirect";

const STORAGE_KEY = "dsc_pending_auth_redirect";

describe("Phase 4.95 — Event Invite Redirect Preservation", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("setPendingRedirect", () => {
    it("stores URL with timestamp in localStorage", () => {
      const url = "/event-invite?token=abc123";
      setPendingRedirect(url);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        expect.stringContaining(url)
      );

      // Verify the stored data has correct structure
      const storedCall = localStorageMock.setItem.mock.calls[0];
      const storedData = JSON.parse(storedCall[1]);
      expect(storedData.url).toBe(url);
      expect(storedData.timestamp).toBeDefined();
      expect(typeof storedData.timestamp).toBe("number");
    });

    it("overwrites previous pending redirect", () => {
      setPendingRedirect("/first-url");
      setPendingRedirect("/second-url");

      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);
      const lastCall = localStorageMock.setItem.mock.calls[1];
      const storedData = JSON.parse(lastCall[1]);
      expect(storedData.url).toBe("/second-url");
    });
  });

  describe("consumePendingRedirect", () => {
    it("returns stored URL and clears storage", () => {
      const url = "/event-invite?token=xyz789";
      const data = { url, timestamp: Date.now() };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      const result = consumePendingRedirect();

      expect(result).toBe(url);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("returns null when no pending redirect exists", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      const result = consumePendingRedirect();

      expect(result).toBeNull();
    });

    it("returns null and clears expired redirect (> 1 hour)", () => {
      const url = "/event-invite?token=expired";
      const oneHourAgo = Date.now() - 61 * 60 * 1000; // 61 minutes ago
      const data = { url, timestamp: oneHourAgo };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      const result = consumePendingRedirect();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it("returns URL within expiry window (< 1 hour)", () => {
      const url = "/event-invite?token=valid";
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      const data = { url, timestamp: thirtyMinutesAgo };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      const result = consumePendingRedirect();

      expect(result).toBe(url);
    });

    it("handles invalid JSON gracefully", () => {
      localStorageMock.getItem.mockReturnValueOnce("not-valid-json");

      const result = consumePendingRedirect();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe("hasPendingRedirect", () => {
    it("returns true when valid pending redirect exists", () => {
      const data = { url: "/some-url", timestamp: Date.now() };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      expect(hasPendingRedirect()).toBe(true);
    });

    it("returns false when no pending redirect exists", () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      expect(hasPendingRedirect()).toBe(false);
    });

    it("returns false when pending redirect is expired", () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const data = { url: "/expired-url", timestamp: twoHoursAgo };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      expect(hasPendingRedirect()).toBe(false);
    });

    it("does not consume the redirect (non-destructive check)", () => {
      const data = { url: "/some-url", timestamp: Date.now() };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(data));

      hasPendingRedirect();

      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
  });

  describe("clearPendingRedirect", () => {
    it("removes pending redirect from storage", () => {
      clearPendingRedirect();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });

  describe("Invite Flow Integration", () => {
    it("event invite stores correct return URL format", () => {
      const token = "test-event-token";
      const returnUrl = `/event-invite?token=${encodeURIComponent(token)}`;
      setPendingRedirect(returnUrl);

      const storedCall = localStorageMock.setItem.mock.calls[0];
      const storedData = JSON.parse(storedCall[1]);
      expect(storedData.url).toBe(returnUrl);
      expect(storedData.url).toContain("event-invite");
      expect(storedData.url).toContain("token=");
    });

    it("venue invite stores correct return URL format", () => {
      const token = "test-venue-token";
      const returnUrl = `/venue-invite?token=${encodeURIComponent(token)}`;
      setPendingRedirect(returnUrl);

      const storedCall = localStorageMock.setItem.mock.calls[0];
      const storedData = JSON.parse(storedCall[1]);
      expect(storedData.url).toBe(returnUrl);
      expect(storedData.url).toContain("venue-invite");
      expect(storedData.url).toContain("token=");
    });

    it("onboarding completion can consume redirect", () => {
      // Simulate: user clicks invite link → redirected to login → signup → onboarding
      const inviteUrl = "/event-invite?token=invite123";
      const data = { url: inviteUrl, timestamp: Date.now() };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      // Onboarding calls consumePendingRedirect on completion
      const result = consumePendingRedirect();

      expect(result).toBe(inviteUrl);
      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });

    it("redirect survives up to 1 hour (common signup flow time)", () => {
      // Edge case: user takes 59 minutes to complete signup + onboarding
      const almostOneHourAgo = Date.now() - 59 * 60 * 1000;
      const data = { url: "/event-invite?token=slow-signup", timestamp: almostOneHourAgo };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(data));

      const result = consumePendingRedirect();

      expect(result).toBe("/event-invite?token=slow-signup");
    });
  });
});
