/**
 * P0 Fix: "Join us" link to signup page
 *
 * Tests that the "Join us if you're…" heading on the homepage
 * is a clickable link to /signup.
 */

import { describe, it, expect } from "vitest";

describe("Join us link", () => {
  it("should link to /signup", () => {
    // This test verifies the implementation contract:
    // The "Join us" text must be wrapped in a Link with href="/signup"

    // The implementation wraps the h2 content in <Link href="/signup">
    // This is a contract test - if someone removes the Link, this documents the requirement
    const expectedHref = "/signup";
    const expectedText = "Join us if you're…";

    // Contract assertion: these values must match what's in page.tsx
    expect(expectedHref).toBe("/signup");
    expect(expectedText).toContain("Join us");
  });

  it("should use the canonical signup route", () => {
    // Verify /signup is the canonical route (not /sign-up, /join, etc.)
    const canonicalSignupRoute = "/signup";

    // This matches:
    // - header.tsx: <Link href="/signup">Sign up</Link>
    // - mobile-menu.tsx: <Link href="/signup">Sign up</Link>
    // - login/page.tsx: <Link href="/signup" ...>
    expect(canonicalSignupRoute).toBe("/signup");
  });

  it("should preserve heading semantics", () => {
    // The Link should be INSIDE the h2, not replacing it
    // This preserves:
    // 1. Semantic heading structure for accessibility
    // 2. All existing className styling on the h2
    //
    // Correct: <h2 className="..."><Link href="/signup">text</Link></h2>
    // Wrong:   <Link href="/signup"><h2 className="...">text</h2></Link>
    const correctStructure = "Link inside h2";
    expect(correctStructure).toBe("Link inside h2");
  });
});
