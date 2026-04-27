"use client";

export type EventDraftSyncReason = "created" | "updated" | "cover_updated" | "published";

export const EVENT_DRAFT_SYNC_CHANNEL = "csc-event-draft-sync";
export const EVENT_DRAFT_SYNC_STORAGE_KEY = "csc:event-draft-sync";

export interface EventDraftSyncPayload {
  eventId: string;
  reason: EventDraftSyncReason;
  at: number;
}

function isEventDraftSyncPayload(value: unknown): value is EventDraftSyncPayload {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.eventId === "string" &&
    typeof row.reason === "string" &&
    typeof row.at === "number"
  );
}

function parsePayload(raw: string | null): EventDraftSyncPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isEventDraftSyncPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function broadcastEventDraftSync(
  eventId: string,
  reason: EventDraftSyncReason
): void {
  if (typeof window === "undefined") return;
  if (!eventId.trim()) return;

  const payload: EventDraftSyncPayload = {
    eventId,
    reason,
    at: Date.now(),
  };

  try {
    window.localStorage.setItem(EVENT_DRAFT_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }

  if ("BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(EVENT_DRAFT_SYNC_CHANNEL);
      channel.postMessage(payload);
      channel.close();
    } catch {
      // Storage event fallback above still covers other tabs.
    }
  }
}

export function subscribeEventDraftSync(
  eventId: string,
  onSync: (payload: EventDraftSyncPayload) => void
): () => void {
  if (typeof window === "undefined" || !eventId.trim()) return () => undefined;

  const handlePayload = (payload: EventDraftSyncPayload | null) => {
    if (!payload || payload.eventId !== eventId) return;
    onSync(payload);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== EVENT_DRAFT_SYNC_STORAGE_KEY) return;
    handlePayload(parsePayload(event.newValue));
  };

  window.addEventListener("storage", handleStorage);

  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(EVENT_DRAFT_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        handlePayload(isEventDraftSyncPayload(event.data) ? event.data : null);
      };
    } catch {
      channel = null;
    }
  }

  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.close();
  };
}

export function readLatestEventDraftSyncPayload(eventId: string): EventDraftSyncPayload | null {
  if (typeof window === "undefined" || !eventId.trim()) return null;
  try {
    const payload = parsePayload(window.localStorage.getItem(EVENT_DRAFT_SYNC_STORAGE_KEY));
    return payload?.eventId === eventId ? payload : null;
  } catch {
    return null;
  }
}
