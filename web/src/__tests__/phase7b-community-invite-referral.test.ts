/**
 * Phase 7B.1: Community Invite / Referral Growth Loop
 *
 * Tests for:
 * - Referral param contract and sanitization
 * - Auth/signup attribution propagation
 * - Onboarding persistence contract
 * - Approved invite CTA surfaces
 * - Profile attribution migration
 */

import { describe, it, expect } from "vitest";
import {
  applyReferralParams,
  buildInviteEmailBody,
  deserializeReferralCookie,
  serializeReferralCookie,
  sanitizeReferralParams,
  INVITE_CTA_LABEL,
  SHARE_SITE_CTA_LABEL,
} from "@/lib/referrals";

describe("Phase 7B.1: Referral utility contract", () => {
  it("keeps valid ref/via/src values", () => {
    const result = sanitizeReferralParams({
      ref: "1B2F82A2-55B1-4D93-8929-D02134C5E8A2",
      via: "Member_Invite",
      src: "Header_Nav",
    });

    expect(result).toEqual({
      ref: "1b2f82a2-55b1-4d93-8929-d02134c5e8a2",
      via: "member_invite",
      src: "header_nav",
    });
  });

  it("drops invalid referral values", () => {
    const result = sanitizeReferralParams({
      ref: "not-a-uuid",
      via: "bad value with spaces",
      src: "../bad",
    });

    expect(result).toEqual({
      ref: undefined,
      via: undefined,
      src: undefined,
    });
  });

  it("applies only defined referral params to query string", () => {
    const searchParams = new URLSearchParams("type=signup");
    applyReferralParams(searchParams, {
      ref: "1b2f82a2-55b1-4d93-8929-d02134c5e8a2",
      via: "member_invite",
    });

    expect(searchParams.get("type")).toBe("signup");
    expect(searchParams.get("ref")).toBe("1b2f82a2-55b1-4d93-8929-d02134c5e8a2");
    expect(searchParams.get("via")).toBe("member_invite");
    expect(searchParams.get("src")).toBeNull();
  });

  it("serializes and deserializes referral cookie safely", () => {
    const encoded = serializeReferralCookie({
      ref: "1b2f82a2-55b1-4d93-8929-d02134c5e8a2",
      via: "member_invite",
      src: "header_nav",
    });
    const decoded = deserializeReferralCookie(encoded);

    expect(decoded).toEqual({
      ref: "1b2f82a2-55b1-4d93-8929-d02134c5e8a2",
      via: "member_invite",
      src: "header_nav",
    });
  });

  it("builds invite email copy without personal-name placeholders", () => {
    const body = buildInviteEmailBody("https://denversongwriterscollective.org/");
    expect(body).toContain("Hey there,");
    expect(body).toContain("Start on the homepage: https://denversongwriterscollective.org/");
    expect(body).toContain("Enjoy!");
    expect(body).not.toContain("[Friend Name]");
    expect(body).not.toContain("Sami Serrag");
  });
});

describe("Phase 7B.1: Auth/signup attribution propagation", () => {
  it("email signup forwards referral params into callback URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/auth/signUp.ts", "utf-8");
    expect(source).toContain("applyReferralParams");
    expect(source).toContain('redirectUrl.searchParams.set("type", "signup")');
    expect(source).toContain("sanitizeReferralParams(referral)");
  });

  it("google signup forwards referral params into callback URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/auth/google.ts", "utf-8");
    expect(source).toContain("applyReferralParams");
    expect(source).toContain('redirectUrl.searchParams.set("type", "google")');
  });

  it("magic signup forwards referral params into callback URL", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/lib/auth/magic.ts", "utf-8");
    expect(source).toContain("applyReferralParams");
    expect(source).toContain('redirectUrl.searchParams.set("type", "magic")');
  });

  it("signup page passes referral params to all signup entry points", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/signup/page.tsx", "utf-8");
    expect(source).toContain("sanitizeReferralParams(searchParams)");
    expect(source).toContain("signUpWithEmail(email, password, referral)");
    expect(source).toContain("sendMagicLink(email, referral)");
    expect(source).toContain("signInWithGoogle(referral)");
  });
});

describe("Phase 7B.1: Callback/onboarding persistence", () => {
  it("auth callback stores referral cookie and forwards params", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/auth/callback/route.ts", "utf-8");
    expect(source).toContain("REFERRAL_COOKIE_NAME");
    expect(source).toContain("serializeReferralCookie");
    expect(source).toContain("applyReferralToUrl");
  });

  it("onboarding route persists referral attribution fields", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync("src/app/api/onboarding/route.ts", "utf-8");
    expect(source).toContain("referred_by_profile_id");
    expect(source).toContain("referral_via");
    expect(source).toContain("referral_source");
    expect(source).toContain("referral_captured_at");
    expect(source).toContain("REFERRAL_COOKIE_NAME");
  });
});

describe("Phase 7B.1: Approved CTA surfaces", () => {
  it("header and mobile nav expose logged-in invite CTA", async () => {
    const fs = await import("fs");
    const headerSource = fs.readFileSync(
      "src/components/navigation/header.tsx",
      "utf-8",
    );
    const mobileSource = fs.readFileSync(
      "src/components/navigation/mobile-menu.tsx",
      "utf-8",
    );
    expect(headerSource).toContain('/dashboard/invite">{INVITE_CTA_LABEL}');
    expect(mobileSource).toContain('/dashboard/invite">{INVITE_CTA_LABEL}');
    expect(headerSource).toContain("INVITE_CTA_LABEL");
    expect(mobileSource).toContain("INVITE_CTA_LABEL");
  });

  it("homepage and happenings include community invite CTAs", async () => {
    const fs = await import("fs");
    const homeSource = fs.readFileSync("src/app/page.tsx", "utf-8");
    const happeningsSource = fs.readFileSync("src/app/happenings/page.tsx", "utf-8");
    expect(homeSource).toContain('href="/dashboard/invite"');
    expect(homeSource).not.toContain("/early-contributors");
    expect(happeningsSource).toContain('href="/dashboard/invite"');
  });

  it("weekly digest templates link invites to the clean homepage URL", async () => {
    const fs = await import("fs");
    const happeningsDigest = fs.readFileSync(
      "src/lib/email/templates/weeklyHappeningsDigest.ts",
      "utf-8",
    );
    const openMicsDigest = fs.readFileSync(
      "src/lib/email/templates/weeklyOpenMicsDigest.ts",
      "utf-8",
    );
    expect(happeningsDigest).toContain("const inviteUrl = `${SITE_URL}/`");
    expect(happeningsDigest).not.toContain("via=digest_invite");
    expect(openMicsDigest).toContain("const inviteUrl = `${SITE_URL}/`");
    expect(openMicsDigest).not.toContain("via=digest_invite");
  });

  it("invite label remains canonical across surfaces", () => {
    expect(INVITE_CTA_LABEL).toBe("Invite a Friend");
    expect(SHARE_SITE_CTA_LABEL).toBe("Share This Site");
  });

  it("root layout includes share CTA bars at top and bottom", async () => {
    const fs = await import("fs");
    const layoutSource = fs.readFileSync("src/app/layout.tsx", "utf-8");
    expect(layoutSource).toContain("ShareSiteCtaBar");
    expect(layoutSource).toContain('<ShareSiteCtaBar position="top" />');
    expect(layoutSource).toContain('<ShareSiteCtaBar position="bottom" />');
  });
});

describe("Phase 7B.1: Migration contract", () => {
  it("adds profile-level referral attribution columns", async () => {
    const fs = await import("fs");
    const migration = fs.readFileSync(
      "../supabase/migrations/20260207110000_add_profile_referral_attribution.sql",
      "utf-8",
    );
    expect(migration).toContain("referred_by_profile_id");
    expect(migration).toContain("referral_via");
    expect(migration).toContain("referral_source");
    expect(migration).toContain("referral_captured_at");
  });
});
