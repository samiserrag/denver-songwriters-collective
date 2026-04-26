import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf-8");
}

describe("Publish state persistence guardrails", () => {
  it("EventForm syncs local is_published from server event prop", () => {
    const form = read("web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx");
    expect(form).toContain("Keep form publish state aligned with server state");
    expect(form).toContain("event?.is_published");
    expect(form).toContain("setFormData(prev =>");
    expect(form).toContain("const nextIsPublished = event.is_published");
    expect(form).toContain("is_published: nextIsPublished");
  });

  it("EventForm does not send is_published during ordinary edit saves", () => {
    const form = read("web/src/app/(protected)/dashboard/my-events/_components/EventForm.tsx");
    expect(form).toContain("Normal edit saves preserve publish state");
    expect(form).toContain('is_published: mode === "create" ? formData.is_published : shouldPublishAfterSave ? true : undefined');
    expect(form).toContain('data-publish-after-save="false"');
    expect(form).toContain('data-publish-after-save="true"');
  });

  it("PublishButton guards against persisted-state mismatch and shows explicit error", () => {
    const button = read("web/src/app/(protected)/dashboard/my-events/[id]/_components/PublishButton.tsx");
    expect(button).toContain("expectedPublishedState");
    expect(button).toContain("data?.is_published !== expectedPublishedState");
    expect(button).toContain("Publish request did not persist. Event is still draft.");
    expect(button).toContain("Failed to update publish status. Please refresh and try again.");
  });
});
