import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isGuestVerificationEnabled } from "./featureFlags";

/**
 * Feature Flags Tests
 *
 * Tests for client-side feature flag utilities.
 */

describe("Feature Flags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isGuestVerificationEnabled", () => {
    it("returns false when env var is not set", () => {
      delete process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION;

      expect(isGuestVerificationEnabled()).toBe(false);
    });

    it("returns false when env var is 'false'", () => {
      process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION = "false";

      expect(isGuestVerificationEnabled()).toBe(false);
    });

    it("returns false when env var is empty string", () => {
      process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION = "";

      expect(isGuestVerificationEnabled()).toBe(false);
    });

    it("returns true when env var is 'true'", () => {
      process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION = "true";

      expect(isGuestVerificationEnabled()).toBe(true);
    });

    it("returns false for non-'true' values", () => {
      process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION = "yes";

      expect(isGuestVerificationEnabled()).toBe(false);
    });

    it("is case-sensitive (TRUE !== true)", () => {
      process.env.NEXT_PUBLIC_ENABLE_GUEST_VERIFICATION = "TRUE";

      expect(isGuestVerificationEnabled()).toBe(false);
    });
  });
});
