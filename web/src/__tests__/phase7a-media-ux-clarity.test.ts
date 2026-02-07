/**
 * Phase 7A: Media UX Clarity contract tests
 *
 * Scope:
 * - Event cover upload path + create-mode deferred upload
 * - Gallery unassigned soft-archive behavior
 * - Copy consistency ("Hover over..." + "Max 10 MB")
 * - Event photo theme-token consistency
 * - Event upload aspect ratio alignment (3:2)
 * - CONTRACTS.md synchronization
 */

import { describe, it, expect } from "vitest";

describe("Phase 7A: Event cover upload contract", () => {
  it("tracks pending cover state for create-mode deferred upload", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain("pendingCoverFile");
    expect(source).toContain("pendingCoverPreviewUrl");
  });

  it("uses create-mode branch with local preview URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain('if (mode === "create" || !event?.id)');
    expect(source).toContain("URL.createObjectURL(file)");
  });

  it("uploads event covers to event-scoped storage path", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain('const storagePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;');
  });

  it("creates event_images records for EventForm cover uploads", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain('from("event_images")');
    expect(source).toContain("event_id: eventId");
    expect(source).toContain("storage_path: storagePath");
    expect(source).toContain("uploaded_by: userId");
  });

  it("defers cover_image_url in create-mode while file is pending", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain(
      "cover_image_url: mode === \"create\" && pendingCoverFile ? null : coverImageUrl"
    );
  });

  it("uploads pending cover after create and updates events.cover_image_url", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain('if (mode === "create" && data.id && pendingCoverFile)');
    expect(source).toContain('from("events")');
    expect(source).toContain("update({ cover_image_url: uploadedCoverUrl })");
  });

  it("soft-deletes previous cover event_images row when saved cover changes", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(source).toContain("softDeleteCoverImageRow");
    expect(source).toContain('.update({ deleted_at: new Date().toISOString() })');
    expect(source).toContain('.eq("event_id", eventId)');
    expect(source).toContain('.is("deleted_at", null)');
  });
});

describe("Phase 7A: Gallery soft-archive contract", () => {
  it("uses is_hidden=true updates for unassigned photos", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx",
      "utf-8"
    );
    expect(source).toContain(".update({ is_hidden: true })");
    expect(source).not.toContain(".delete()");
  });

  it("uses hide/restore confirmation copy", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager.tsx",
      "utf-8"
    );
    expect(source).toContain("An admin can restore them if needed.");
    expect(source).toContain("hide them");
  });
});

describe("Phase 7A: Copy and file-size consistency", () => {
  it("event photos helper copy uses hover instruction", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/events/EventPhotosSection.tsx",
      "utf-8"
    );
    expect(source).toContain("Hover over a photo to set it as the cover.");
    expect(source).not.toContain("Click on an image to set it as the cover photo.");
  });

  it("venue helper copy uses hover instruction", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/venue/VenuePhotosSection.tsx",
      "utf-8"
    );
    expect(source).toContain("Hover over a photo to set it as the cover.");
    expect(source).not.toContain("Choose one to display as the cover image.");
  });

  it("all in-scope upload helper text uses Max 10 MB", async () => {
    const fs = await import("fs");
    const profile = fs.readFileSync(
      "src/components/profile/ProfilePhotosSection.tsx",
      "utf-8"
    );
    const venue = fs.readFileSync(
      "src/components/venue/VenuePhotosSection.tsx",
      "utf-8"
    );
    const eventForm = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(profile).toContain("Max 10 MB.");
    expect(venue).toContain("Max 10 MB.");
    expect(eventForm).toContain("Max 10 MB.");
  });

  it("no in-scope helper copy still uses Max 5MB", async () => {
    const fs = await import("fs");
    const profile = fs.readFileSync(
      "src/components/profile/ProfilePhotosSection.tsx",
      "utf-8"
    );
    const venue = fs.readFileSync(
      "src/components/venue/VenuePhotosSection.tsx",
      "utf-8"
    );
    const eventForm = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    expect(profile).not.toContain("Max 5MB");
    expect(venue).not.toContain("Max 5MB");
    expect(eventForm).not.toContain("Max 5MB");
  });
});

describe("Phase 7A: Event photo theme-token and ratio alignment", () => {
  it("EventPhotosSection uses theme tokens instead of emerald classes", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      "src/components/events/EventPhotosSection.tsx",
      "utf-8"
    );
    expect(source).not.toContain("emerald");
    expect(source).toContain("--color-border-accent");
    expect(source).toContain("--color-accent-primary");
    expect(source).toContain("--color-text-on-accent");
  });

  it("EventForm and EventPhotosSection use 3:2 upload crop ratios", async () => {
    const fs = await import("fs");
    const eventForm = fs.readFileSync(
      "src/app/(protected)/dashboard/my-events/_components/EventForm.tsx",
      "utf-8"
    );
    const eventPhotos = fs.readFileSync(
      "src/components/events/EventPhotosSection.tsx",
      "utf-8"
    );
    expect(eventForm).toContain("aspectRatio={3/2}");
    expect(eventPhotos).toContain("aspectRatio={3 / 2}");
  });
});

describe("Phase 7A: CONTRACTS.md synchronization", () => {
  it("documents card thumbnail ratio as 3:2", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("../docs/CONTRACTS.md", "utf-8");
    expect(source).toContain("Card thumbnails use a constrained aspect ratio: **3:2**.");
    expect(source).not.toContain("Card thumbnails use a constrained aspect ratio: **4:3**.");
  });

  it("includes media upload consistency section", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("../docs/CONTRACTS.md", "utf-8");
    expect(source).toContain("## Contract: Media Upload Consistency");
    expect(source).toContain("10 MB max per image");
    expect(source).toContain("event-images/{eventId}/{uuid}.{ext}");
    expect(source).toContain("is_hidden = true");
  });
});
