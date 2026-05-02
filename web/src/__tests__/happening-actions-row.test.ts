/**
 * Source-text contract for the always-visible top action row
 * (Add a Happening / Edit Existing Happenings) and the
 * filter-block-hides-header bug fix on /happenings.
 *
 * Why source-text instead of a real-render harness: the homepage and
 * happenings page run heavy server-side data fetches and render dozens
 * of children, so the existing CRUI / event-detail tests in this repo
 * pin behavior with file-content assertions. This file follows the
 * same pattern.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROW_PATH = path.resolve(
  __dirname,
  "../components/happenings/HappeningActionsRow.tsx",
);
const INDEX_PATH = path.resolve(
  __dirname,
  "../components/happenings/index.ts",
);
const HOMEPAGE_PATH = path.resolve(__dirname, "../app/page.tsx");
const HAPPENINGS_PATH = path.resolve(__dirname, "../app/happenings/page.tsx");
const EVENT_FORM_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/EventForm.tsx",
);

const rowSource = fs.readFileSync(ROW_PATH, "utf-8");
const indexSource = fs.readFileSync(INDEX_PATH, "utf-8");
const homepageSource = fs.readFileSync(HOMEPAGE_PATH, "utf-8");
const happeningsSource = fs.readFileSync(HAPPENINGS_PATH, "utf-8");
const eventFormSource = fs.readFileSync(EVENT_FORM_PATH, "utf-8");

// ---------------------------------------------------------------------------
// 1) HappeningActionsRow component
// ---------------------------------------------------------------------------
describe("HappeningActionsRow component", () => {
  it("exposes both top-of-page entry points with correct hrefs", () => {
    expect(rowSource).toContain('href="/dashboard/my-events/new"');
    expect(rowSource).toContain('href="/dashboard/my-events"');
    expect(rowSource).toContain("Add a Happening");
    expect(rowSource).toContain("Edit Existing Happenings");
  });

  it("supports a hero tone and a page tone for placement on dark/light backgrounds", () => {
    expect(rowSource).toMatch(/type HappeningActionsTone\s*=\s*"hero"\s*\|\s*"page"/);
    expect(rowSource).toContain("TONE_CLASSES");
  });

  it("renders a stable test id so the action row can be located in DOM checks", () => {
    expect(rowSource).toContain('data-testid="happening-actions-row"');
  });

  it("is exported from the happenings barrel so pages can import without deep paths", () => {
    expect(indexSource).toContain('export { HappeningActionsRow } from "./HappeningActionsRow"');
  });
});

// ---------------------------------------------------------------------------
// 2) Homepage wiring
// ---------------------------------------------------------------------------
describe("Homepage — top action strip", () => {
  it("imports HappeningActionsRow from the happenings barrel", () => {
    expect(homepageSource).toMatch(
      /import\s*\{[^}]*HappeningActionsRow[^}]*\}\s*from\s*"@\/components\/happenings"/,
    );
  });

  it("renders the action row above the hero section", () => {
    const rowIndex = homepageSource.indexOf("<HappeningActionsRow");
    const heroIndex = homepageSource.indexOf("<HeroSection");
    expect(rowIndex).toBeGreaterThan(0);
    expect(heroIndex).toBeGreaterThan(0);
    expect(rowIndex).toBeLessThan(heroIndex);
  });

  it("wraps the row in a labeled section so the strip is announced to AT users", () => {
    expect(homepageSource).toContain('aria-label="Happening actions"');
  });
});

// ---------------------------------------------------------------------------
// 3) Happenings page wiring + filter-block-hides-header bug fix
// ---------------------------------------------------------------------------
describe("Happenings page — top action strip + bug fix", () => {
  it("imports HappeningActionsRow from the happenings barrel", () => {
    expect(happeningsSource).toMatch(
      /import\s*\{[^}]*HappeningActionsRow[^}]*\}\s*from\s*"@\/components\/happenings"/,
    );
  });

  it("renders the action row above the hero so it persists when the hero hides", () => {
    const stripIndex = happeningsSource.indexOf("<HappeningActionsRow tone=\"page\"");
    const heroOpenIndex = happeningsSource.indexOf("{showHero && (");
    expect(stripIndex).toBeGreaterThan(0);
    expect(heroOpenIndex).toBeGreaterThan(0);
    expect(stripIndex).toBeLessThan(heroOpenIndex);
  });

  it("renders the action row inside the hero (replacing the previous +Add Happening single-link)", () => {
    expect(happeningsSource).toMatch(
      /<HeroSection[\s\S]*?<HappeningActionsRow tone="hero"/,
    );
    // Anti-creep: the prior conditional "+ Add Happening" link inside the
    // hero must be gone — the row replaces it so we don't render two
    // overlapping CTAs in the same hero.
    expect(happeningsSource).not.toMatch(
      /<HeroSection[\s\S]*?\+ Add Happening[\s\S]*?<\/HeroSection>/,
    );
  });

  it("renders the action row in the !showHero branch unconditionally — fixes the disappearing-link bug", () => {
    // The bug: when filter auto-apply hides the hero AND `pageTitle` is
    // null, the prior code rendered no add/edit entry point at all. The
    // fix wraps the row in `{!showHero && (...)}` with `pageTitle`
    // moved inside (so the row always appears even when pageTitle is
    // null).
    expect(happeningsSource).toMatch(
      /\{!showHero && \([\s\S]*?<HappeningActionsRow tone="page"/,
    );
    // The row is not gated on pageTitle being non-null.
    expect(happeningsSource).not.toMatch(
      /\{!showHero && pageTitle && \([\s\S]*?\+ Add Happening/,
    );
  });
});

// ---------------------------------------------------------------------------
// 4) EventForm — Edit with AI callout
// ---------------------------------------------------------------------------
describe("EventForm — Edit with AI callout", () => {
  it("declares the prominent Edit-with-AI callout at the top of the form", () => {
    expect(eventFormSource).toContain(
      'data-testid="event-form-edit-with-ai-callout"',
    );
    expect(eventFormSource).toContain(">\n              Edit with AI\n            </p>");
  });

  it("renders the callout only when there is an aiEditPath (edit mode)", () => {
    // The callout block opens with `{aiEditPath && (` so create mode (where
    // aiEditPath is null) does not render a redundant entry alongside the
    // create-flow's own conversational entry.
    expect(eventFormSource).toMatch(
      /\{aiEditPath && \(\s*<div\s+data-testid="event-form-edit-with-ai-callout"/,
    );
  });

  it("places the callout above the form's header card", () => {
    const calloutIndex = eventFormSource.indexOf('data-testid="event-form-edit-with-ai-callout"');
    const headerCardIndex = eventFormSource.indexOf(
      'rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-4 shadow-sm">\n        <div className="flex flex-col gap-4 lg:flex-row',
    );
    expect(calloutIndex).toBeGreaterThan(0);
    expect(headerCardIndex).toBeGreaterThan(0);
    expect(calloutIndex).toBeLessThan(headerCardIndex);
  });

  it("uses the existing aiEditPath + aiEditActionLabel so create / edit / occurrence variants work", () => {
    // Anti-creep: do not introduce a new path-derivation, reuse the
    // existing helpers so the occurrence-edit AI route + series-edit AI
    // route both stay correct.
    expect(eventFormSource).toMatch(
      /event-form-edit-with-ai-callout[\s\S]*?router\.push\(aiEditPath\)/,
    );
    expect(eventFormSource).toMatch(
      /event-form-edit-with-ai-callout[\s\S]*?\{aiEditActionLabel\}/,
    );
  });
});
