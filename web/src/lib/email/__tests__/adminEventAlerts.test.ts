import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  ADMIN_EMAIL: "admin@example.com",
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/email/render", () => ({
  SITE_URL: "https://coloradosongwriterscollective.org",
}));

import { sendAdminEventAlert } from "@/lib/email/adminEventAlerts";

describe("sendAdminEventAlert", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(true);
  });

  it("sends create alert email with series count", async () => {
    await sendAdminEventAlert({
      type: "created",
      actorUserId: "user-1",
      actorRole: "member",
      actorName: "Test Member",
      actorEmail: "member@example.com",
      eventId: "event-1",
      eventSlug: "open-mic-night",
      eventTitle: "Open Mic Night",
      eventDate: "2026-03-10",
      seriesCount: 4,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.to).toBe("admin@example.com");
    expect(payload.subject).toContain("Event created by non-admin");
    expect(payload.text).toContain("Series events created: 4");
    expect(payload.text).toContain("open-mic-night");
  });

  it("sends edit alert email with changed fields", async () => {
    await sendAdminEventAlert({
      type: "edited",
      actorUserId: "user-2",
      actorRole: "member",
      actorName: "Editor",
      actorEmail: "editor@example.com",
      eventId: "event-2",
      eventTitle: "Variety Open Mic",
      eventDate: "2026-03-15",
      changedFields: ["Time", "Venue"],
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.subject).toContain("Event edited by non-admin");
    expect(payload.text).toContain("- Time");
    expect(payload.text).toContain("- Venue");
    expect(payload.templateName).toBe("adminEventLifecycleAlert");
  });
});
