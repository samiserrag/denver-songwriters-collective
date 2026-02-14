/**
 * Onboarding media embeds — wiring + source-level checks.
 *
 * Validates:
 * 1. MediaEmbedsEditor is wired in onboarding profile page
 * 2. Existing embeds are preloaded from media_embeds table on revisit
 * 3. Media section is placed immediately after Identity (before Instruments)
 * 4. Onboarding API route calls upsertMediaEmbeds with profile scope
 * 5. Empty-array clear semantics — upsert is called when media_embed_urls is present
 */

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

const ONBOARDING_PAGE = fs.readFileSync(
  path.join(ROOT, "app/onboarding/profile/page.tsx"),
  "utf-8"
);

const ONBOARDING_API = fs.readFileSync(
  path.join(ROOT, "app/api/onboarding/route.ts"),
  "utf-8"
);

describe("onboarding media embeds wiring", () => {
  it("imports and renders MediaEmbedsEditor with mediaEmbedUrls state", () => {
    expect(ONBOARDING_PAGE).toContain("MediaEmbedsEditor");
    expect(ONBOARDING_PAGE).toContain("mediaEmbedUrls");
    expect(ONBOARDING_PAGE).toContain("setMediaEmbedUrls");
  });

  it("sends media_embed_urls in the onboarding submit payload", () => {
    expect(ONBOARDING_PAGE).toContain("media_embed_urls");
    expect(ONBOARDING_PAGE).toContain("mediaEmbedUrls");
  });
});

describe("onboarding media embeds preload on revisit", () => {
  it("queries media_embeds table for profile target_type", () => {
    // Must query the media_embeds table filtered to the user's profile
    expect(ONBOARDING_PAGE).toContain(".from(\"media_embeds\")");
    expect(ONBOARDING_PAGE).toContain("target_type");
    expect(ONBOARDING_PAGE).toContain("\"profile\"");
  });

  it("filters by target_id = user.id and date_key IS NULL", () => {
    expect(ONBOARDING_PAGE).toContain("target_id");
    expect(ONBOARDING_PAGE).toContain("user.id");
    expect(ONBOARDING_PAGE).toContain("date_key");
  });

  it("orders by position ascending", () => {
    expect(ONBOARDING_PAGE).toContain("position");
    expect(ONBOARDING_PAGE).toContain("ascending: true");
  });

  it("sets mediaEmbedUrls from preloaded embeds only when rows exist", () => {
    // Must not blindly set to empty array — only set when embeds.length > 0
    expect(ONBOARDING_PAGE).toContain("embeds.length > 0");
    expect(ONBOARDING_PAGE).toContain("setMediaEmbedUrls(embeds.map(");
  });
});

describe("onboarding section order: media after identity, before instruments", () => {
  it("places media section after identity and before instruments", () => {
    const identityIdx = ONBOARDING_PAGE.indexOf("/* How you identify */");
    const mediaIdx = ONBOARDING_PAGE.indexOf("/* Media links");
    const instrumentsIdx = ONBOARDING_PAGE.indexOf("/* Instruments & Genres");

    expect(identityIdx).toBeGreaterThan(-1);
    expect(mediaIdx).toBeGreaterThan(-1);
    expect(instrumentsIdx).toBeGreaterThan(-1);

    // Media must come after Identity
    expect(mediaIdx).toBeGreaterThan(identityIdx);
    // Media must come before Instruments
    expect(mediaIdx).toBeLessThan(instrumentsIdx);
  });

  it("does not have a second media section elsewhere in the page", () => {
    const firstMediaIdx = ONBOARDING_PAGE.indexOf("/* Media links");
    const secondMediaIdx = ONBOARDING_PAGE.indexOf("/* Media links", firstMediaIdx + 1);
    expect(secondMediaIdx).toBe(-1);
  });
});

describe("onboarding API route media embeds handling", () => {
  it("calls upsertMediaEmbeds with profile scope", () => {
    expect(ONBOARDING_API).toContain("upsertMediaEmbeds");
    expect(ONBOARDING_API).toContain("\"profile\"");
    expect(ONBOARDING_API).toContain("media_embed_urls");
  });

  it("calls upsert when media_embed_urls is present (even if empty array)", () => {
    // The guard should be Array.isArray — not a length check — so empty arrays trigger clear
    expect(ONBOARDING_API).toContain("Array.isArray(body.media_embed_urls)");
  });
});
