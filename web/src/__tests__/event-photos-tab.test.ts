/**
 * Tests: Event Photos tab wiring
 *
 * Verifies that EventPhotosSection is wired into the event management
 * tab UI via the existing component (no new components created).
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("EventManagementTabs — Photos tab definition", () => {
  const tabsPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/my-events/[id]/_components/EventManagementTabs.tsx"
  );
  const content = fs.readFileSync(tabsPath, "utf-8");

  it("should include 'photos' in TabId type", () => {
    expect(content).toContain('"photos"');
  });

  it("should have a Photos tab entry with icon", () => {
    expect(content).toMatch(/id:\s*"photos"/);
    expect(content).toMatch(/label:\s*"Photos"/);
  });
});

describe("EventManagementClient — Photos tab rendering", () => {
  const clientPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/my-events/[id]/_components/EventManagementClient.tsx"
  );
  const content = fs.readFileSync(clientPath, "utf-8");

  it("should accept PhotosContent as a React.ReactNode prop", () => {
    expect(content).toContain("PhotosContent: React.ReactNode");
  });

  it("should render PhotosContent when photos tab is active", () => {
    expect(content).toContain('activeTab === "photos"');
    expect(content).toContain("PhotosContent");
  });
});

describe("Event management page — event_images query and PhotosContent", () => {
  const pagePath = path.join(
    __dirname,
    "../app/(protected)/dashboard/my-events/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should query event_images table", () => {
    expect(content).toContain("event_images");
    expect(content).toContain("eventImages");
  });

  it("should import EventPhotosSection", () => {
    expect(content).toContain("EventPhotosSection");
  });

  it("should pass PhotosContent prop to EventManagementClient", () => {
    expect(content).toContain("PhotosContent={");
    expect(content).toContain("<EventPhotosSection");
  });

  it("should pass required props to EventPhotosSection", () => {
    expect(content).toContain("eventId={eventId}");
    expect(content).toContain("eventTitle={event.title}");
    expect(content).toContain("currentCoverUrl={event.cover_image_url");
    expect(content).toContain("initialImages={eventImages");
    expect(content).toContain("userId={sessionUser.id}");
  });
});
