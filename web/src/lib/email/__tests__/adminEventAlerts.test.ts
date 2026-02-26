import { describe, expect, it, vi, beforeEach } from "vitest";

const { sendEmailMock, sendAdminWithPrefsMock, getServiceRoleClientMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  sendAdminWithPrefsMock: vi.fn(),
  getServiceRoleClientMock: vi.fn(),
}));

vi.mock("@/lib/email/mailer", () => ({
  ADMIN_EMAIL: "admin@example.com",
  sendEmail: sendEmailMock,
}));

vi.mock("@/lib/email/sendWithPreferences", () => ({
  sendAdminEmailWithPreferences: sendAdminWithPrefsMock,
}));

vi.mock("@/lib/supabase/serviceRoleClient", () => ({
  getServiceRoleClient: getServiceRoleClientMock,
}));

vi.mock("@/lib/email/render", () => ({
  SITE_URL: "https://coloradosongwriterscollective.org",
}));

import { sendAdminEventAlert } from "@/lib/email/adminEventAlerts";

describe("sendAdminEventAlert", () => {
  function makeSupabaseMock(rows: Array<{ id: string; email: string | null }> | null, error: unknown = null) {
    const notMock = vi.fn().mockResolvedValue({ data: rows, error });
    const eqMock = vi.fn().mockReturnValue({ not: notMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });
    return { from: fromMock, selectMock, eqMock, notMock };
  }

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendAdminWithPrefsMock.mockReset();
    getServiceRoleClientMock.mockReset();
    sendEmailMock.mockResolvedValue(true);
    sendAdminWithPrefsMock.mockResolvedValue(true);
  });

  it("sends create alert emails to resolved admin recipients with preference-aware helper", async () => {
    const supabase = makeSupabaseMock([
      { id: "admin-1", email: "admin1@example.com" },
      { id: "admin-2", email: "admin2@example.com" },
    ]);
    getServiceRoleClientMock.mockReturnValue(supabase);

    await sendAdminEventAlert({
      type: "created",
      actionContext: "create",
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

    expect(sendAdminWithPrefsMock).toHaveBeenCalledTimes(3); // two DB admins + ADMIN_EMAIL fallback address
    const firstPayload = sendAdminWithPrefsMock.mock.calls[0][3];
    expect(firstPayload.subject).toContain("Event created by non-admin");
    expect(firstPayload.text).toContain("Series events created: 4");
    expect(firstPayload.text).toContain("Action: Create event");
    expect(firstPayload.text).toContain("open-mic-night");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends edit occurrence alert with action metadata", async () => {
    const supabase = makeSupabaseMock([{ id: "admin-1", email: "admin@example.com" }]);
    getServiceRoleClientMock.mockReturnValue(supabase);

    await sendAdminEventAlert({
      type: "edited",
      actionContext: "edit_occurrence",
      actorUserId: "user-2",
      actorRole: "member",
      actorName: "Editor",
      actorEmail: "editor@example.com",
      eventId: "event-2",
      eventTitle: "Variety Open Mic",
      eventDate: "2026-03-15",
      occurrenceDateKey: "2026-03-22",
      changedFields: ["Time", "Venue"],
    });

    expect(sendAdminWithPrefsMock).toHaveBeenCalledTimes(1);
    const payload = sendAdminWithPrefsMock.mock.calls[0][3];
    expect(payload.subject).toContain("Event edited by non-admin");
    expect(payload.subject).toContain("Edit occurrence");
    expect(payload.text).toContain("- Time");
    expect(payload.text).toContain("- Venue");
    expect(payload.text).toContain("Occurrence: 2026-03-22");
    expect(payload.text).toContain("Action: Edit occurrence");
    expect(payload.templateName).toBe("adminEventLifecycleAlert");
  });

  it("falls back to direct admin email if preference-aware path throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getServiceRoleClientMock.mockImplementation(() => {
      throw new Error("missing service role");
    });

    await sendAdminEventAlert({
      type: "created",
      actorUserId: "user-3",
      eventId: "event-3",
      eventTitle: "Fallback Test",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.to).toBe("admin@example.com");
    expect(payload.templateName).toBe("adminEventLifecycleAlert");
    consoleErrorSpy.mockRestore();
  });
});
