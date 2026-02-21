import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("event status legacy lock", () => {
  it("bulk verify sets status active when verifying", () => {
    const source = read("app/api/admin/ops/events/bulk-verify/route.ts");
    expect(source).toContain("status: \"active\"");
  });

  it("my-events patch normalizes legacy verification statuses to active", () => {
    const source = read("app/api/my-events/[id]/route.ts");
    expect(source).toContain("LEGACY_VERIFICATION_STATUSES");
    expect(source).toContain("body.status = \"active\"");
  });

  it("open-mics admin status route maps legacy verification statuses to active", () => {
    const source = read("app/api/admin/open-mics/[id]/status/route.ts");
    expect(source).toContain("LEGACY_VERIFICATION_STATUSES");
    expect(source).toContain("? \"active\"");
    expect(source).toContain("const ALLOWED_STATUSES = [\"active\", \"inactive\", \"cancelled\"] as const;");
  });

  it("admin event edit form no longer offers legacy verification statuses", () => {
    const source = read("app/(protected)/dashboard/admin/events/[id]/edit/EventEditForm.tsx");
    expect(source).toContain("const STATUSES = [\"active\", \"inactive\", \"cancelled\", \"duplicate\"]");
  });
});
