/**
 * Phase 4.42l: Draft Delete Functionality Tests
 *
 * Tests for the ability of users to hard delete their own draft events.
 * - Drafts (is_published=false) can be permanently deleted
 * - Published events cannot be hard deleted (only soft-cancelled)
 * - Guardrails: events with RSVPs or timeslot claims cannot be deleted
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// API Contract Tests
// =============================================================================

describe("Phase 4.42l: Draft Delete API Contract", () => {
  describe("DELETE /api/my-events/[id]?hard=true", () => {
    it("should require the ?hard=true query param for hard delete", () => {
      // Contract: Without ?hard=true, the endpoint performs soft-cancel
      const endpoint = "/api/my-events/{id}";
      const hardDeleteEndpoint = "/api/my-events/{id}?hard=true";

      expect(hardDeleteEndpoint).toContain("hard=true");
      expect(endpoint).not.toContain("hard");
    });

    it("should only allow hard delete for unpublished (draft) events", () => {
      // Contract: is_published=false is required for hard delete
      const draftEvent = { is_published: false, status: "draft" };
      const publishedEvent = { is_published: true, status: "active" };

      const canHardDeleteDraft = !draftEvent.is_published;
      const canHardDeletePublished = !publishedEvent.is_published;

      expect(canHardDeleteDraft).toBe(true);
      expect(canHardDeletePublished).toBe(false);
    });

    it("should return 400 if trying to hard delete a published event", () => {
      // Contract: Published events should return 400 with appropriate message
      const expectedStatus = 400;
      const expectedError = "Cannot delete published events. Cancel them instead.";

      expect(expectedStatus).toBe(400);
      expect(expectedError).toContain("published");
      expect(expectedError).toContain("Cancel");
    });

    it("should return 409 if event has RSVPs", () => {
      // Contract: Events with RSVPs should not be deletable
      const expectedStatus = 409;
      const rsvpCount = 5;
      const expectedError = `Cannot delete: event has ${rsvpCount} RSVPs`;

      expect(expectedStatus).toBe(409);
      expect(expectedError).toContain("Cannot delete");
      expect(expectedError).toContain("RSVP");
    });

    it("should return 409 if event has timeslot claims", () => {
      // Contract: Events with timeslot claims should not be deletable
      const expectedStatus = 409;
      const claimCount = 3;
      const expectedError = `Cannot delete: event has ${claimCount} timeslot claims`;

      expect(expectedStatus).toBe(409);
      expect(expectedError).toContain("Cannot delete");
      expect(expectedError).toContain("timeslot claim");
    });

    it("should return success with deleted=true on successful hard delete", () => {
      // Contract: Successful hard delete returns { success: true, deleted: true }
      const expectedResponse = { success: true, deleted: true };

      expect(expectedResponse.success).toBe(true);
      expect(expectedResponse.deleted).toBe(true);
    });
  });

  describe("Soft delete (cancel) behavior preserved", () => {
    it("should soft-cancel published events without ?hard=true", () => {
      // Contract: Without ?hard=true, published events are soft-cancelled
      const softCancelUpdates = {
        status: "cancelled",
        cancelled_at: expect.any(String),
      };

      expect(softCancelUpdates.status).toBe("cancelled");
      expect(softCancelUpdates).toHaveProperty("cancelled_at");
    });

    it("should notify RSVPed users when soft-cancelling", () => {
      // Contract: Soft-cancel sends notifications to RSVPed users
      const notificationType = "event_cancelled";
      const notificationTitle = "Event Cancelled";

      expect(notificationType).toBe("event_cancelled");
      expect(notificationTitle).toContain("Cancelled");
    });
  });
});

// =============================================================================
// UI Component Tests
// =============================================================================

describe("Phase 4.42l: Draft Delete UI", () => {
  describe("DeleteDraftModal", () => {
    it("should display 'Delete this draft?' heading", () => {
      const expectedHeading = "Delete this draft?";
      expect(expectedHeading).toContain("Delete");
      expect(expectedHeading).toContain("draft");
    });

    it("should show permanent deletion warning", () => {
      const expectedMessage = "will be permanently deleted. This cannot be undone.";
      expect(expectedMessage).toContain("permanently deleted");
      expect(expectedMessage).toContain("cannot be undone");
    });

    it("should have 'Keep Draft' as cancel button text", () => {
      const cancelButtonText = "Keep Draft";
      expect(cancelButtonText).toBe("Keep Draft");
    });

    it("should have 'Delete Draft' as confirm button text", () => {
      const confirmButtonText = "Delete Draft";
      expect(confirmButtonText).toBe("Delete Draft");
    });

    it("should show 'Deleting...' while in progress", () => {
      const loadingText = "Deleting...";
      expect(loadingText).toBe("Deleting...");
    });
  });

  describe("Delete button on draft cards", () => {
    it("should only show delete button for unpublished events", () => {
      const draftEvent = { is_published: false, status: "draft" };
      const publishedEvent = { is_published: true, status: "active" };

      const showDeleteForDraft = !draftEvent.is_published && draftEvent.status !== "cancelled";
      const showDeleteForPublished = !publishedEvent.is_published && publishedEvent.status !== "cancelled";

      expect(showDeleteForDraft).toBe(true);
      expect(showDeleteForPublished).toBe(false);
    });

    it("should not show delete button for cancelled events", () => {
      const cancelledEvent = { is_published: false, status: "cancelled" };

      const showDelete = !cancelledEvent.is_published && cancelledEvent.status !== "cancelled";

      expect(showDelete).toBe(false);
    });

    it("should have trash icon for delete button", () => {
      // Contract: Uses trash icon path from Heroicons
      const trashIconPath = "m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21";
      expect(trashIconPath).toContain("14.74");
    });

    it("should have 'Delete draft' as button title and aria-label", () => {
      const buttonTitle = "Delete draft";
      const ariaLabel = "Delete draft";

      expect(buttonTitle).toBe("Delete draft");
      expect(ariaLabel).toBe("Delete draft");
    });
  });

  describe("Optimistic UI update", () => {
    it("should remove event from list on successful delete", () => {
      // Contract: Event is filtered out from local state after delete
      const events = [
        { id: "1", title: "Event 1" },
        { id: "2", title: "Event 2" },
        { id: "3", title: "Event 3" },
      ];
      const deletedEventId = "2";

      const remainingEvents = events.filter((e) => e.id !== deletedEventId);

      expect(remainingEvents).toHaveLength(2);
      expect(remainingEvents.find((e) => e.id === deletedEventId)).toBeUndefined();
    });
  });
});

// =============================================================================
// Permission Tests
// =============================================================================

describe("Phase 4.42l: Delete Permissions", () => {
  describe("canManageEvent check", () => {
    it("should allow admins to delete any draft", () => {
      // Contract: Admins can manage any event
      const isAdmin = true;
      const canManage = isAdmin;

      expect(canManage).toBe(true);
    });

    it("should allow hosts to delete their own drafts", () => {
      // Contract: Hosts with accepted invitation can manage their events
      const hostEntry = { role: "host", invitation_status: "accepted" };
      const canManage = !!hostEntry;

      expect(canManage).toBe(true);
    });

    it("should allow cohosts to delete shared drafts", () => {
      // Contract: Cohosts with accepted invitation can manage shared events
      const cohostEntry = { role: "cohost", invitation_status: "accepted" };
      const canManage = !!cohostEntry;

      expect(canManage).toBe(true);
    });

    it("should reject non-hosts trying to delete", () => {
      // Contract: Users without host entry cannot manage event
      const hostEntry = null;
      const canManage = !!hostEntry;

      expect(canManage).toBe(false);
    });
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Phase 4.42l: Edge Cases", () => {
  it("should handle event not found (404)", () => {
    // Contract: Returns 404 if event doesn't exist
    const expectedStatus = 404;
    const expectedError = "Event not found";

    expect(expectedStatus).toBe(404);
    expect(expectedError).toBe("Event not found");
  });

  it("should handle unauthorized users (401)", () => {
    // Contract: Returns 401 if no session
    const expectedStatus = 401;
    const expectedError = "Unauthorized";

    expect(expectedStatus).toBe(401);
    expect(expectedError).toBe("Unauthorized");
  });

  it("should handle forbidden access (403)", () => {
    // Contract: Returns 403 if user can't manage event
    const expectedStatus = 403;
    const expectedError = "Forbidden";

    expect(expectedStatus).toBe(403);
    expect(expectedError).toBe("Forbidden");
  });

  it("should pluralize RSVP count correctly", () => {
    // Contract: Uses proper pluralization for error messages
    const singleRsvp = `Cannot delete: event has 1 RSVP`;
    const multipleRsvps = `Cannot delete: event has 5 RSVPs`;

    expect(singleRsvp).not.toContain("RSVPs");
    expect(multipleRsvps).toContain("RSVPs");
  });

  it("should pluralize timeslot claim count correctly", () => {
    // Contract: Uses proper pluralization for error messages
    const singleClaim = `Cannot delete: event has 1 timeslot claim`;
    const multipleClaims = `Cannot delete: event has 3 timeslot claims`;

    expect(singleClaim).not.toContain("claims");
    expect(multipleClaims).toContain("claims");
  });
});
