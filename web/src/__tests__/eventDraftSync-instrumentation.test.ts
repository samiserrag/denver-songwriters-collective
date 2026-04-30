import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("eventDraftSync debug instrumentation", () => {
  it("logs broadcast payload when NEXT_PUBLIC_DRAFT_SYNC_DEBUG=1", async () => {
    vi.stubEnv("NEXT_PUBLIC_DRAFT_SYNC_DEBUG", "1");

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const setItem = vi.fn();

    vi.stubGlobal("window", {
      localStorage: { setItem },
    } as unknown as Window & typeof globalThis);

    const { broadcastEventDraftSync } = await import("@/lib/events/eventDraftSync");

    broadcastEventDraftSync("evt_123", "updated", "interpreter-host");

    expect(infoSpy).toHaveBeenCalledWith("[eventDraftSync]", {
      kind: "broadcast",
      eventId: "evt_123",
      reason: "updated",
      source: "interpreter-host",
    });
  });

  it("does not log when debug flag is unset", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const setItem = vi.fn();

    vi.stubGlobal("window", {
      localStorage: { setItem },
    } as unknown as Window & typeof globalThis);

    const { broadcastEventDraftSync } = await import("@/lib/events/eventDraftSync");

    broadcastEventDraftSync("evt_123", "created", "interpreter-host");

    expect(infoSpy).not.toHaveBeenCalled();
  });
});
