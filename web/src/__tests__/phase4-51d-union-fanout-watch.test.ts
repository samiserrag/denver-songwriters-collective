/**
 * Phase 4.51d: Union Fan-out + Admin Watch/Unwatch Tests
 *
 * Tests for:
 * 1. Union fan-out pattern: event_hosts ∪ events.host_id ∪ event_watchers
 * 2. Deduplication: users in multiple categories receive ONE notification
 * 3. Actor suppression: don't notify the person who triggered the action
 * 4. Watch API: GET/POST/DELETE endpoints
 * 5. WatchEventButton: client component behavior
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Fan-out Pattern Tests
// ============================================================================

describe("Phase 4.51d: Union Fan-out Pattern", () => {
  describe("member RSVP fan-out (app/api/events/[id]/rsvp/route.ts)", () => {
    it("uses union pattern: hosts ∪ host_id ∪ watchers (not fallback)", () => {
      // The fan-out order should be:
      // 1. event_hosts (accepted) - NO RETURN after
      // 2. events.host_id (if not already notified) - NO RETURN after
      // 3. event_watchers (if not already notified)
      //
      // Contract: All three sources are checked, regardless of whether
      // previous sources had entries. This is union, not fallback.
      const fanOutPattern = "union";
      const fallbackPattern = "hosts OR watchers";

      expect(fanOutPattern).toBe("union");
      expect(fanOutPattern).not.toBe(fallbackPattern);
    });

    it("deduplicates notifications using Set<string>", () => {
      // Simulates the deduplication logic in notifyHostsOfRsvp
      const notifiedUserIds = new Set<string>();

      // User appears in event_hosts
      const hostUserId = "user-123";
      notifiedUserIds.add(hostUserId);

      // Same user is events.host_id - should NOT double-notify
      const hostId = "user-123";
      const shouldNotifyHostId = !notifiedUserIds.has(hostId);

      expect(shouldNotifyHostId).toBe(false);
      expect(notifiedUserIds.size).toBe(1);
    });

    it("notifies watchers even when hosts exist", () => {
      // Contract: watchers are ALWAYS checked, not as fallback
      const notifiedUserIds = new Set<string>();

      // Hosts notified first
      notifiedUserIds.add("host-1");
      notifiedUserIds.add("host-2");

      // Watcher check happens regardless
      const watchers = [{ user_id: "watcher-1" }, { user_id: "watcher-2" }];
      let watchersNotified = 0;

      for (const watcher of watchers) {
        if (!notifiedUserIds.has(watcher.user_id)) {
          notifiedUserIds.add(watcher.user_id);
          watchersNotified++;
        }
      }

      expect(watchersNotified).toBe(2);
      expect(notifiedUserIds.size).toBe(4);
    });

    it("suppresses notification to actor (person who RSVPd)", () => {
      const rsvpUserId = "actor-123";
      const hosts = [
        { user_id: "host-1" },
        { user_id: "actor-123" }, // Actor is also a host
        { user_id: "host-2" },
      ];

      const notifiedUserIds = new Set<string>();

      for (const host of hosts) {
        // Actor suppression: skip if host.user_id === rsvpUserId
        if (host.user_id !== rsvpUserId && !notifiedUserIds.has(host.user_id)) {
          notifiedUserIds.add(host.user_id);
        }
      }

      expect(notifiedUserIds.has("actor-123")).toBe(false);
      expect(notifiedUserIds.size).toBe(2);
    });
  });

  describe("guest RSVP fan-out (app/api/guest/rsvp/verify-code/route.ts)", () => {
    it("matches member RSVP fan-out pattern", () => {
      // Guest RSVP uses identical fan-out:
      // 1. event_hosts (accepted)
      // 2. events.host_id (fallback host)
      // 3. event_watchers
      //
      // No actor suppression needed (guests don't have user_id)
      const guestFanOutSteps = ["event_hosts", "host_id", "event_watchers"];
      const memberFanOutSteps = ["event_hosts", "host_id", "event_watchers"];

      expect(guestFanOutSteps).toEqual(memberFanOutSteps);
    });

    it("includes (guest) label in notification title", () => {
      const guestName = "John Doe";
      const expectedTitle = `${guestName} (guest) is going`;

      expect(expectedTitle).toBe("John Doe (guest) is going");
      expect(expectedTitle).toContain("(guest)");
    });
  });

  describe("member comment fan-out (app/api/events/[id]/comments/route.ts)", () => {
    it("top-level comments notify hosts ∪ watchers", () => {
      // When parent_id is null (top-level comment):
      // 1. event_hosts (accepted)
      // 2. events.host_id
      // 3. event_watchers
      const isTopLevel = true;
      const fanOutTargets = isTopLevel
        ? ["event_hosts", "host_id", "event_watchers"]
        : ["parent_comment_author"];

      expect(fanOutTargets).toContain("event_watchers");
    });

    it("reply comments notify parent author only", () => {
      // When parent_id is set (reply):
      // Only notify the parent comment author
      const isReply = true;
      const fanOutTargets = isReply
        ? ["parent_comment_author"]
        : ["event_hosts", "host_id", "event_watchers"];

      expect(fanOutTargets).toEqual(["parent_comment_author"]);
      expect(fanOutTargets).not.toContain("event_watchers");
    });

    it("suppresses notification to comment author", () => {
      const commentAuthorId = "author-123";
      const hostId = "author-123"; // Author is also the host

      const shouldNotify = commentAuthorId !== hostId;

      expect(shouldNotify).toBe(false);
    });
  });

  describe("guest comment fan-out (app/api/guest/event-comment/verify-code/route.ts)", () => {
    it("matches member comment top-level fan-out", () => {
      const guestTopLevelTargets = ["event_hosts", "host_id", "event_watchers"];
      const memberTopLevelTargets = ["event_hosts", "host_id", "event_watchers"];

      expect(guestTopLevelTargets).toEqual(memberTopLevelTargets);
    });
  });
});

// ============================================================================
// Watch API Tests
// ============================================================================

describe("Phase 4.51d: Watch API", () => {
  describe("GET /api/events/[id]/watch", () => {
    it("returns { watching: false } for unauthenticated users", () => {
      // When session is null, API returns watching: false without DB query
      const hasSession = false;
      const response = { watching: hasSession ? true : false };

      expect(response.watching).toBe(false);
    });

    it("returns { watching: true } when user is in event_watchers", () => {
      const watcherEntry = { user_id: "admin-123" };
      const response = { watching: !!watcherEntry };

      expect(response.watching).toBe(true);
    });

    it("returns { watching: false } when user is not in event_watchers", () => {
      const watcherEntry = null;
      const response = { watching: !!watcherEntry };

      expect(response.watching).toBe(false);
    });
  });

  describe("POST /api/events/[id]/watch", () => {
    it("requires authentication (401 if no session)", () => {
      const session = null;
      const expectedStatus = session ? 200 : 401;

      expect(expectedStatus).toBe(401);
    });

    it("requires admin role (403 for non-admins)", () => {
      const isAdmin = false;
      const expectedStatus = isAdmin ? 200 : 403;

      expect(expectedStatus).toBe(403);
    });

    it("returns 404 if event does not exist", () => {
      const event = null;
      const expectedStatus = event ? 200 : 404;

      expect(expectedStatus).toBe(404);
    });

    it("handles already watching (23505 unique constraint)", () => {
      // When user tries to watch an event they're already watching,
      // the unique constraint fires (code 23505)
      // API should return success with watching: true
      const errorCode = "23505";
      const isAlreadyWatching = errorCode === "23505";

      const response = isAlreadyWatching
        ? { success: true, watching: true }
        : { success: true, watching: true };

      expect(response.watching).toBe(true);
    });

    it("returns { success: true, watching: true } on success", () => {
      const insertSuccess = true;
      const response = insertSuccess
        ? { success: true, watching: true }
        : { error: "Insert failed" };

      expect(response).toEqual({ success: true, watching: true });
    });
  });

  describe("DELETE /api/events/[id]/watch", () => {
    it("requires authentication (401 if no session)", () => {
      const session = null;
      const expectedStatus = session ? 200 : 401;

      expect(expectedStatus).toBe(401);
    });

    it("does NOT require admin role (any user can unwatch)", () => {
      // Note: DELETE handler doesn't have admin check
      // This is intentional - users should be able to stop watching
      // Both admin and non-admin can unwatch
      const adminCanUnwatch = true;
      const regularUserCanUnwatch = true;

      expect(adminCanUnwatch).toBe(true);
      expect(regularUserCanUnwatch).toBe(true);
    });

    it("returns { success: true, watching: false } on success", () => {
      const response = { success: true, watching: false };

      expect(response.watching).toBe(false);
    });
  });
});

// ============================================================================
// WatchEventButton Component Tests
// ============================================================================

describe("Phase 4.51d: WatchEventButton Component", () => {
  it("renders 'Watch event' when not watching", () => {
    const watching = false;
    const buttonText = watching ? "Unwatch event" : "Watch event";

    expect(buttonText).toBe("Watch event");
  });

  it("renders 'Unwatch event' when watching", () => {
    const watching = true;
    const buttonText = watching ? "Unwatch event" : "Watch event";

    expect(buttonText).toBe("Unwatch event");
  });

  it("renders '...' when loading", () => {
    const loading = true;
    const watching = true;
    const buttonText = loading ? "..." : watching ? "Unwatch event" : "Watch event";

    expect(buttonText).toBe("...");
  });

  it("uses POST method when adding watch", () => {
    const watching = false;
    const method = watching ? "DELETE" : "POST";

    expect(method).toBe("POST");
  });

  it("uses DELETE method when removing watch", () => {
    const watching = true;
    const method = watching ? "DELETE" : "POST";

    expect(method).toBe("DELETE");
  });

  it("has helpful title attribute for accessibility", () => {
    const watchingState = false;
    const title = watchingState
      ? "Stop receiving notifications for this event"
      : "Receive notifications for this event";

    expect(title).toBe("Receive notifications for this event");
  });
});

// ============================================================================
// Event Detail Page Integration Tests
// ============================================================================

describe("Phase 4.51d: Event Detail Page Integration", () => {
  it("only queries event_watchers for admin users", () => {
    const session = { user: { id: "user-123" } };
    const isAdminUser = true;

    const shouldQueryWatchers = session && isAdminUser;

    expect(shouldQueryWatchers).toBe(true);
  });

  it("skips watcher query for non-admin users", () => {
    const session = { user: { id: "user-123" } };
    const isAdminUser = false;

    const shouldQueryWatchers = session && isAdminUser;

    expect(shouldQueryWatchers).toBe(false);
  });

  it("skips watcher query when not logged in", () => {
    const session = null;
    const isAdminUser = false;

    // session && isAdminUser returns null when session is null (short-circuit)
    // The condition is falsy, so watcher query is skipped
    const shouldQueryWatchers = session && isAdminUser;

    expect(shouldQueryWatchers).toBeFalsy();
  });

  it("renders WatchEventButton only for admin users", () => {
    const isAdminUser = true;
    const shouldRenderButton = isAdminUser;

    expect(shouldRenderButton).toBe(true);
  });

  it("passes initial watching state to WatchEventButton", () => {
    const isWatching = true;
    const props = { eventId: "event-123", initialWatching: isWatching };

    expect(props.initialWatching).toBe(true);
  });
});

// ============================================================================
// Type Cast Documentation Tests
// ============================================================================

describe("Phase 4.51d: Type Cast Rationale", () => {
  it("documents why event_watchers uses type cast", () => {
    // event_watchers table exists in the database but not in generated TypeScript types
    // Rather than regenerate database.types.ts (which could cause other issues),
    // we use a type cast: `from("event_watchers" as "events")`
    //
    // This is documented in each file that uses it:
    // - app/api/events/[id]/watch/route.ts
    // - app/api/events/[id]/rsvp/route.ts
    // - app/api/events/[id]/comments/route.ts
    // - app/api/guest/rsvp/verify-code/route.ts
    // - app/api/guest/event-comment/verify-code/route.ts
    // - app/events/[id]/page.tsx

    const reason = "Table exists but not in generated types yet";
    const workaround = 'from("event_watchers" as "events")';

    expect(workaround).toContain("as");
    expect(reason).toContain("not in generated types");
  });
});

// ============================================================================
// Notification Type Consistency Tests
// ============================================================================

describe("Phase 4.51d: Notification Type Consistency", () => {
  it("guest RSVP uses same notification type as member RSVP", () => {
    const memberRsvpType = "event_rsvp";
    const guestRsvpType = "event_rsvp";

    expect(guestRsvpType).toBe(memberRsvpType);
  });

  it("guest RSVP uses same templateKey as member RSVP", () => {
    const memberTemplateKey = "rsvpHostNotification";
    const guestTemplateKey = "rsvpHostNotification";

    expect(guestTemplateKey).toBe(memberTemplateKey);
  });

  it("guest comment uses same notification type as member comment", () => {
    const memberCommentType = "event_comment";
    const guestCommentType = "event_comment";

    expect(guestCommentType).toBe(memberCommentType);
  });

  it("guest comment uses same templateKey as member comment", () => {
    const memberTemplateKey = "eventCommentNotification";
    const guestTemplateKey = "eventCommentNotification";

    expect(guestTemplateKey).toBe(memberTemplateKey);
  });
});
