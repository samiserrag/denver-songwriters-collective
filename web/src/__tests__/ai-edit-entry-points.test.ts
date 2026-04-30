import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const EVENT_DETAIL_PAGE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/page.tsx"
);
const EVENT_FORM_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/EventForm.tsx"
);
const OCCURRENCE_EDITOR_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/[id]/overrides/_components/OccurrenceEditor.tsx"
);

const eventDetailSource = fs.readFileSync(EVENT_DETAIL_PAGE_PATH, "utf-8");
const eventFormSource = fs.readFileSync(EVENT_FORM_PATH, "utf-8");
const occurrenceEditorSource = fs.readFileSync(OCCURRENCE_EDITOR_PATH, "utf-8");

describe("AI edit entry points", () => {
  it("links the event detail header to the series AI edit route", () => {
    expect(eventDetailSource).toContain('href={`/dashboard/my-events/${eventId}/ai`}');
    expect(eventDetailSource).toContain("Update with AI");

    expect(eventDetailSource.indexOf("<PublishButton")).toBeLessThan(
      eventDetailSource.indexOf('href={`/dashboard/my-events/${eventId}/ai`}')
    );
    expect(eventDetailSource.indexOf('href={`/dashboard/my-events/${eventId}/ai`}')).toBeLessThan(
      eventDetailSource.indexOf("<CancelEventButton")
    );
  });

  it("adds an EventForm AI action for edit mode only", () => {
    expect(eventFormSource).toContain('const aiEditPath = mode !== "edit"');
    expect(eventFormSource).toContain("`/dashboard/my-events/${event.id}/ai`");
    expect(eventFormSource).toContain(
      "`/dashboard/my-events/${occurrenceEventId}/overrides/${occurrenceDateKey}/ai`"
    );
    expect(eventFormSource).toContain(
      'const aiEditActionLabel = occurrenceMode ? "Edit occurrence with AI" : "Update with AI";'
    );
    expect(eventFormSource).toContain("onClick={() => router.push(aiEditPath)}");
    expect(eventFormSource).toContain('<Wand2 className="h-4 w-4" aria-hidden="true" />');
  });

  it("links each occurrence row to the occurrence AI edit route", () => {
    expect(occurrenceEditorSource).toContain(
      'href={`/dashboard/my-events/${eventId}/overrides/${occ.dateKey}/ai`}'
    );
    expect(occurrenceEditorSource).toContain("Edit with AI");

    const aiEditLabelIndex = occurrenceEditorSource.indexOf("Edit with AI");
    expect(occurrenceEditorSource.indexOf("Preview")).toBeLessThan(
      aiEditLabelIndex
    );
    expect(aiEditLabelIndex).toBeLessThan(
      occurrenceEditorSource.indexOf("{occ.isCancelled ? (", aiEditLabelIndex)
    );
  });

  it("keeps entry-point copy scoped to navigation, not completed write behavior", () => {
    const changedSource = [
      eventDetailSource,
      eventFormSource,
      occurrenceEditorSource,
    ].join("\n");

    expect(changedSource).not.toContain("saved automatically");
    expect(changedSource).not.toContain("automatically saves");
    expect(changedSource).not.toContain("applies changes");
    expect(changedSource).not.toContain("URL schedule import");
  });
});
