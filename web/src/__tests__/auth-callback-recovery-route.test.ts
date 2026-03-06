import { describe, it, expect } from "vitest";
import fs from "fs";

describe("Auth callback recovery handling", () => {
  it("routes recovery callbacks to reset password page", () => {
    const source = fs.readFileSync("src/app/auth/callback/route.ts", "utf-8");
    expect(source).toContain('if (type === "recovery")');
    expect(source).toContain('applyReferralToUrl("/auth/reset")');
  });
});
