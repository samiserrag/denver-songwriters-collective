import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const SERIES_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/ai/page.tsx"
);
const OCCURRENCE_ROUTE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/overrides/[dateKey]/ai/page.tsx"
);

const componentSource = fs.readFileSync(COMPONENT_PATH, "utf-8");
const seriesRouteSource = fs.readFileSync(SERIES_ROUTE_PATH, "utf-8");
const occurrenceRouteSource = fs.readFileSync(OCCURRENCE_ROUTE_PATH, "utf-8");

describe("AI edit route wrappers", () => {
  it("adds the series edit AI route as a thin authenticated wrapper", () => {
    expect(seriesRouteSource).toContain("createSupabaseServerClient");
    expect(seriesRouteSource).toContain("canManageEvent");
    expect(seriesRouteSource).toContain("supabase.auth.getUser()");
    expect(seriesRouteSource).toContain('redirect("/login")');
    expect(seriesRouteSource).toContain('.from("events")');
    expect(seriesRouteSource).toContain(".maybeSingle()");
    expect(seriesRouteSource).toContain("notFound()");
    expect(seriesRouteSource).toContain('redirect("/dashboard")');
    expect(seriesRouteSource).toContain('initialMode="edit_series"');
    expect(seriesRouteSource).toContain("initialEventId={eventId}");
    expect(seriesRouteSource).toContain('pageTitle="Edit Happening With AI"');
    expect(seriesRouteSource).toContain("Ask AI to draft updates for this happening");
    expect(seriesRouteSource).toContain("backHref={`/dashboard/my-events/${eventId}`}");
    expect(seriesRouteSource).toContain('backLabel="Back to happening"');
  });

  it("adds the occurrence edit AI route with YYYY-MM-DD validation", () => {
    expect(occurrenceRouteSource).toContain("createSupabaseServerClient");
    expect(occurrenceRouteSource).toContain("canManageEvent");
    expect(occurrenceRouteSource).toContain("/^\\d{4}-\\d{2}-\\d{2}$/.test(dateKey)");
    expect(occurrenceRouteSource).toContain("notFound()");
    expect(occurrenceRouteSource).toContain('initialMode="edit_occurrence"');
    expect(occurrenceRouteSource).toContain("initialEventId={eventId}");
    expect(occurrenceRouteSource).toContain("initialDateKey={dateKey}");
    expect(occurrenceRouteSource).toContain('pageTitle="Edit Occurrence With AI"');
    expect(occurrenceRouteSource).toContain("Ask AI to draft updates for this occurrence");
    expect(occurrenceRouteSource).toContain("backHref={`/dashboard/my-events/${eventId}/overrides/${dateKey}`}");
    expect(occurrenceRouteSource).toContain('backLabel="Back to occurrence"');
  });

  it("keeps existing-event route writes disabled until the published-event gate ships", () => {
    expect(seriesRouteSource).toContain("allowExistingEventWrites={false}");
    expect(occurrenceRouteSource).toContain("allowExistingEventWrites={false}");
    expect(seriesRouteSource).not.toContain("createdEventId");
    expect(occurrenceRouteSource).not.toContain("createdEventId");
  });
});

describe("ConversationalCreateUI PR 6 edit-mode safety", () => {
  it("accepts explicit initial edit context without changing create-host defaults", () => {
    expect(componentSource).toContain('initialMode = "create"');
    expect(componentSource).toContain('initialEventId = ""');
    expect(componentSource).toContain('initialDateKey = ""');
    expect(componentSource).toContain("allowExistingEventWrites = true");
    expect(componentSource).toContain("useState<InterpretMode>(initialMode)");
    expect(componentSource).toContain("useState(initialEventId)");
    expect(componentSource).toContain("useState(initialDateKey)");
  });

  it("lets host wrappers mount edit modes without seeding createdEventId", () => {
    expect(componentSource).toContain("const [createdEventId, setCreatedEventId] = useState<string | null>(null)");
    expect(componentSource).toContain("const hostChatMode: InterpretMode");
    expect(componentSource).toContain('hasCreatedDraft ? "edit_series"');
    expect(componentSource).toContain("isInitialEditMode ? initialMode");
    expect(componentSource).toContain("isHostVariant ? hostChatMode : mode");
    expect(componentSource).toContain("? initialMode");
  });

  it("keeps the create-flow auto-PATCH shortcut limited to created drafts", () => {
    expect(componentSource).toContain('effectiveMode === "edit_series" && createdEventId');
    expect(componentSource).toContain("await applySeriesPatch(nextInterpretResponse, { automatic: true })");
    expect(componentSource).toContain("if (!sourceResponse || !createdEventId) return;");
  });

  it("gates cover and occurrence writes for existing-event edit sessions", () => {
    expect(componentSource).toContain("const isExistingEventEditSession");
    expect(componentSource).toContain("const canWriteExistingEvent = allowExistingEventWrites || !isExistingEventEditSession");
    expect(componentSource).toContain("isEditMode && hasValidEventId && canWriteExistingEvent");
    expect(componentSource).toContain("effectiveMode === \"edit_occurrence\"");
    expect(componentSource).toContain("canWriteExistingEvent &&");
    expect(componentSource).toContain("isEditMode && targetEventId && canWriteExistingEvent");
    expect(componentSource).toContain("!hasValidEventId || !canWriteExistingEvent");
  });

  it("exposes minimal copy and navigation props with existing default copy", () => {
    expect(componentSource).toContain("pageTitle?: string");
    expect(componentSource).toContain("pageDescription?: string");
    expect(componentSource).toContain("backHref?: string");
    expect(componentSource).toContain("backLabel?: string");
    expect(componentSource).toContain('pageTitle ?? (isHostVariant ? "Create Happening with AI"');
    expect(componentSource).toContain("Turn a flyer, link, or rough notes into a private event draft");
    expect(componentSource).toContain("Conversational Event Creator (Lab)");
    expect(componentSource).toContain("/dashboard/my-events/new?classic=true");
    expect(componentSource).toContain("Use classic form instead");
    expect(componentSource).toContain("{effectivePageTitle}");
    expect(componentSource).toContain("{effectivePageDescription}");
    expect(componentSource).toContain("href={effectiveBackHref}");
    expect(componentSource).toContain("{effectiveBackLabel}");
  });
});
