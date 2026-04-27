"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  readLatestEventDraftSyncPayload,
  subscribeEventDraftSync,
  type EventDraftSyncPayload,
} from "@/lib/events/eventDraftSync";

export default function EventDraftSyncReloader({ eventId }: { eventId: string }) {
  const lastSeenSyncAt = useRef(0);

  const reloadForSync = useCallback((payload: EventDraftSyncPayload) => {
    lastSeenSyncAt.current = Math.max(lastSeenSyncAt.current, payload.at);
    window.location.reload();
  }, []);

  const reloadIfMissedWhileBackgrounded = useCallback(() => {
    if (document.visibilityState !== "visible") return;
    const latestPayload = readLatestEventDraftSyncPayload(eventId);
    if (!latestPayload || latestPayload.at <= lastSeenSyncAt.current) return;
    reloadForSync(latestPayload);
  }, [eventId, reloadForSync]);

  useEffect(() => {
    lastSeenSyncAt.current = Date.now();
    return subscribeEventDraftSync(eventId, reloadForSync);
  }, [eventId, reloadForSync]);

  useEffect(() => {
    window.addEventListener("focus", reloadIfMissedWhileBackgrounded);
    document.addEventListener("visibilitychange", reloadIfMissedWhileBackgrounded);

    return () => {
      window.removeEventListener("focus", reloadIfMissedWhileBackgrounded);
      document.removeEventListener("visibilitychange", reloadIfMissedWhileBackgrounded);
    };
  }, [reloadIfMissedWhileBackgrounded]);

  return null;
}
