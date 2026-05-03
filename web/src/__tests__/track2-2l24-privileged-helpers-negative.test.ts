import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const EVENT_MANAGE_AUTH_PATH = join(WEB_SRC, "lib/events/eventManageAuth.ts");
const VENUE_MANAGER_AUTH_PATH = join(WEB_SRC, "lib/venue/managerAuth.ts");
const INVITEE_ACCESS_PATH = join(
  WEB_SRC,
  "lib/attendee-session/checkInviteeAccess.ts",
);
const EVENT_UPDATE_ROUTE_PATH = join(
  WEB_SRC,
  "app/api/event-update-suggestions/route.ts",
);
const EVENT_UPDATE_HELPER_PATH = join(
  WEB_SRC,
  "lib/eventUpdateSuggestions/server.ts",
);
const ADMIN_ALERTS_PATH = join(WEB_SRC, "lib/email/adminEventAlerts.ts");
const OPS_AUDIT_PATH = join(WEB_SRC, "lib/audit/opsAudit.ts");
const VENUE_AUDIT_PATH = join(WEB_SRC, "lib/audit/venueAudit.ts");
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md",
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md",
);

const eventManageAuthSource = readFileSync(EVENT_MANAGE_AUTH_PATH, "utf-8");
const venueManagerAuthSource = readFileSync(VENUE_MANAGER_AUTH_PATH, "utf-8");
const inviteeAccessSource = readFileSync(INVITEE_ACCESS_PATH, "utf-8");
const eventUpdateRouteSource = readFileSync(EVENT_UPDATE_ROUTE_PATH, "utf-8");
const eventUpdateHelperSource = readFileSync(EVENT_UPDATE_HELPER_PATH, "utf-8");
const adminAlertsSource = readFileSync(ADMIN_ALERTS_PATH, "utf-8");
const opsAuditSource = readFileSync(OPS_AUDIT_PATH, "utf-8");
const venueAuditSource = readFileSync(VENUE_AUDIT_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function sourceAfter(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start, `Missing marker ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(start);
}

function expectBefore(source: string, before: string, after: string): void {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  expect(beforeIndex, `Missing before marker ${before}`).toBeGreaterThanOrEqual(0);
  expect(afterIndex, `Missing after marker ${after}`).toBeGreaterThanOrEqual(0);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(
    afterIndex,
  );
}

const eventUpdatePostSource = sourceAfter(
  eventUpdateRouteSource,
  "export async function POST",
);
const managerEditableVenueFieldsSource = venueManagerAuthSource.slice(
  venueManagerAuthSource.indexOf("export const MANAGER_EDITABLE_VENUE_FIELDS = ["),
  venueManagerAuthSource.indexOf("] as const;") + "] as const;".length,
);

describe("Track 2 2L.24 privileged helper BOLA negative cluster", () => {
  it("keeps event-management authorization scoped to path event and active actor status", () => {
    expect(eventManageAuthSource).toContain("checkAdminRole(supabase, userId)");
    expect(eventManageAuthSource).toContain('.from("events")');
    expect(eventManageAuthSource).toContain('.select("host_id")');
    expect(eventManageAuthSource).toContain('.eq("id", eventId)');
    expect(eventManageAuthSource).toContain("event?.host_id === userId");
    expect(eventManageAuthSource).toContain('.from("event_hosts")');
    expect(eventManageAuthSource).toContain('.eq("event_id", eventId)');
    expect(eventManageAuthSource).toContain('.eq("user_id", userId)');
    expect(eventManageAuthSource).toContain(
      '.eq("invitation_status", "accepted")',
    );
    expect(eventManageAuthSource).toContain('.eq("role", "host")');
    expect(eventManageAuthSource).not.toContain('"pending"');
    expect(eventManageAuthSource).not.toContain('"rejected"');
  });

  it("keeps venue authorization scoped to path venue/user and excludes revoked grants", () => {
    expect(venueManagerAuthSource).toContain("MANAGER_EDITABLE_VENUE_FIELDS");
    expect(managerEditableVenueFieldsSource).not.toContain('"notes"');
    expect(managerEditableVenueFieldsSource).not.toContain('"id"');
    expect(managerEditableVenueFieldsSource).not.toContain('"created_at"');
    expect(managerEditableVenueFieldsSource).not.toContain('"updated_at"');

    expect(venueManagerAuthSource).toContain('.from("venue_managers")');
    expect(venueManagerAuthSource).toContain('.eq("venue_id", venueId)');
    expect(venueManagerAuthSource).toContain('.eq("user_id", userId)');
    expect(venueManagerAuthSource).toContain('.is("revoked_at", null)');
    expect(venueManagerAuthSource).toContain(
      "const isManager = await isVenueManager(supabase, venueId, userId)",
    );
    expect(venueManagerAuthSource).toContain("isEventHostAtVenue(supabase, venueId, userId)");
    expect(venueManagerAuthSource).toContain('.eq("host_id", userId)');
    expect(venueManagerAuthSource).toContain(
      '.eq("invitation_status", "accepted")',
    );
    expect(venueManagerAuthSource).toContain("eventVenueId === venueId");
  });

  it("keeps invitee access service-role usage limited to scoped accepted invite checks", () => {
    expect(inviteeAccessSource).toContain("createServiceRoleClient()");
    expect(inviteeAccessSource).toContain("readAttendeeCookie(eventId)");
    expect(inviteeAccessSource).toContain('.from("event_attendee_invites")');
    expect(inviteeAccessSource).toContain('.eq("event_id", eventId)');
    expect(inviteeAccessSource).toContain('.eq("user_id", userId)');
    expect(inviteeAccessSource).toContain('.eq("id", cookiePayload.invite_id)');
    expect(inviteeAccessSource).toContain('.eq("status", "accepted")');
    expect(inviteeAccessSource).toContain("!isExpired(invite.expires_at)");
    expect(inviteeAccessSource).toContain("return { hasAccess: false }");
    expect(inviteeAccessSource).not.toContain("auth.admin");
    expect(inviteeAccessSource).not.toContain("sendEmail(");
  });

  it("keeps public suggestion helper writes behind route-local validation and before email fanout", () => {
    expectBefore(eventUpdatePostSource, "if (!body?.event_id)", "insertEventUpdateSuggestion(payload)");
    expectBefore(eventUpdatePostSource, "if (!body.field", "insertEventUpdateSuggestion(payload)");
    expectBefore(eventUpdatePostSource, "if (!body.new_value", "insertEventUpdateSuggestion(payload)");
    expectBefore(eventUpdatePostSource, "if (!ALLOWED_FIELDS.includes(body.field))", "insertEventUpdateSuggestion(payload)");
    expectBefore(eventUpdatePostSource, "if (!uuidRegex.test(body.event_id))", "insertEventUpdateSuggestion(payload)");
    expectBefore(eventUpdatePostSource, "insertEventUpdateSuggestion(payload)", "createServiceRoleClient()");
    expectBefore(eventUpdatePostSource, "insertEventUpdateSuggestion(payload)", "sendEmail({");
    expect(eventUpdatePostSource).toContain("event_id: body.event_id");

    expect(eventUpdateHelperSource).toContain("createServiceRoleClient()");
    expect(eventUpdateHelperSource).toContain('.from("event_update_suggestions")');
    expect(eventUpdateHelperSource).toContain(".insert(payload)");
    expect(eventUpdateHelperSource).not.toContain("auth.admin");
  });

  it("keeps privileged email and audit helpers caller-scoped with no auth-admin escalation", () => {
    expect(adminAlertsSource).toContain("actorUserId: string");
    expect(adminAlertsSource).toContain("eventId: string");
    expect(adminAlertsSource).toContain("getServiceRoleClient()");
    expect(adminAlertsSource).toContain('.from("profiles")');
    expect(adminAlertsSource).toContain('.eq("role", "admin")');
    expect(adminAlertsSource).toContain("sendAdminEmailWithPreferences(");
    expect(adminAlertsSource).not.toContain("auth.admin");
    expect(adminAlertsSource).not.toContain("SUPABASE_SERVICE_ROLE_KEY");

    for (const auditSource of [opsAuditSource, venueAuditSource]) {
      expect(auditSource).toContain('if (typeof window !== "undefined")');
      expect(auditSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(auditSource).toContain('.from("app_logs")');
      expect(auditSource).toContain("actorId");
      expect(auditSource).toContain("user_id: actorId");
      expect(auditSource).not.toContain("auth.admin");
      expect(auditSource).not.toContain("sendEmail(");
    }

    expect(opsAuditSource).toContain("action: OpsAction");
    expect(venueAuditSource).toContain("venueId: string");
    expect(venueAuditSource).toContain('actorRole: "manager" | "admin" | "host"');
  });

  it("records this source-contract cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l24-privileged-helpers-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PRIVILEGED-HELPERS");
    expect(matrixSource).toContain(testPath);
    expect(matrixSource).toContain("caller-authorized privileged helper contracts");
    expect(matrixSource).toContain("full caller route-invocation coverage remains future work");

    for (const manifestId of [
      "T2-SR-INVITEE-ACCESS-HELPER",
      "T2-SR-EVENT-UPDATE-SUGGESTIONS",
      "T2-SR-ADMIN-EVENT-ALERTS-HELPER",
      "T2-SR-OPS-AUDIT-HELPER",
      "T2-SR-VENUE-AUDIT-HELPER",
    ]) {
      expect(manifestSource).toContain(manifestId);
    }

    expect(manifestSource).toContain(testPath);
    expect(manifestSource).toContain("caller-authorized privileged helper contracts");
  });
});
