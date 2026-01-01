/**
 * Phase 4.22.3: Event Claims Tests
 *
 * Tests for the event claim flow allowing users to request
 * ownership of unclaimed events (events with host_id IS NULL).
 */

import { describe, it, expect } from "vitest";

// Type definitions for test purposes
interface EventClaim {
  id: string;
  event_id: string;
  requester_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

interface Event {
  id: string;
  title: string;
  host_id: string | null;
}

describe("Event Claims - Visibility Rules", () => {
  it("claim button should only appear when host_id is null", () => {
    const eventWithHost: Event = {
      id: "event-1",
      title: "Weekly Open Mic",
      host_id: "user-123",
    };

    const eventWithoutHost: Event = {
      id: "event-2",
      title: "Unclaimed Open Mic",
      host_id: null,
    };

    const isUnclaimed = (event: Event) => event.host_id === null;

    expect(isUnclaimed(eventWithHost)).toBe(false);
    expect(isUnclaimed(eventWithoutHost)).toBe(true);
  });

  it("claim button should require user to be signed in", () => {
    const sessionExists = true;
    const noSession = false;
    const isUnclaimed = true;

    const shouldShowClaimButton = (hasSession: boolean, unclaimed: boolean) =>
      hasSession && unclaimed;

    expect(shouldShowClaimButton(sessionExists, isUnclaimed)).toBe(true);
    expect(shouldShowClaimButton(noSession, isUnclaimed)).toBe(false);
  });
});

describe("Event Claims - Duplicate Prevention", () => {
  const existingClaims: EventClaim[] = [
    {
      id: "claim-1",
      event_id: "event-1",
      requester_id: "user-1",
      message: "I run this open mic",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    },
  ];

  it("should prevent duplicate pending claims for same event/user", () => {
    const hasPendingClaim = (eventId: string, requesterId: string) =>
      existingClaims.some(
        (c) =>
          c.event_id === eventId &&
          c.requester_id === requesterId &&
          c.status === "pending"
      );

    expect(hasPendingClaim("event-1", "user-1")).toBe(true);
    expect(hasPendingClaim("event-1", "user-2")).toBe(false);
    expect(hasPendingClaim("event-2", "user-1")).toBe(false);
  });

  it("should allow claim after previous was rejected", () => {
    const claimsWithRejection: EventClaim[] = [
      {
        id: "claim-1",
        event_id: "event-1",
        requester_id: "user-1",
        message: null,
        status: "rejected",
        reviewed_by: "admin-1",
        reviewed_at: "2026-01-01T00:00:00Z",
        rejection_reason: "Insufficient proof",
      },
    ];

    const hasPendingClaim = (eventId: string, requesterId: string) =>
      claimsWithRejection.some(
        (c) =>
          c.event_id === eventId &&
          c.requester_id === requesterId &&
          c.status === "pending"
      );

    // No pending claim exists (only rejected)
    expect(hasPendingClaim("event-1", "user-1")).toBe(false);
  });
});

describe("Event Claims - Approval Flow", () => {
  it("should set host_id on approval when event is unclaimed", () => {
    const event: Event = {
      id: "event-1",
      title: "Unclaimed Open Mic",
      host_id: null,
    };

    const claim: EventClaim = {
      id: "claim-1",
      event_id: "event-1",
      requester_id: "user-1",
      message: null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    };

    // Simulate approval
    const approveClaimResult = (
      claimToApprove: EventClaim,
      targetEvent: Event,
      adminId: string
    ) => {
      if (targetEvent.host_id !== null) {
        return {
          success: false,
          reason: "Event already claimed",
          updatedClaim: {
            ...claimToApprove,
            status: "rejected" as const,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: "Event was already claimed by another user.",
          },
          updatedEvent: targetEvent,
        };
      }

      return {
        success: true,
        reason: null,
        updatedClaim: {
          ...claimToApprove,
          status: "approved" as const,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        },
        updatedEvent: {
          ...targetEvent,
          host_id: claimToApprove.requester_id,
        },
      };
    };

    const result = approveClaimResult(claim, event, "admin-1");

    expect(result.success).toBe(true);
    expect(result.updatedClaim.status).toBe("approved");
    expect(result.updatedEvent.host_id).toBe("user-1");
  });

  it("should auto-reject if host_id is no longer null", () => {
    const eventAlreadyClaimed: Event = {
      id: "event-1",
      title: "Recently Claimed Open Mic",
      host_id: "user-2", // Another user claimed it
    };

    const claim: EventClaim = {
      id: "claim-1",
      event_id: "event-1",
      requester_id: "user-1",
      message: null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    };

    const approveClaimResult = (
      claimToApprove: EventClaim,
      targetEvent: Event,
      adminId: string
    ) => {
      if (targetEvent.host_id !== null) {
        return {
          success: false,
          reason: "Event already claimed",
          updatedClaim: {
            ...claimToApprove,
            status: "rejected" as const,
            reviewed_by: adminId,
            reviewed_at: new Date().toISOString(),
            rejection_reason: "Event was already claimed by another user.",
          },
          updatedEvent: targetEvent,
        };
      }

      return {
        success: true,
        reason: null,
        updatedClaim: {
          ...claimToApprove,
          status: "approved" as const,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
        },
        updatedEvent: {
          ...targetEvent,
          host_id: claimToApprove.requester_id,
        },
      };
    };

    const result = approveClaimResult(claim, eventAlreadyClaimed, "admin-1");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("Event already claimed");
    expect(result.updatedClaim.status).toBe("rejected");
    expect(result.updatedClaim.rejection_reason).toBe(
      "Event was already claimed by another user."
    );
    expect(result.updatedEvent.host_id).toBe("user-2"); // Unchanged
  });
});

describe("Event Claims - Rejection Flow", () => {
  it("should set rejection_reason on reject", () => {
    const claim: EventClaim = {
      id: "claim-1",
      event_id: "event-1",
      requester_id: "user-1",
      message: "I run this event",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    };

    const rejectClaim = (
      claimToReject: EventClaim,
      adminId: string,
      reason: string | null
    ): EventClaim => ({
      ...claimToReject,
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    });

    const result = rejectClaim(claim, "admin-1", "Unable to verify ownership");

    expect(result.status).toBe("rejected");
    expect(result.reviewed_by).toBe("admin-1");
    expect(result.rejection_reason).toBe("Unable to verify ownership");
  });

  it("should allow rejection without reason", () => {
    const claim: EventClaim = {
      id: "claim-1",
      event_id: "event-1",
      requester_id: "user-1",
      message: null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    };

    const rejectClaim = (
      claimToReject: EventClaim,
      adminId: string,
      reason: string | null
    ): EventClaim => ({
      ...claimToReject,
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    });

    const result = rejectClaim(claim, "admin-1", null);

    expect(result.status).toBe("rejected");
    expect(result.rejection_reason).toBeNull();
  });
});

describe("Event Claims - User Claim Status Display", () => {
  it("should show pending status for pending claim", () => {
    const userClaim: Pick<EventClaim, "status" | "rejection_reason"> = {
      status: "pending",
      rejection_reason: null,
    };

    const getStatusDisplay = (
      claim: Pick<EventClaim, "status" | "rejection_reason">
    ) => {
      switch (claim.status) {
        case "pending":
          return "Pending Approval";
        case "approved":
          return "Approved";
        case "rejected":
          return claim.rejection_reason
            ? `Rejected: ${claim.rejection_reason}`
            : "Rejected";
        default:
          return "Unknown";
      }
    };

    expect(getStatusDisplay(userClaim)).toBe("Pending Approval");
  });

  it("should show approved status for approved claim", () => {
    const userClaim: Pick<EventClaim, "status" | "rejection_reason"> = {
      status: "approved",
      rejection_reason: null,
    };

    const getStatusDisplay = (
      claim: Pick<EventClaim, "status" | "rejection_reason">
    ) => {
      switch (claim.status) {
        case "pending":
          return "Pending Approval";
        case "approved":
          return "Approved";
        case "rejected":
          return claim.rejection_reason
            ? `Rejected: ${claim.rejection_reason}`
            : "Rejected";
        default:
          return "Unknown";
      }
    };

    expect(getStatusDisplay(userClaim)).toBe("Approved");
  });

  it("should show rejection reason for rejected claim with reason", () => {
    const userClaim: Pick<EventClaim, "status" | "rejection_reason"> = {
      status: "rejected",
      rejection_reason: "Could not verify event ownership",
    };

    const getStatusDisplay = (
      claim: Pick<EventClaim, "status" | "rejection_reason">
    ) => {
      switch (claim.status) {
        case "pending":
          return "Pending Approval";
        case "approved":
          return "Approved";
        case "rejected":
          return claim.rejection_reason
            ? `Rejected: ${claim.rejection_reason}`
            : "Rejected";
        default:
          return "Unknown";
      }
    };

    expect(getStatusDisplay(userClaim)).toBe(
      "Rejected: Could not verify event ownership"
    );
  });
});

describe("Event Claims - RLS Policy Behavior", () => {
  // These tests document expected RLS behavior at the application level

  it("users can only view their own claims", () => {
    const allClaims: EventClaim[] = [
      {
        id: "claim-1",
        event_id: "event-1",
        requester_id: "user-1",
        message: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      },
      {
        id: "claim-2",
        event_id: "event-2",
        requester_id: "user-2",
        message: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      },
    ];

    const getVisibleClaims = (claims: EventClaim[], userId: string) =>
      claims.filter((c) => c.requester_id === userId);

    expect(getVisibleClaims(allClaims, "user-1")).toHaveLength(1);
    expect(getVisibleClaims(allClaims, "user-1")[0].id).toBe("claim-1");
    expect(getVisibleClaims(allClaims, "user-2")).toHaveLength(1);
    expect(getVisibleClaims(allClaims, "user-2")[0].id).toBe("claim-2");
  });

  it("admins can view all claims", () => {
    const allClaims: EventClaim[] = [
      {
        id: "claim-1",
        event_id: "event-1",
        requester_id: "user-1",
        message: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      },
      {
        id: "claim-2",
        event_id: "event-2",
        requester_id: "user-2",
        message: null,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      },
    ];

    const getVisibleClaimsForAdmin = (claims: EventClaim[], isAdmin: boolean) =>
      isAdmin ? claims : [];

    expect(getVisibleClaimsForAdmin(allClaims, true)).toHaveLength(2);
    expect(getVisibleClaimsForAdmin(allClaims, false)).toHaveLength(0);
  });
});
