import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Dashboard settings password reset entry", () => {
  it("includes a reset password link to the reset request route", () => {
    const source = fs.readFileSync("src/app/(protected)/dashboard/settings/page.tsx", "utf-8");
    expect(source).toContain("Account Security");
    expect(source).toContain('href="/auth/reset-request"');
    expect(source).toContain("Reset Password");
  });
});
