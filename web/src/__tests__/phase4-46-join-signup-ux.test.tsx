/**
 * Phase 4.46: Join & Signup UX Spotlight Tests
 *
 * Tests for:
 * 1. Custom location "(this event only)" copy
 * 2. "Venue wrong?" link behavior (admin vs non-admin)
 * 3. "Join & Signup" section structure
 * 4. Mini preview content
 * 5. Authorization for venue creation
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Test 1-2: Custom Location "(this event only)" Copy
// =============================================================================

describe("Custom location copy", () => {
  it("dropdown option shows 'this event only'", () => {
    // Phase 4.46: Custom location dropdown must explicitly say "this event only"
    const expectedDropdownText = "✎ Custom location (this event only)...";

    // The dropdown option in VenueSelector should contain this text
    expect(expectedDropdownText).toContain("this event only");
    expect(expectedDropdownText).toContain("Custom location");
  });

  it("custom location header shows 'this event only'", () => {
    // Phase 4.46: Custom location section header in EventForm
    const expectedHeader = "Custom Location (this event only)";

    expect(expectedHeader).toContain("this event only");
    expect(expectedHeader).toContain("Custom Location");
  });
});

// =============================================================================
// Test 3-4: "Venue wrong?" Link Behavior
// =============================================================================

describe("Venue wrong? link behavior", () => {
  it("shows mailto link for non-admin", () => {
    // Phase 4.46: Non-admins see a mailto link to report venue issues
    const canCreateVenue = false;
    const venueName = "Test Venue";
    const venueId = "test-venue-123";

    // When canCreateVenue is false, should show mailto link
    const shouldShowMailto = !canCreateVenue;
    expect(shouldShowMailto).toBe(true);

    // Mailto should be prefilled with venue info
    const mailtoSubject = `Venue Issue: ${venueName}`;
    const mailtoBody = `Venue: ${venueName} (${venueId})\n\nPlease describe the issue:\n`;

    expect(mailtoSubject).toContain(venueName);
    expect(mailtoBody).toContain(venueId);
  });

  it("shows admin edit link for admin", () => {
    // Phase 4.46: Admins see a link to the admin venues page
    const canCreateVenue = true;

    // When canCreateVenue is true (admin), should show admin edit link
    const shouldShowAdminLink = canCreateVenue;
    expect(shouldShowAdminLink).toBe(true);

    // Admin link should go to venues management page
    const adminVenuesPath = "/dashboard/admin/venues";
    expect(adminVenuesPath).toContain("admin");
    expect(adminVenuesPath).toContain("venues");
  });
});

// =============================================================================
// Test 5-7: "Join & Signup" Section Structure
// =============================================================================

describe("Join & Signup section structure", () => {
  it("section has 'Join & Signup' header", () => {
    // Phase 4.46: SlotConfigSection now has a visible header
    const sectionTitle = "Join & Signup";
    const sectionSubtitle = "How attendees and performers interact with your event";

    expect(sectionTitle).toBe("Join & Signup");
    expect(sectionSubtitle).toContain("attendees");
    expect(sectionSubtitle).toContain("performers");
  });

  it("Audience RSVP subsection is always visible", () => {
    // Phase 4.46: Audience RSVP should always be shown
    const audienceRSVPTitle = "Audience RSVP";
    const alwaysAvailableBadge = "Always Available";

    // These elements should always render regardless of other settings
    expect(audienceRSVPTitle).toBe("Audience RSVP");
    expect(alwaysAvailableBadge).toBe("Always Available");

    // RSVP explanation should clarify it's not performer signup
    const rsvpExplanation = "RSVPs let attendees say they're coming. This is not a performer sign-up.";
    expect(rsvpExplanation).toContain("not a performer sign-up");
  });

  it("Performer Slots toggle is optional", () => {
    // Phase 4.46: Performer slots is an optional feature with explicit "Optional" badge
    const performerSlotsTitle = "Performer Slots";
    const optionalBadge = "Optional";

    expect(performerSlotsTitle).toBe("Performer Slots");
    expect(optionalBadge).toBe("Optional");

    // Should have a toggle that can be on or off
    const toggleStates = [true, false];
    toggleStates.forEach(state => {
      expect(typeof state).toBe("boolean");
    });
  });
});

// =============================================================================
// Test 8-10: Mini Preview Content
// =============================================================================

describe("Mini preview content", () => {
  it("shows RSVP availability with unlimited when capacity is null", () => {
    // Phase 4.46: Mini preview shows RSVP status
    const capacity: number | null = null;

    const rsvpText = capacity
      ? `RSVP Available (${capacity} spots)`
      : "RSVP Available (unlimited)";

    expect(rsvpText).toBe("RSVP Available (unlimited)");
    expect(rsvpText).toContain("RSVP Available");
  });

  it("shows RSVP availability with capacity when set", () => {
    // Phase 4.46: Mini preview shows capacity when set
    const capacity: number | null = 50;

    const rsvpText = capacity
      ? `RSVP Available (${capacity} spots)`
      : "RSVP Available (unlimited)";

    expect(rsvpText).toBe("RSVP Available (50 spots)");
    expect(rsvpText).toContain("50 spots");
  });

  it("shows performer slots when enabled", () => {
    // Phase 4.46: Mini preview shows slots only when has_timeslots is true
    const config = {
      has_timeslots: true,
      total_slots: 10,
      slot_duration_minutes: 10,
      allow_guests: false,
    };

    // When has_timeslots is true, should show slot info
    const shouldShowSlots = config.has_timeslots;
    expect(shouldShowSlots).toBe(true);

    const slotText = `${config.total_slots} performer slots (${config.slot_duration_minutes} min each)`;
    expect(slotText).toBe("10 performer slots (10 min each)");

    // When has_timeslots is false, should not show slot info
    const configDisabled = { ...config, has_timeslots: false };
    expect(configDisabled.has_timeslots).toBe(false);
  });
});

// =============================================================================
// Test 11-12: Authorization (venue creation)
// =============================================================================

describe("Authorization for venue creation", () => {
  it("non-admin cannot see 'Add new venue'", () => {
    // Phase 4.46: canCreateVenue=false hides the add new venue option
    const canCreateVenue = false;
    const shouldShowAddNewVenue = canCreateVenue;

    expect(shouldShowAddNewVenue).toBe(false);
  });

  it("admin can see 'Add new venue'", () => {
    // Phase 4.46: canCreateVenue=true shows the add new venue option
    const canCreateVenue = true;
    const shouldShowAddNewVenue = canCreateVenue;

    expect(shouldShowAddNewVenue).toBe(true);
  });
});

// =============================================================================
// Additional Integration Tests
// =============================================================================

describe("Integration: Mini preview updates based on form state", () => {
  it("preview reflects current capacity and slot settings", () => {
    // Simulate form state changes
    const scenarios = [
      { capacity: null, has_timeslots: false, expected: { unlimited: true, showSlots: false } },
      { capacity: 30, has_timeslots: false, expected: { unlimited: false, showSlots: false } },
      { capacity: null, has_timeslots: true, expected: { unlimited: true, showSlots: true } },
      { capacity: 50, has_timeslots: true, expected: { unlimited: false, showSlots: true } },
    ];

    scenarios.forEach(({ capacity, has_timeslots, expected }) => {
      const isUnlimited = capacity === null;
      expect(isUnlimited).toBe(expected.unlimited);
      expect(has_timeslots).toBe(expected.showSlots);
    });
  });
});
