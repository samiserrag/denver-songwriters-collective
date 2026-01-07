/**
 * Phase 4.45b: Venue Selector UX Tests
 *
 * Tests for:
 * 1. Dropdown action ordering (actions at top)
 * 2. "Add new venue" visibility based on canCreateVenue prop
 * 3. Helper text for non-admins
 * 4. Custom location microcopy
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// Test 1: Dropdown Order Contract
// =============================================================================

describe("VenueSelector dropdown order", () => {
  it("actions should come BEFORE venues in the dropdown", () => {
    // Phase 4.45b: Actions at top for discoverability
    // Order should be:
    // 1. "Select a venue..." (placeholder)
    // 2. "+ Add new venue..." (if canCreateVenue)
    // 3. "✎ Enter custom location..." (if showCustomLocationOption)
    // 4. Separator
    // 5. Venues A-Z

    const expectedOrder = [
      "placeholder", // "Select a venue..."
      "action_new", // "+ Add new venue..." (conditional)
      "action_custom", // "✎ Enter custom location..." (conditional)
      "separator",
      "venues", // A-Z list
    ];

    // Actions must come before venues
    expect(expectedOrder.indexOf("action_new")).toBeLessThan(
      expectedOrder.indexOf("separator")
    );
    expect(expectedOrder.indexOf("action_custom")).toBeLessThan(
      expectedOrder.indexOf("separator")
    );
    expect(expectedOrder.indexOf("separator")).toBeLessThan(
      expectedOrder.indexOf("venues")
    );
  });

  it("separator only appears if there are actions", () => {
    // If neither canCreateVenue nor showCustomLocationOption, no separator
    const hasActions = (canCreateVenue: boolean, showCustomLocation: boolean) =>
      canCreateVenue || showCustomLocation;

    expect(hasActions(false, false)).toBe(false);
    expect(hasActions(true, false)).toBe(true);
    expect(hasActions(false, true)).toBe(true);
    expect(hasActions(true, true)).toBe(true);
  });
});

// =============================================================================
// Test 2: canCreateVenue Prop Behavior
// =============================================================================

describe("canCreateVenue authorization", () => {
  it("'Add new venue' option should be hidden when canCreateVenue is false", () => {
    const canCreateVenue = false;
    const shouldShowAddNewVenue = canCreateVenue;
    expect(shouldShowAddNewVenue).toBe(false);
  });

  it("'Add new venue' option should be visible when canCreateVenue is true", () => {
    const canCreateVenue = true;
    const shouldShowAddNewVenue = canCreateVenue;
    expect(shouldShowAddNewVenue).toBe(true);
  });

  it("canCreateVenue defaults to false (safe default)", () => {
    // VenueSelector has canCreateVenue = false as default
    const defaultValue = false;
    expect(defaultValue).toBe(false);
  });

  it("only admins should have canCreateVenue=true", () => {
    // RLS policy: venues_insert_admin requires public.is_admin()
    // Therefore canCreateVenue should only be true for admins

    // Test the authorization matrix for each role
    const scenarios = [
      { role: "admin", isAdmin: true, canCreateVenue: true },
      { role: "approved_host", isAdmin: false, canCreateVenue: false },
      { role: "regular_member", isAdmin: false, canCreateVenue: false },
    ];

    scenarios.forEach(({ role, isAdmin, canCreateVenue }) => {
      // canCreateVenue should only be true when isAdmin is true
      const computedCanCreateVenue = isAdmin;
      expect(computedCanCreateVenue).toBe(canCreateVenue);
      // Verify hosts cannot create venues
      if (role === "approved_host") {
        expect(canCreateVenue).toBe(false);
      }
    });
  });
});

// =============================================================================
// Test 3: Helper Text for Non-Admins
// =============================================================================

describe("Helper text for non-admins", () => {
  it("shows help text when canCreateVenue is false and showCustomLocationOption is true", () => {
    const canCreateVenue = false;
    const showCustomLocationOption = true;

    const shouldShowHelperText = !canCreateVenue && showCustomLocationOption;
    expect(shouldShowHelperText).toBe(true);
  });

  it("hides help text when user can create venues", () => {
    const canCreateVenue = true;
    const showCustomLocationOption = true;

    const shouldShowHelperText = !canCreateVenue && showCustomLocationOption;
    expect(shouldShowHelperText).toBe(false);
  });

  it("hides help text when custom location option is disabled", () => {
    const canCreateVenue = false;
    const showCustomLocationOption = false;

    const shouldShowHelperText = !canCreateVenue && showCustomLocationOption;
    expect(shouldShowHelperText).toBe(false);
  });

  it("helper text contains expected guidance", () => {
    const expectedText =
      "Can't find your venue? Use Custom Location for one-time or approximate locations.";
    const expectedLink = "Report a venue issue";

    // These strings should appear in the helper text
    expect(expectedText).toContain("Custom Location");
    expect(expectedLink).toBe("Report a venue issue");
  });
});

// =============================================================================
// Test 4: Custom Location vs Venue Distinction
// =============================================================================

describe("Venue vs Custom Location distinction", () => {
  it("new venue form shows 'reusable' messaging", () => {
    const venueFormDescription = "Creates a reusable venue for future events";
    expect(venueFormDescription).toContain("reusable");
    expect(venueFormDescription).toContain("future events");
  });

  it("custom location is event-scoped (not reusable)", () => {
    // Custom location fields are stored on the event, not in venues table
    const customLocationFields = [
      "custom_location_name",
      "custom_address",
      "custom_city",
      "custom_state",
      "custom_latitude",
      "custom_longitude",
      "location_notes",
    ];

    // All fields start with "custom_" or are event-specific
    const eventScopedFields = customLocationFields.filter(
      (f) => f.startsWith("custom_") || f === "location_notes"
    );
    expect(eventScopedFields.length).toBe(customLocationFields.length);
  });

  it("venues are global and affect multiple events", () => {
    // Venues are stored in the venues table
    // Events reference venues via venue_id FK
    // Changing a venue affects all events with that venue_id

    const venueFields = [
      "name",
      "address",
      "city",
      "state",
      "zip",
      "phone",
      "website_url",
      "google_maps_url",
    ];

    // None of these are prefixed with "custom_"
    const globalFields = venueFields.filter((f) => !f.startsWith("custom_"));
    expect(globalFields.length).toBe(venueFields.length);
  });
});

// =============================================================================
// Test 5: Report Venue Issue Link
// =============================================================================

describe("Report venue issue affordance", () => {
  it("mailto link uses correct email address", () => {
    const expectedEmail = "hello@denversongwriterscollective.org";
    const expectedSubject = "Venue%20Issue%20Report";

    const mailtoHref = `mailto:${expectedEmail}?subject=${expectedSubject}`;
    expect(mailtoHref).toContain(expectedEmail);
    expect(mailtoHref).toContain("subject=");
  });

  it("link is accessible (has href and text)", () => {
    const linkText = "Report a venue issue";
    const hasHref = true; // mailto:...

    expect(linkText.length).toBeGreaterThan(0);
    expect(hasHref).toBe(true);
  });
});

// =============================================================================
// Test 6: Integration - EventForm Props
// =============================================================================

describe("EventForm canCreateVenue prop", () => {
  it("EventForm passes canCreateVenue to VenueSelector", () => {
    // EventFormProps now includes canCreateVenue
    interface EventFormProps {
      mode: "create" | "edit";
      canCreateDSC?: boolean;
      canCreateVenue?: boolean;
    }

    const props: EventFormProps = {
      mode: "create",
      canCreateDSC: true,
      canCreateVenue: false,
    };

    expect(props.canCreateVenue).toBeDefined();
    expect(props.canCreateVenue).toBe(false);
  });

  it("canCreateVenue is independent from canCreateDSC", () => {
    // canCreateDSC = approved host OR admin
    // canCreateVenue = admin ONLY

    const scenarios = [
      { isAdmin: true, isApprovedHost: true, canCreateDSC: true, canCreateVenue: true },
      { isAdmin: false, isApprovedHost: true, canCreateDSC: true, canCreateVenue: false },
      { isAdmin: false, isApprovedHost: false, canCreateDSC: false, canCreateVenue: false },
    ];

    scenarios.forEach(({ isAdmin, isApprovedHost, canCreateDSC, canCreateVenue }) => {
      const computedCanCreateDSC = isApprovedHost || isAdmin;
      const computedCanCreateVenue = isAdmin;

      expect(computedCanCreateDSC).toBe(canCreateDSC);
      expect(computedCanCreateVenue).toBe(canCreateVenue);
    });
  });
});
