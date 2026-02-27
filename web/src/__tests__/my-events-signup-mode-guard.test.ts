import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("my-events API guardrails for signup/location mode", () => {
  const createRoute = read("app/api/my-events/route.ts");
  const updateRoute = read("app/api/my-events/[id]/route.ts");

  it("normalizes create-route signup_mode before DB insert", () => {
    expect(createRoute).toContain("body.signup_mode = normalizeSignupMode(body.signup_mode)");
  });

  it("normalizes create-route location_mode before validation", () => {
    expect(createRoute).toContain("body.location_mode = normalizeLocationMode(body.location_mode)");
  });

  it("normalizes update-route signup_mode when provided", () => {
    expect(updateRoute).toContain("body.signup_mode = normalizeSignupMode(body.signup_mode)");
  });

  it("normalizes update-route location_mode when provided", () => {
    expect(updateRoute).toContain("body.location_mode = normalizeLocationMode(body.location_mode)");
  });
});
