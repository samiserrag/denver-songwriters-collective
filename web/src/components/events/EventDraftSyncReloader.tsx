"use client";

import { useEffect } from "react";
import { subscribeEventDraftSync } from "@/lib/events/eventDraftSync";

export default function EventDraftSyncReloader({ eventId }: { eventId: string }) {
  useEffect(() => {
    return subscribeEventDraftSync(eventId, () => {
      window.location.reload();
    });
  }, [eventId]);

  return null;
}
