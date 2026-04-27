import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const componentSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
  ),
  "utf-8"
);
const syncSource = fs.readFileSync(
  path.resolve(__dirname, "../lib/events/eventDraftSync.ts"),
  "utf-8"
);
const reloaderSource = fs.readFileSync(
  path.resolve(__dirname, "../components/events/EventDraftSyncReloader.tsx"),
  "utf-8"
);
const editPageSource = fs.readFileSync(
  path.resolve(__dirname, "../app/(protected)/dashboard/my-events/[id]/page.tsx"),
  "utf-8"
);
const detailPageSource = fs.readFileSync(
  path.resolve(__dirname, "../app/events/[id]/page.tsx"),
  "utf-8"
);

describe("host conversational draft sync", () => {
  it("broadcasts draft changes after create, update, and cover writes", () => {
    expect(componentSource).toContain('broadcastEventDraftSync(newEventId, "created")');
    expect(componentSource).toContain('broadcastEventDraftSync(createdEventId, "updated")');
    expect(componentSource).toContain('broadcastEventDraftSync(targetEventId, "cover_updated")');
  });

  it("uses both BroadcastChannel and localStorage so other tabs can refresh", () => {
    expect(syncSource).toContain("BroadcastChannel");
    expect(syncSource).toContain("localStorage.setItem");
    expect(syncSource).toContain("window.addEventListener(\"storage\"");
  });

  it("refreshes edit and draft preview pages when the matching draft changes", () => {
    expect(reloaderSource).toContain("window.location.reload()");
    expect(editPageSource).toContain("<EventDraftSyncReloader eventId={eventId} />");
    expect(detailPageSource).toContain("<EventDraftSyncReloader eventId={event.id} />");
  });
});
