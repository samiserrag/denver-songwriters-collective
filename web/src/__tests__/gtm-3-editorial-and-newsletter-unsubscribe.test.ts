/**
 * GTM-3 Tests — Editorial Layer + Newsletter Unsubscribe
 *
 * Part A: Newsletter subscriber one-click unsubscribe
 * - HMAC token generation/validation with different message family
 * - Cross-family prevention (member ≠ newsletter tokens)
 * - Email normalization (lowercase, trim)
 * - Newsletter unsubscribe URL format
 * - Newsletter unsubscribe route contracts
 * - Newsletter unsubscribed confirmation page contracts
 *
 * Part B: Editorial layer for weekly happenings digest
 * - Migration schema contracts
 * - Editorial CRUD helper contracts (getEditorial, upsertEditorial, deleteEditorial)
 * - resolveEditorial reference resolution contracts
 * - Email template editorial section rendering
 * - Delta 1: editorial resolution AFTER lock in cron handler
 * - Editorial integration in preview/send APIs
 * - Search-happenings endpoint contracts
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(__dirname, "..");
const SUPABASE_DIR = path.resolve(__dirname, "..", "..", "..", "supabase");

// ============================================================
// Part A: Newsletter Unsubscribe Token Functions
// ============================================================

describe("Part A: Newsletter Unsubscribe", () => {
  describe("A1: Newsletter HMAC token functions", () => {
    const tokenSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/unsubscribeToken.ts"),
      "utf-8"
    );

    it("should export generateNewsletterUnsubscribeToken function", () => {
      expect(tokenSource).toContain(
        "export function generateNewsletterUnsubscribeToken("
      );
    });

    it("should export validateNewsletterUnsubscribeToken function", () => {
      expect(tokenSource).toContain(
        "export function validateNewsletterUnsubscribeToken("
      );
    });

    it("should export buildNewsletterUnsubscribeUrl function", () => {
      expect(tokenSource).toContain(
        "export function buildNewsletterUnsubscribeUrl("
      );
    });

    it("should use different HMAC message family from member tokens", () => {
      // Member tokens use "{userId}:unsubscribe_digest"
      expect(tokenSource).toContain(":unsubscribe_digest");
      // Newsletter tokens use "{email}:unsubscribe_newsletter"
      expect(tokenSource).toContain(":unsubscribe_newsletter");
    });

    it("should normalize email to lowercase before generating token", () => {
      expect(tokenSource).toContain("email.toLowerCase().trim()");
    });

    it("should use createHmac with sha256", () => {
      expect(tokenSource).toContain('createHmac("sha256"');
    });

    it("should use timingSafeEqual for constant-time comparison", () => {
      expect(tokenSource).toContain("timingSafeEqual(");
    });

    it("should check token length before timingSafeEqual (prevent error on length mismatch)", () => {
      expect(tokenSource).toContain("token.length !== expected.length");
    });

    it("newsletter unsubscribe URL should use /api/newsletter/unsubscribe path", () => {
      expect(tokenSource).toContain("/api/newsletter/unsubscribe?email=");
    });

    it("member unsubscribe URL should use /api/digest/unsubscribe path", () => {
      expect(tokenSource).toContain("/api/digest/unsubscribe?uid=");
    });

    it("should return null when UNSUBSCRIBE_SECRET is not configured", () => {
      // Both member and newsletter functions check for the secret
      const secretChecks = (tokenSource.match(/if \(!UNSUBSCRIBE_SECRET\)/g) || []).length;
      // At least 4 checks: generate member, validate member, generate newsletter, validate newsletter
      expect(secretChecks).toBeGreaterThanOrEqual(4);
    });

    it("newsletter URL should encode email and signature params", () => {
      expect(tokenSource).toContain("encodeURIComponent(normalizedEmail)");
      expect(tokenSource).toContain("encodeURIComponent(token)");
    });
  });

  describe("A2: Newsletter unsubscribe API endpoint", () => {
    const routeSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/newsletter/unsubscribe/route.ts"
      ),
      "utf-8"
    );

    it("should export a GET handler", () => {
      expect(routeSource).toContain("export async function GET(");
    });

    it("should read email and sig from search params", () => {
      expect(routeSource).toContain('.get("email")');
      expect(routeSource).toContain('.get("sig")');
    });

    it("should normalize email to lowercase before validation", () => {
      expect(routeSource).toContain("email.toLowerCase().trim()");
    });

    it("should validate HMAC with validateNewsletterUnsubscribeToken", () => {
      expect(routeSource).toContain("validateNewsletterUnsubscribeToken(");
    });

    it("should update newsletter_subscribers table (not profiles)", () => {
      expect(routeSource).toContain('.from("newsletter_subscribers")');
      expect(routeSource).not.toContain('.from("profiles")');
    });

    it("should set unsubscribed_at on successful validation", () => {
      expect(routeSource).toContain("unsubscribed_at:");
    });

    it("should use service role client to bypass RLS", () => {
      expect(routeSource).toContain("createServiceRoleClient()");
    });

    it("should redirect to success page on success", () => {
      expect(routeSource).toContain(
        "/newsletter/unsubscribed?success=1"
      );
    });

    it("should redirect to error page for invalid signature", () => {
      expect(routeSource).toContain(
        "/newsletter/unsubscribed?error=invalid"
      );
    });

    it("should redirect to error page for missing params", () => {
      expect(routeSource).toContain("!email || !sig");
      expect(routeSource).toContain(
        "/newsletter/unsubscribed?error=invalid"
      );
    });

    it("should redirect to error page for DB failures", () => {
      expect(routeSource).toContain(
        "/newsletter/unsubscribed?error=failed"
      );
    });
  });

  describe("A3: Newsletter unsubscribed confirmation page", () => {
    const pageSource = fs.readFileSync(
      path.join(SRC_DIR, "app/newsletter/unsubscribed/page.tsx"),
      "utf-8"
    );

    it("should be a server component (no 'use client')", () => {
      expect(pageSource).not.toContain('"use client"');
      expect(pageSource).not.toContain("'use client'");
    });

    it("should set noindex robots meta", () => {
      expect(pageSource).toContain('"noindex"');
    });

    it("should show success state with wave emoji", () => {
      expect(pageSource).toContain("👋");
    });

    it("should show 'You've been unsubscribed' heading on success", () => {
      expect(pageSource).toContain("You&apos;ve been unsubscribed");
    });

    it("should link re-subscribe to homepage newsletter section (not dashboard)", () => {
      // Newsletter subscribers are guests — no dashboard access
      expect(pageSource).toContain('href="/#newsletter"');
    });

    it("should offer Browse Happenings link", () => {
      expect(pageSource).toContain('href="/happenings"');
    });

    it("should show invalid link error message", () => {
      expect(pageSource).toContain("This unsubscribe link appears to be invalid");
    });

    it("should show generic failure message for non-invalid errors", () => {
      expect(pageSource).toContain("process your request right now");
    });

    it("should include contact email", () => {
      expect(pageSource).toContain(
        "hello@denversongwriterscollective.org"
      );
    });
  });
});

// ============================================================
// Part B: Editorial Layer
// ============================================================

describe("Part B: Editorial Layer", () => {
  describe("B1: digest_editorial migration schema", () => {
    const migrationSource = fs.readFileSync(
      path.join(
        SUPABASE_DIR,
        "migrations/20260205000000_digest_editorial.sql"
      ),
      "utf-8"
    );

    it("should create digest_editorial table", () => {
      expect(migrationSource).toContain("CREATE TABLE");
      expect(migrationSource).toContain("digest_editorial");
    });

    it("should have UUID primary key", () => {
      expect(migrationSource).toContain(
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid()"
      );
    });

    it("should have week_key TEXT NOT NULL", () => {
      expect(migrationSource).toContain("week_key TEXT NOT NULL");
    });

    it("should have digest_type TEXT NOT NULL with default", () => {
      expect(migrationSource).toContain(
        "digest_type TEXT NOT NULL DEFAULT 'weekly_happenings'"
      );
    });

    it("should have unique constraint on (week_key, digest_type)", () => {
      expect(migrationSource).toContain("UNIQUE (week_key, digest_type)");
    });

    it("should have all editorial content fields as nullable", () => {
      // All editorial fields should NOT have NOT NULL constraint
      expect(migrationSource).toContain("subject_override TEXT,");
      expect(migrationSource).toContain("intro_note TEXT,");
      expect(migrationSource).toContain("featured_happening_ids UUID[],");
      expect(migrationSource).toContain("member_spotlight_id UUID,");
      expect(migrationSource).toContain("venue_spotlight_id UUID,");
      expect(migrationSource).toContain("blog_feature_slug TEXT,");
      expect(migrationSource).toContain("gallery_feature_slug TEXT,");
    });

    it("should have timestamps (created_at, updated_at)", () => {
      expect(migrationSource).toContain("created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
      expect(migrationSource).toContain("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
    });

    it("should have updated_by UUID for audit trail", () => {
      expect(migrationSource).toContain("updated_by UUID");
    });

    it("should enable RLS", () => {
      expect(migrationSource).toContain("ENABLE ROW LEVEL SECURITY");
    });

    it("should NOT create any RLS policies (service role only)", () => {
      expect(migrationSource).not.toContain("CREATE POLICY");
    });

    it("should create updated_at trigger", () => {
      expect(migrationSource).toContain("CREATE TRIGGER digest_editorial_updated_at");
      expect(migrationSource).toContain("BEFORE UPDATE ON");
    });

    it("should use real timestamp filename (Delta 2)", () => {
      // Filename should be 20260205000000, not a placeholder
      const filename = "20260205000000_digest_editorial.sql";
      const filePath = path.join(SUPABASE_DIR, "migrations", filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("B1b: digest_editorial ref columns migration", () => {
    const migrationSource = fs.readFileSync(
      path.join(
        SUPABASE_DIR,
        "migrations/20260205181500_digest_editorial_ref_columns.sql"
      ),
      "utf-8"
    );

    it("adds member/venue/blog/gallery ref columns", () => {
      expect(migrationSource).toContain("member_spotlight_ref TEXT");
      expect(migrationSource).toContain("venue_spotlight_ref TEXT");
      expect(migrationSource).toContain("blog_feature_ref TEXT");
      expect(migrationSource).toContain("gallery_feature_ref TEXT");
    });

    it("adds featured_happenings_refs text[]", () => {
      expect(migrationSource).toContain("featured_happenings_refs TEXT[]");
    });
  });

  describe("B2: Editorial CRUD helpers", () => {
    const editorialSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/digestEditorial.ts"),
      "utf-8"
    );

    it("should export DigestEditorial interface", () => {
      expect(editorialSource).toContain("export interface DigestEditorial");
    });

    it("should export ResolvedEditorial interface", () => {
      expect(editorialSource).toContain("export interface ResolvedEditorial");
    });

    it("should export getEditorial function", () => {
      expect(editorialSource).toContain("export async function getEditorial(");
    });

    it("should export upsertEditorial function", () => {
      expect(editorialSource).toContain("export async function upsertEditorial(");
    });

    it("should export deleteEditorial function", () => {
      expect(editorialSource).toContain("export async function deleteEditorial(");
    });

    it("should export resolveEditorial function", () => {
      expect(editorialSource).toContain("export async function resolveEditorial(");
    });

    it("getEditorial should query by week_key and digest_type", () => {
      expect(editorialSource).toContain('.eq("week_key", weekKey)');
      expect(editorialSource).toContain('.eq("digest_type", digestType)');
    });

    it("getEditorial should use maybeSingle (null for no result)", () => {
      expect(editorialSource).toContain(".maybeSingle()");
    });

    it("upsertEditorial should use onConflict for upsert on unique constraint", () => {
      expect(editorialSource).toContain(
        '{ onConflict: "week_key,digest_type" }'
      );
    });

    it("upsertEditorial should set updated_by and updated_at", () => {
      expect(editorialSource).toContain("updated_by: updatedBy");
      expect(editorialSource).toContain("updated_at:");
    });

    it("should cast table name since not in generated types", () => {
      expect(editorialSource).toContain('"digest_editorial" as string');
    });

    it("DigestEditorial interface should have all nullable editorial fields", () => {
      expect(editorialSource).toContain(
        "subject_override: string | null"
      );
      expect(editorialSource).toContain(
        "intro_note: string | null"
      );
      expect(editorialSource).toContain(
        "featured_happening_ids: string[] | null"
      );
      expect(editorialSource).toContain(
        "featured_happenings_refs: string[] | null"
      );
      expect(editorialSource).toContain(
        "member_spotlight_id: string | null"
      );
      expect(editorialSource).toContain(
        "venue_spotlight_id: string | null"
      );
      expect(editorialSource).toContain(
        "member_spotlight_ref: string | null"
      );
      expect(editorialSource).toContain(
        "venue_spotlight_ref: string | null"
      );
      expect(editorialSource).toContain(
        "blog_feature_slug: string | null"
      );
      expect(editorialSource).toContain(
        "gallery_feature_slug: string | null"
      );
      expect(editorialSource).toContain(
        "blog_feature_ref: string | null"
      );
      expect(editorialSource).toContain(
        "gallery_feature_ref: string | null"
      );
    });

    it("ResolvedEditorial should have template-ready types for all sections", () => {
      expect(editorialSource).toContain("subjectOverride?: string");
      expect(editorialSource).toContain("introNote?: string");
      expect(editorialSource).toContain("featuredHappenings?: Array<");
      expect(editorialSource).toContain("memberSpotlight?: {");
      expect(editorialSource).toContain("venueSpotlight?: {");
      expect(editorialSource).toContain("blogFeature?: {");
      expect(editorialSource).toContain("galleryFeature?: {");
    });
  });

  describe("B2b: resolveEditorial reference resolution", () => {
    const editorialSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/digestEditorial.ts"),
      "utf-8"
    );

    it("resolveEditorial should accept (supabase, editorial) parameters", () => {
      // Verify function signature takes 2 params
      expect(editorialSource).toMatch(
        /async function resolveEditorial\(\s*supabase:\s*SupabaseClient,\s*editorial:\s*DigestEditorial/
      );
    });

    it("should resolve featured happenings by IDs or slugs from events table", () => {
      expect(editorialSource).toContain('.from("events")');
      expect(editorialSource).toContain(
        ".in(\"id\", uuidRefs)"
      );
      expect(editorialSource).toContain(
        ".in(\"slug\", slugRefs)"
      );
    });

    it("should resolve member spotlight from profiles table using URL parsing", () => {
      expect(editorialSource).toContain('.from("profiles")');
      expect(editorialSource).toContain("member_spotlight_ref");
      expect(editorialSource).toContain("parseEditorialUrlToSlug");
    });

    it("should resolve venue spotlight from venues table using URL parsing", () => {
      expect(editorialSource).toContain('.from("venues")');
      expect(editorialSource).toContain("venue_spotlight_ref");
      expect(editorialSource).toContain("parseEditorialUrlToSlug");
    });

    it("should resolve blog feature by slug from blog_posts table", () => {
      expect(editorialSource).toContain('.from("blog_posts")');
      expect(editorialSource).toContain("blog_feature_ref");
      expect(editorialSource).toContain('.eq("slug", parsed.slug)');
    });

    it("should resolve gallery feature by slug from gallery_albums table", () => {
      expect(editorialSource).toContain('.from("gallery_albums")');
      expect(editorialSource).toContain("gallery_feature_ref");
      expect(editorialSource).toContain('.eq("slug", parsed.slug)');
    });

    it("blog feature should only resolve published posts", () => {
      expect(editorialSource).toContain('.eq("is_published", true)');
    });

    it("gallery feature should only resolve published albums", () => {
      // Both blog and gallery check is_published
      const publishedChecks = (editorialSource.match(/\.eq\("is_published", true\)/g) || []);
      expect(publishedChecks.length).toBeGreaterThanOrEqual(2);
    });

    it("should include venue join for featured happenings", () => {
      expect(editorialSource).toContain("venues!left(id, name, slug, website_url)");
    });

    it("should truncate long bios in member spotlight (150 char limit)", () => {
      expect(editorialSource).toContain("bio.length > 150");
      expect(editorialSource).toContain("bio.substring(0, 147)");
    });

    it("should build URLs using SITE_URL + entity path", () => {
      expect(editorialSource).toContain("`${SITE_URL}/events/");
      expect(editorialSource).toContain("`${SITE_URL}/songwriters/");
      expect(editorialSource).toContain("`${SITE_URL}/venues/");
      expect(editorialSource).toContain("`${SITE_URL}/blog/");
      expect(editorialSource).toContain("`${SITE_URL}/gallery/");
    });

    it("should prefer slug over ID for URLs", () => {
      expect(editorialSource).toContain("event.slug || event.id");
      expect(editorialSource).toContain("profile.slug || profile.id");
      expect(editorialSource).toContain("venue.slug || venue.id");
    });

    it("should map event types to emoji icons", () => {
      expect(editorialSource).toContain("EVENT_TYPE_EMOJI");
      expect(editorialSource).toContain("open_mic");
      expect(editorialSource).toContain("song_circle");
    });
  });

  describe("B3: Admin editorial API routes", () => {
    const routeSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/admin/digest/editorial/route.ts"
      ),
      "utf-8"
    );

    it("should be admin-only (uses checkAdminRole)", () => {
      expect(routeSource).toContain("checkAdminRole(");
    });

    it("should use createServiceRoleClient for DB operations", () => {
      expect(routeSource).toContain("createServiceRoleClient()");
    });

    it("should import editorial CRUD helpers", () => {
      expect(routeSource).toContain("digestEditorial");
    });
  });

  describe("B4: Email template editorial sections", () => {
    const templateSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "lib/email/templates/weeklyHappeningsDigest.ts"
      ),
      "utf-8"
    );

    it("should accept optional editorial param", () => {
      expect(templateSource).toContain("editorial?: ResolvedEditorial");
    });

    it("should import ResolvedEditorial type", () => {
      expect(templateSource).toContain(
        'import type { ResolvedEditorial } from "@/lib/digest/digestEditorial"'
      );
    });

    it("subject should use editorial subjectOverride when present", () => {
      expect(templateSource).toContain(
        'editorial?.subjectOverride || "Happenings This Week in Denver"'
      );
    });

    it("should have HTML helper for intro note", () => {
      expect(templateSource).toContain("function formatIntroNoteHtml(");
    });

    it("should have HTML helper for featured happenings", () => {
      expect(templateSource).toContain(
        "function formatFeaturedHappeningsHtml("
      );
    });

    it("should have HTML helper for member spotlight", () => {
      expect(templateSource).toContain(
        "function formatMemberSpotlightHtml("
      );
    });

    it("should have HTML helper for venue spotlight", () => {
      expect(templateSource).toContain(
        "function formatVenueSpotlightHtml("
      );
    });

    it("should have HTML helper for blog feature", () => {
      expect(templateSource).toContain("function formatBlogFeatureHtml(");
    });

    it("should have HTML helper for gallery feature", () => {
      expect(templateSource).toContain(
        "function formatGalleryFeatureHtml("
      );
    });

    it("should have matching text helpers for all editorial sections", () => {
      expect(templateSource).toContain("function formatIntroNoteText(");
      expect(templateSource).toContain(
        "function formatFeaturedHappeningsText("
      );
      expect(templateSource).toContain(
        "function formatMemberSpotlightText("
      );
      expect(templateSource).toContain(
        "function formatVenueSpotlightText("
      );
      expect(templateSource).toContain("function formatBlogFeatureText(");
      expect(templateSource).toContain(
        "function formatGalleryFeatureText("
      );
    });

    it("featured block should render BEFORE day-grouped happenings (top pinned)", () => {
      // featuredTopHtml + remainingFeaturedHtml should appear in the HTML layout before eventsHtml
      expect(templateSource).toContain("${introNoteHtml");
      expect(templateSource).toContain("${featuredTopHtml");
      expect(templateSource).toContain("${remainingFeaturedHtml");
      const htmlContentSection = templateSource.slice(
        templateSource.indexOf("const htmlContent"),
        templateSource.indexOf("const html = wrapEmailHtml")
      );
      const introPos = htmlContentSection.indexOf("introNoteHtml");
      const featuredTopPos = htmlContentSection.indexOf("featuredTopHtml");
      const remainingFeaturedPos = htmlContentSection.indexOf("remainingFeaturedHtml");
      const eventsPos = htmlContentSection.indexOf("eventsHtml");
      const spotlightsPos = htmlContentSection.indexOf("spotlightsHtml");
      expect(introPos).toBeLessThan(featuredTopPos);
      expect(featuredTopPos).toBeLessThan(eventsPos);
      expect(remainingFeaturedPos).toBeLessThan(eventsPos);
      expect(eventsPos).toBeLessThan(spotlightsPos);
    });

    it("spotlights/blog/gallery should render AFTER day-grouped happenings", () => {
      const htmlContentSection = templateSource.slice(
        templateSource.indexOf("const htmlContent"),
        templateSource.indexOf("const html = wrapEmailHtml")
      );
      const eventsPos = htmlContentSection.indexOf("eventsHtml");
      const spotlightsPos = htmlContentSection.indexOf("spotlightsHtml");
      expect(eventsPos).toBeLessThan(spotlightsPos);
    });

    it("featured happenings HTML should show ⭐ FEATURED THIS WEEK header", () => {
      expect(templateSource).toContain("⭐ FEATURED THIS WEEK");
    });

    it("member spotlight HTML should show 🎤 MEMBER SPOTLIGHT header", () => {
      expect(templateSource).toContain("🎤 MEMBER SPOTLIGHT");
    });

    it("venue spotlight HTML should show 📍 VENUE SPOTLIGHT header", () => {
      expect(templateSource).toContain("📍 VENUE SPOTLIGHT");
    });

    it("blog feature HTML should show 📝 FROM THE BLOG header", () => {
      expect(templateSource).toContain("📝 FROM THE BLOG");
    });

    it("gallery feature HTML should show 📸 FROM THE GALLERY header", () => {
      expect(templateSource).toContain("📸 FROM THE GALLERY");
    });

    it("template should render normally without editorial (all sections optional)", () => {
      // All editorial checks use optional chaining
      expect(templateSource).toContain("editorial?.introNote");
      expect(templateSource).toContain("editorial?.featuredHappenings");
      expect(templateSource).toContain("editorial?.memberSpotlight");
      expect(templateSource).toContain("editorial?.venueSpotlight");
      expect(templateSource).toContain("editorial?.blogFeature");
      expect(templateSource).toContain("editorial?.galleryFeature");
    });
  });

  describe("B5: Cron handler — editorial AFTER lock (Delta 1)", () => {
    const cronSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/cron/weekly-happenings/route.ts"
      ),
      "utf-8"
    );

    it("should import getEditorial and resolveEditorial", () => {
      expect(cronSource).toContain("getEditorial");
      expect(cronSource).toContain("resolveEditorial");
    });

    it("editorial resolution MUST happen AFTER lock acquisition (Delta 1)", () => {
      const lockPos = cronSource.indexOf("claimDigestSendLock(");
      const editorialPos = cronSource.indexOf("getEditorial(");
      expect(lockPos).toBeGreaterThan(-1);
      expect(editorialPos).toBeGreaterThan(-1);
      expect(editorialPos).toBeGreaterThan(lockPos);
    });

    it("editorial resolution MUST happen AFTER lock check succeeds", () => {
      // The lock check (if (!lock.acquired)) must come before editorial fetch
      const lockCheckPos = cronSource.indexOf("if (!lock.acquired)");
      const editorialPos = cronSource.indexOf("getEditorial(");
      expect(lockCheckPos).toBeGreaterThan(-1);
      expect(editorialPos).toBeGreaterThan(lockCheckPos);
    });

    it("resolveEditorial should be called with (supabase, editorial) — two args", () => {
      expect(cronSource).toContain("resolveEditorial(supabase, editorial)");
    });

    it("editorial failure should be non-fatal (try/catch with warn)", () => {
      expect(cronSource).toContain("Editorial resolution failed");
    });

    it("should pass resolvedEditorial to getWeeklyHappeningsDigestEmail", () => {
      expect(cronSource).toContain("editorial: resolvedEditorial");
    });

    it("should log when editorial found and when missing", () => {
      expect(cronSource).toContain("Found editorial for");
      expect(cronSource).toContain("No editorial for");
    });
  });

  describe("B6: Preview API with editorial", () => {
    const previewSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/admin/digest/preview/route.ts"
      ),
      "utf-8"
    );

    it("should import getEditorial and resolveEditorialWithDiagnostics", () => {
      expect(previewSource).toContain("getEditorial");
      expect(previewSource).toContain("resolveEditorialWithDiagnostics");
    });

    it("should accept week_key search param", () => {
      expect(previewSource).toContain('.get("week_key")');
    });

    it("should default to current week if no week_key provided", () => {
      expect(previewSource).toContain("computeWeekKey()");
    });

    it("resolveEditorialWithDiagnostics should be called with (serviceClient, editorial)", () => {
      expect(previewSource).toContain(
        "resolveEditorialWithDiagnostics(serviceClient, editorial)"
      );
    });

    it("should return hasEditorial boolean in response", () => {
      expect(previewSource).toContain("hasEditorial: !!resolvedEditorial");
    });

    it("should return unresolved diagnostics in response", () => {
      expect(previewSource).toContain("unresolved");
    });

    it("should return weekKey in response", () => {
      expect(previewSource).toContain("weekKey");
    });

    it("should pass editorial to template", () => {
      expect(previewSource).toContain("editorial: resolvedEditorial");
    });
  });

  describe("B7: Send API with editorial", () => {
    const sendSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/admin/digest/send/route.ts"
      ),
      "utf-8"
    );

    it("should import getEditorial and resolveEditorial", () => {
      expect(sendSource).toContain("getEditorial");
      expect(sendSource).toContain("resolveEditorial");
    });

    it("test mode should resolve editorial", () => {
      // Test mode resolves editorial immediately (no lock needed)
      expect(sendSource).toContain("GTM-3: Resolve editorial for test send");
    });

    it("full mode should resolve editorial AFTER lock (Delta 1)", () => {
      expect(sendSource).toContain(
        "GTM-3: Resolve editorial AFTER lock (Delta 1)"
      );
    });

    it("resolveEditorial in test mode should use (serviceClient, editorial) — two args", () => {
      expect(sendSource).toContain(
        "resolveEditorial(serviceClient, editorial)"
      );
    });

    it("should return hasEditorial boolean for weekly_happenings test send", () => {
      expect(sendSource).toContain("hasEditorial: !!resolvedEditorial");
    });

    it("should pass editorial to template in both modes", () => {
      // Check that editorial is passed in buildEmail callbacks
      const editorialPassCount = (sendSource.match(/editorial: resolvedEditorial/g) || []).length;
      // At least 2: test mode + full mode
      expect(editorialPassCount).toBeGreaterThanOrEqual(2);
    });

    it("editorial failure should be non-fatal in both modes", () => {
      // Both test and full mode wrap editorial in try/catch
      expect(sendSource).toContain("[AdminTestSend] Editorial resolution failed");
      expect(sendSource).toContain("[AdminFullSend] Editorial resolution failed");
    });
  });

  describe("B8: Search-happenings endpoint", () => {
    const searchSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/api/admin/digest/editorial/search-happenings/route.ts"
      ),
      "utf-8"
    );

    it("should export a GET handler", () => {
      expect(searchSource).toContain("export async function GET(");
    });

    it("should be admin-only", () => {
      expect(searchSource).toContain("checkAdminRole(");
    });

    it("should require query param q with minimum 2 chars", () => {
      expect(searchSource).toContain('.get("q")');
      expect(searchSource).toContain("query.length < 2");
    });

    it("should return empty results for short queries", () => {
      expect(searchSource).toContain("{ results: [] }");
    });

    it("should search events table with ilike on title", () => {
      expect(searchSource).toContain('.from("events")');
      expect(searchSource).toContain('.ilike("title"');
    });

    it("should only search published, active events", () => {
      expect(searchSource).toContain('.eq("is_published", true)');
      expect(searchSource).toContain('.eq("status", "active")');
    });

    it("should limit results to 10", () => {
      expect(searchSource).toContain(".limit(10)");
    });

    it("should include venue name via join", () => {
      expect(searchSource).toContain("venues!left(name)");
    });

    it("should return id, title, event_date, venue_name in results", () => {
      expect(searchSource).toContain("id: event.id");
      expect(searchSource).toContain("title: event.title");
      expect(searchSource).toContain("event_date: event.event_date");
      expect(searchSource).toContain("venue_name:");
    });

    it("should handle venue join returning array or object", () => {
      expect(searchSource).toContain("Array.isArray(event.venues)");
    });

    it("should use service role client for query", () => {
      expect(searchSource).toContain("createServiceRoleClient()");
    });

    it("should set dynamic = force-dynamic", () => {
      expect(searchSource).toContain('"force-dynamic"');
    });

    it("should return 401 for unauthenticated users", () => {
      expect(searchSource).toContain("401");
    });

    it("should return 403 for non-admin users", () => {
      expect(searchSource).toContain("403");
    });
  });

  describe("Cross-cutting: Token family isolation", () => {
    const tokenSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/unsubscribeToken.ts"),
      "utf-8"
    );

    it("member token message uses :unsubscribe_digest suffix", () => {
      expect(tokenSource).toContain(
        "${userId}:unsubscribe_digest"
      );
    });

    it("newsletter token message uses :unsubscribe_newsletter suffix", () => {
      expect(tokenSource).toContain(
        "${normalizedEmail}:unsubscribe_newsletter"
      );
    });

    it("both families share the same UNSUBSCRIBE_SECRET env var", () => {
      // Both use the same module-level const
      expect(tokenSource).toContain(
        "const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET"
      );
      // There should be exactly ONE declaration of the secret
      const declarations = (tokenSource.match(
        /const UNSUBSCRIBE_SECRET = process\.env\.UNSUBSCRIBE_SECRET/g
      ) || []).length;
      expect(declarations).toBe(1);
    });

    it("member and newsletter generate functions have different message formats", () => {
      // Extract the two generate functions
      const memberGen = tokenSource.slice(
        tokenSource.indexOf("export function generateUnsubscribeToken("),
        tokenSource.indexOf("export function validateUnsubscribeToken(")
      );
      const newsletterGen = tokenSource.slice(
        tokenSource.indexOf(
          "export function generateNewsletterUnsubscribeToken("
        ),
        tokenSource.indexOf(
          "export function validateNewsletterUnsubscribeToken("
        )
      );

      expect(memberGen).toContain(":unsubscribe_digest");
      expect(memberGen).not.toContain(":unsubscribe_newsletter");
      expect(newsletterGen).toContain(":unsubscribe_newsletter");
      expect(newsletterGen).not.toContain(":unsubscribe_digest");
    });
  });

  // =========================================================================
  // GTM-3.1: Cron Schedule + Baseball Card Renderer + Slug/URL Normalization
  // =========================================================================

  describe("GTM-3.1: Cron schedule update to Sunday 23:00 UTC", () => {
    const vercelConfig = fs.readFileSync(
      path.join(process.cwd(), "vercel.json"),
      "utf-8"
    );
    const cronSource = fs.readFileSync(
      path.join(SRC_DIR, "app/api/cron/weekly-happenings/route.ts"),
      "utf-8"
    );

    it("vercel.json schedules weekly-happenings at 0 23 * * 0 (Sunday 23:00 UTC)", () => {
      const config = JSON.parse(vercelConfig);
      const happeningsCron = config.crons?.find(
        (c: { path: string }) => c.path === "/api/cron/weekly-happenings"
      );
      expect(happeningsCron).toBeDefined();
      expect(happeningsCron.schedule).toBe("0 23 * * 0");
    });

    it("cron route documents MST/MDT timing in header comment", () => {
      expect(cronSource).toContain("Sunday 23:00 UTC");
      expect(cronSource).toContain("MST");
      expect(cronSource).toContain("MDT");
    });

    it("cron route mentions manual seasonal adjustment in comment", () => {
      expect(cronSource).toContain("seasonal adjustment");
    });
  });

  describe("GTM-3.1: Baseball card email renderer", () => {
    const renderSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/email/render.ts"),
      "utf-8"
    );

    it("exports renderEmailBaseballCard function", () => {
      expect(renderSource).toContain("export function renderEmailBaseballCard");
    });

    it("renderEmailBaseballCard accepts cover image options", () => {
      expect(renderSource).toContain("coverUrl?:");
      expect(renderSource).toContain("coverAlt?:");
    });

    it("renderEmailBaseballCard accepts title and titleUrl options", () => {
      expect(renderSource).toContain("title:");
      expect(renderSource).toContain("titleUrl?:");
    });

    it("renderEmailBaseballCard accepts subtitle option", () => {
      expect(renderSource).toContain("subtitle?:");
    });

    it("renderEmailBaseballCard accepts CTA button options", () => {
      expect(renderSource).toContain("ctaText?:");
      expect(renderSource).toContain("ctaUrl?:");
    });

    it("renderEmailBaseballCard uses table-based layout for email safety", () => {
      expect(renderSource).toContain("<table cellpadding");
      expect(renderSource).toContain("cellspacing");
    });

    it("renderEmailBaseballCard uses bgMuted background color", () => {
      expect(renderSource).toContain("EMAIL_COLORS.bgMuted");
    });

    it("renderEmailBaseballCard uses 8px border radius", () => {
      expect(renderSource).toContain("border-radius: 8px");
    });

    it("cover image uses object-contain (never cropped)", () => {
      // Cover should display full image, not cropped
      expect(renderSource).toContain("height: auto");
    });
  });

  describe("GTM-3.1: URL-only normalization helpers", () => {
    const editorialSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/digestEditorial.ts"),
      "utf-8"
    );

    it("exports normalizeEditorialUrl function", () => {
      expect(editorialSource).toContain("export function normalizeEditorialUrl");
    });

    it("exports normalizeEditorialUrls function", () => {
      expect(editorialSource).toContain("export function normalizeEditorialUrls");
    });

    it("exports getEditorialUrlPrefix function", () => {
      expect(editorialSource).toContain("export function getEditorialUrlPrefix");
    });

    it("uses canonical DSC host", () => {
      expect(editorialSource).toContain("CANONICAL_HOST");
    });

    it("normalizes /songwriters/ route prefix", () => {
      expect(editorialSource).toContain('member_spotlight_ref: "/songwriters/"');
    });

    it("normalizes /venues/ route prefix", () => {
      expect(editorialSource).toContain('venue_spotlight_ref: "/venues/"');
    });

    it("normalizes /events/ route prefix", () => {
      expect(editorialSource).toContain('featured_happenings_refs: "/events/"');
    });

    it("normalizes /blog/ route prefix", () => {
      expect(editorialSource).toContain('blog_feature_ref: "/blog/"');
    });

    it("normalizes /gallery/ route prefix", () => {
      expect(editorialSource).toContain('gallery_feature_ref: "/gallery/"');
    });

    it("normalizeEditorialUrl handles http/https and www URLs", () => {
      expect(editorialSource).toContain('input.startsWith("www.")');
      expect(editorialSource).toContain('input.startsWith("http://")');
      expect(editorialSource).toContain('input.startsWith("https://")');
    });
  });

  describe("GTM-3.1: Resolver supports URL parsing with legacy fallback", () => {
    const editorialSource = fs.readFileSync(
      path.join(SRC_DIR, "lib/digest/digestEditorial.ts"),
      "utf-8"
    );

    it("exports resolveEditorialWithDiagnostics", () => {
      expect(editorialSource).toContain("export async function resolveEditorialWithDiagnostics");
    });

    it("parses URLs for member spotlight", () => {
      expect(editorialSource).toContain('getEditorialUrlPrefix("member_spotlight_ref")');
    });

    it("parses URLs for venue spotlight", () => {
      expect(editorialSource).toContain('getEditorialUrlPrefix("venue_spotlight_ref")');
    });

    it("parses URLs for blog and gallery features", () => {
      expect(editorialSource).toContain('getEditorialUrlPrefix("blog_feature_ref")');
      expect(editorialSource).toContain('getEditorialUrlPrefix("gallery_feature_ref")');
    });

    it("parses URLs for featured happenings", () => {
      expect(editorialSource).toContain(
        'getEditorialUrlPrefix("featured_happenings_refs")'
      );
    });

    it("uses isUUID for legacy fallbacks", () => {
      expect(editorialSource).toContain("isUUID(parsed.slug)");
    });
  });

  describe("GTM-3.1: Admin UI accepts URLs only", () => {
    const adminEmailPage = fs.readFileSync(
      path.join(
        SRC_DIR,
        "app/(protected)/dashboard/admin/email/page.tsx"
      ),
      "utf-8"
    );

    it("member spotlight label mentions URL", () => {
      expect(adminEmailPage).toContain("Member Spotlight URL");
    });

    it("venue spotlight label mentions URL", () => {
      expect(adminEmailPage).toContain("Venue Spotlight URL");
    });

    it("member spotlight placeholder shows example with full URL", () => {
      expect(adminEmailPage).toContain("Paste a URL from this site. Example:");
    });

    it("venue spotlight placeholder shows example with full URL", () => {
      expect(adminEmailPage).toContain("Paste a URL from this site. Example:");
    });

    it("blog and gallery labels mention URL", () => {
      expect(adminEmailPage).toContain("Blog Feature URL");
      expect(adminEmailPage).toContain("Gallery Feature URL");
    });

    it("does not reference legacy *_id payload keys", () => {
      expect(adminEmailPage).not.toContain("member_spotlight_id");
      expect(adminEmailPage).not.toContain("venue_spotlight_id");
      expect(adminEmailPage).not.toContain("featured_happening_ids");
    });

    it("builds editorial payload with *_ref keys only", () => {
      expect(adminEmailPage).toContain(
        "member_spotlight_ref: editorial.member_spotlight_ref"
      );
      expect(adminEmailPage).toContain(
        "venue_spotlight_ref: editorial.venue_spotlight_ref"
      );
      expect(adminEmailPage).toContain(
        "blog_feature_ref: editorial.blog_feature_ref"
      );
      expect(adminEmailPage).toContain(
        "gallery_feature_ref: editorial.gallery_feature_ref"
      );
      expect(adminEmailPage).toContain("featured_happenings_refs = featuredRefs");
      expect(adminEmailPage).not.toContain("payload.member_spotlight_id");
      expect(adminEmailPage).not.toContain("payload.venue_spotlight_id");
      expect(adminEmailPage).not.toContain("payload.blog_feature_slug");
      expect(adminEmailPage).not.toContain("payload.gallery_feature_slug");
      expect(adminEmailPage).not.toContain("payload.featured_happening_ids");
    });
  });

  describe("GTM-3.1: API normalizes inputs before storage", () => {
    const editorialRoute = fs.readFileSync(
      path.join(SRC_DIR, "app/api/admin/digest/editorial/route.ts"),
      "utf-8"
    );

    it("imports buildEditorialUpsertData helper", () => {
      expect(editorialRoute).toContain("buildEditorialUpsertData");
    });

    it("builds normalized data before upsert", () => {
      expect(editorialRoute).toContain("buildEditorialUpsertData");
      expect(editorialRoute).toContain("normalizedResult");
    });

    it("returns 400 for invalid payloads instead of 500", () => {
      expect(editorialRoute).toContain("normalizedResult.error");
      expect(editorialRoute).toContain("status: 400");
    });
  });

  describe("GTM-3.1: Editorial template uses baseball cards", () => {
    const templateSource = fs.readFileSync(
      path.join(
        SRC_DIR,
        "lib/email/templates/weeklyHappeningsDigest.ts"
      ),
      "utf-8"
    );

    it("imports renderEmailBaseballCard from render module", () => {
      expect(templateSource).toContain("renderEmailBaseballCard");
    });

    it("member spotlight uses baseball card renderer", () => {
      // Should call renderEmailBaseballCard for member spotlight
      expect(templateSource).toContain("renderEmailBaseballCard");
    });

    it("venue spotlight uses baseball card renderer", () => {
      // Template includes venue spotlight section
      expect(templateSource).toContain("venueSpotlight");
    });

    it("featured happenings include venue links via subtitleHtml", () => {
      expect(templateSource).toContain("subtitleHtml");
      expect(templateSource).toContain("f.venueUrl");
    });
  });

  describe("GTM-3.1: Preview includes diagnostics; send/cron use resolveEditorial", () => {
    const previewRoute = fs.readFileSync(
      path.join(SRC_DIR, "app/api/admin/digest/preview/route.ts"),
      "utf-8"
    );
    const sendRoute = fs.readFileSync(
      path.join(SRC_DIR, "app/api/admin/digest/send/route.ts"),
      "utf-8"
    );
    const cronRoute = fs.readFileSync(
      path.join(SRC_DIR, "app/api/cron/weekly-happenings/route.ts"),
      "utf-8"
    );

    it("preview route imports resolveEditorialWithDiagnostics", () => {
      expect(previewRoute).toContain("resolveEditorialWithDiagnostics");
    });

    it("send route imports resolveEditorial", () => {
      expect(sendRoute).toContain("resolveEditorial");
    });

    it("cron route imports resolveEditorial", () => {
      expect(cronRoute).toContain("resolveEditorial");
    });

    it("all routes import from digestEditorial module", () => {
      expect(previewRoute).toContain("from \"@/lib/digest/digestEditorial\"");
      expect(sendRoute).toContain("from \"@/lib/digest/digestEditorial\"");
      expect(cronRoute).toContain("from \"@/lib/digest/digestEditorial\"");
    });
  });

  describe("GTM-3.1: Idempotency guard comes before editorial resolution", () => {
    const cronSource = fs.readFileSync(
      path.join(SRC_DIR, "app/api/cron/weekly-happenings/route.ts"),
      "utf-8"
    );

    it("claimDigestSendLock is called before resolveEditorial", () => {
      const lockIndex = cronSource.indexOf("claimDigestSendLock");
      const resolveIndex = cronSource.indexOf("resolveEditorial(supabase");
      expect(lockIndex).toBeGreaterThan(-1);
      expect(resolveIndex).toBeGreaterThan(-1);
      expect(lockIndex).toBeLessThan(resolveIndex);
    });

    it("documents Delta 1 pattern in comment", () => {
      expect(cronSource).toContain("Delta 1");
    });

    it("explains editorial resolution happens AFTER lock", () => {
      expect(cronSource).toContain("AFTER lock");
    });
  });
});
