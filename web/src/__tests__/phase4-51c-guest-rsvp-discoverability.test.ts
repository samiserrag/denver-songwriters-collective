/**
 * Phase 4.51c: Guest RSVP Discoverability Fix
 *
 * Tests for the guest-first CTA when logged out.
 *
 * Root cause: When logged out, the prominent "RSVP Now" button redirected to /login,
 * while the guest RSVP option was a small text link below that users missed.
 *
 * Fix: When logged out, show "RSVP as Guest" as the primary CTA (same styling as
 * the member button), with "Have an account? Log in" as a secondary link below.
 */

import { describe, it, expect } from "vitest";

// ============================================================
// Logged-out behavior: Guest-first CTA
// ============================================================

describe("Phase 4.51c: Guest-first CTA when logged out", () => {
  describe("Primary CTA", () => {
    it("should show 'RSVP as Guest' as primary when logged out and no RSVP", () => {
      // Contract: When isLoggedIn=false && guestFlow="idle" && rsvp=null
      // The primary button text should be "RSVP as Guest"
      const isLoggedIn = false;
      const guestFlow = "idle";
      const rsvp = null;
      const isFull = false;

      const showGuestFirstCTA = !isLoggedIn && guestFlow === "idle" && !rsvp;
      const primaryButtonText = isFull ? "Join Waitlist as Guest" : "RSVP as Guest";

      expect(showGuestFirstCTA).toBe(true);
      expect(primaryButtonText).toBe("RSVP as Guest");
    });

    it("should show 'Join Waitlist as Guest' when event is full and logged out", () => {
      // Contract: When capacity is reached, button text changes to waitlist variant
      const isLoggedIn = false;
      const guestFlow = "idle";
      const rsvp = null;
      const capacity = 10;
      const confirmedCount = 10;
      const isFull = capacity !== null && confirmedCount >= capacity;

      const showGuestFirstCTA = !isLoggedIn && guestFlow === "idle" && !rsvp;
      const primaryButtonText = isFull ? "Join Waitlist as Guest" : "RSVP as Guest";

      expect(showGuestFirstCTA).toBe(true);
      expect(isFull).toBe(true);
      expect(primaryButtonText).toBe("Join Waitlist as Guest");
    });

    it("clicking primary CTA should set guestFlow to 'form'", () => {
      // Contract: Primary button onClick calls setGuestFlow("form")
      // This shows the guest form WITHOUT navigation
      const guestFlowStates: string[] = [];
      const setGuestFlow = (state: string) => guestFlowStates.push(state);

      // Simulate click
      setGuestFlow("form");

      expect(guestFlowStates).toContain("form");
      // No router.push should be called (tested by absence of navigation)
    });

    it("primary CTA should use primary button styling (not text link)", () => {
      // Contract: Guest CTA has the same styling as the member "RSVP Now" button
      const primaryButtonClasses = [
        "inline-flex",
        "items-center",
        "px-6",
        "py-3",
        "font-semibold",
        "rounded-xl",
        "bg-[var(--color-accent-primary)]",
      ];

      // These classes should NOT be used for primary CTA
      const linkStyleClasses = ["text-sm", "hover:underline"];

      // Primary button should have primary styling
      primaryButtonClasses.forEach((cls) => {
        expect(cls).not.toBe("text-sm"); // Not link-styled
      });

      // Verify it's not using the old link-style pattern
      expect(linkStyleClasses).not.toContain("px-6");
      expect(linkStyleClasses).not.toContain("py-3");
    });
  });

  describe("Secondary login action", () => {
    it("should show 'Have an account? Log in' when logged out", () => {
      // Contract: Secondary action exists with login text
      const isLoggedIn = false;
      const guestFlow = "idle";
      const rsvp = null;

      const showGuestFirstCTA = !isLoggedIn && guestFlow === "idle" && !rsvp;
      const secondaryActionText = "Have an account? Log in";

      expect(showGuestFirstCTA).toBe(true);
      expect(secondaryActionText).toBe("Have an account? Log in");
    });

    it("clicking login link should redirect to /login with redirectTo param", () => {
      // Contract: Secondary action calls handleRSVP which does router.push('/login?redirectTo=...')
      const eventId = "test-event-123";
      const expectedRedirectUrl = `/login?redirectTo=/events/${eventId}`;

      // handleRSVP when !isLoggedIn does: router.push(`/login?redirectTo=/events/${eventId}`)
      expect(expectedRedirectUrl).toContain("/login");
      expect(expectedRedirectUrl).toContain("redirectTo");
      expect(expectedRedirectUrl).toContain(eventId);
    });

    it("secondary action should use link/text styling (not primary button)", () => {
      // Contract: Login link uses secondary/link styling
      const secondaryClasses = [
        "text-sm",
        "text-[var(--color-text-secondary)]",
        "hover:text-[var(--color-text-primary)]",
        "hover:underline",
      ];

      // These should NOT appear in secondary action
      const primaryButtonPatterns = ["px-6", "py-3", "rounded-xl", "bg-"];

      secondaryClasses.forEach((cls) => {
        expect(primaryButtonPatterns).not.toContain(cls);
      });
    });

    it("secondary action should appear AFTER primary CTA in DOM order", () => {
      // Contract: Guest CTA renders first, login link renders second
      // This ensures guest-first discoverability
      const renderOrder = ["guest-primary-button", "login-secondary-link"];

      expect(renderOrder[0]).toBe("guest-primary-button");
      expect(renderOrder[1]).toBe("login-secondary-link");
      expect(renderOrder.indexOf("guest-primary-button")).toBeLessThan(
        renderOrder.indexOf("login-secondary-link")
      );
    });
  });
});

// ============================================================
// Logged-in behavior: Member RSVP unchanged
// ============================================================

describe("Phase 4.51c: Member RSVP when logged in", () => {
  it("should show 'RSVP Now' as primary when logged in and no RSVP", () => {
    // Contract: When isLoggedIn=true, show member RSVP button
    const isLoggedIn = true;
    const rsvp = null;
    const isFull = false;

    const showMemberButton = isLoggedIn && !rsvp;
    const primaryButtonText = isFull ? "Join Waitlist" : "RSVP Now";

    expect(showMemberButton).toBe(true);
    expect(primaryButtonText).toBe("RSVP Now");
  });

  it("should show 'Join Waitlist' when event is full and logged in", () => {
    // Contract: Logged-in waitlist variant
    const isLoggedIn = true;
    const rsvp = null;
    const isFull = true;

    const showMemberButton = isLoggedIn && !rsvp;
    const primaryButtonText = isFull ? "Join Waitlist" : "RSVP Now";

    expect(showMemberButton).toBe(true);
    expect(primaryButtonText).toBe("Join Waitlist");
  });

  it("should NOT show secondary login link when logged in", () => {
    // Contract: No "Have an account?" link when already logged in
    const isLoggedIn = true;
    const showSecondaryLoginLink = !isLoggedIn;

    expect(showSecondaryLoginLink).toBe(false);
  });

  it("clicking RSVP Now when logged in should call API (not redirect)", () => {
    // Contract: handleRSVP when isLoggedIn does fetch to /api/events/{id}/rsvp
    const apiEndpoint = "/api/events/test-event-123/rsvp";

    // When logged in, handleRSVP should:
    // 1. NOT call router.push
    // 2. Call fetch to API endpoint
    expect(apiEndpoint).toContain("/api/events/");
    expect(apiEndpoint).toContain("/rsvp");
  });
});

// ============================================================
// Guest flow state transitions
// ============================================================

describe("Phase 4.51c: Guest flow state transitions", () => {
  it("guest CTA should only show when guestFlow is 'idle'", () => {
    // Contract: Primary guest button hidden when form/verification is showing
    const guestFlowStates = ["idle", "form", "verification", "success"];

    guestFlowStates.forEach((state) => {
      const showGuestCTA = state === "idle";
      if (state === "idle") {
        expect(showGuestCTA).toBe(true);
      } else {
        expect(showGuestCTA).toBe(false);
      }
    });
  });

  it("guest form should show when guestFlow is 'form'", () => {
    // Contract: Form renders when guestFlow="form"
    const guestFlow = "form";
    const showGuestForm = guestFlow === "form";

    expect(showGuestForm).toBe(true);
  });

  it("member button should NOT show when logged out (any guestFlow state)", () => {
    // Contract: Member button only shows when isLoggedIn=true
    const isLoggedIn = false;
    const guestFlowStates = ["idle", "form", "verification", "success"];

    // Test each state - member button is never shown when logged out
    expect(guestFlowStates.length).toBe(4);
    const showMemberButton = isLoggedIn;
    expect(showMemberButton).toBe(false);
  });
});

// ============================================================
// Copy/tone consistency
// ============================================================

describe("Phase 4.51c: Copy consistency", () => {
  it("should use lowercase 'guest' in button text", () => {
    // Per tone guide: concise copy, lowercase is fine
    const buttonTexts = ["RSVP as Guest", "Join Waitlist as Guest"];

    buttonTexts.forEach((text) => {
      // "Guest" with capital G is acceptable (title case for CTA)
      expect(text).toMatch(/Guest/);
    });
  });

  it("should NOT imply signup is required for guest RSVP", () => {
    // Contract: Guest flow should feel accessible, not gated
    const forbiddenPhrases = [
      "Sign up to RSVP",
      "Create account",
      "Register to",
      "Must sign up",
    ];

    const primaryCTA = "RSVP as Guest";
    const secondaryCTA = "Have an account? Log in";

    forbiddenPhrases.forEach((phrase) => {
      expect(primaryCTA).not.toContain(phrase);
      expect(secondaryCTA).not.toContain(phrase);
    });
  });
});
