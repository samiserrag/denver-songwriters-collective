/**
 * Track 1 PR 11 — UI polish source-text wiring tests for CRUI.
 *
 * Mirrors the established CRUI test pattern in this repo (source-string
 * assertions, e.g. `interpreter-lab-conversation-ux.test.ts` and
 * `edit-turn-telemetry-client-hook.test.ts`) because CRUI is large and
 * lacks a real-render harness. Each block maps to one of the five §6
 * PR 11 sub-goals plus the expected anti-creep negative assertions.
 *
 * If a future PR introduces a real React Testing Library harness for
 * CRUI, these source-string assertions should be replaced with
 * real-render assertions.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const CRUI_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx",
);
const cruiSource = fs.readFileSync(CRUI_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Sub-goal 1: distinct visual treatment for result vs follow-up question.
// ---------------------------------------------------------------------------
describe("PR 11 — distinct result vs follow-up visual treatment", () => {
  it("tags the host result panel with a distinct test id", () => {
    expect(cruiSource).toContain('data-testid={\n');
    expect(cruiSource).toContain('"host-result-panel"');
  });

  it("tags the host follow-up panel with a distinct test id", () => {
    expect(cruiSource).toContain('"host-followup-panel"');
  });

  it("uses a HelpCircle icon for the follow-up state and CheckCircle2 for the result state", () => {
    expect(cruiSource).toContain("HelpCircle");
    // The icon swap is conditioned on next_action === ask_clarification
    expect(cruiSource).toMatch(
      /next_action === "ask_clarification"[\s\S]*?HelpCircle[\s\S]*?CheckCircle2/,
    );
  });

  it("uses a distinct accessible aria-label so screen readers can tell follow-up apart from result", () => {
    expect(cruiSource).toContain('"Follow-up question — needs your input"');
    expect(cruiSource).toContain('aria-label={');
  });

  it("uses a distinct heading label for the follow-up state (Needs your input)", () => {
    expect(cruiSource).toContain("Needs your input");
    // The Draft result label remains for the non-clarification branch
    expect(cruiSource).toContain("Draft result");
  });

  it("uses theme tokens for accent colors (no new hex literals introduced)", () => {
    // The conditional border/bg uses existing amber-500/blue-500 utilities.
    // We assert no new hex color was introduced for the panel surfaces.
    const newHexInPanel = cruiSource.match(
      /host-(result|followup)-panel[\s\S]{0,500}?#[0-9A-Fa-f]{3,6}/,
    );
    expect(newHexInPanel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sub-goal 2: clear "What changed" section consuming computePatchDiff.
// ---------------------------------------------------------------------------
describe("PR 11 — What changed section integration", () => {
  it("imports the WhatChanged sub-component", () => {
    expect(cruiSource).toContain('import { WhatChanged } from "./WhatChanged"');
  });

  it("tracks a priorDraftPayload state to feed the diff", () => {
    expect(cruiSource).toContain("priorDraftPayload");
    expect(cruiSource).toContain("setPriorDraftPayload");
    expect(cruiSource).toMatch(
      /useState<Record<string, unknown> \| null>\(null\)/,
    );
  });

  it("captures the previous draft snapshot before clearing lastInterpretResponse on submit", () => {
    expect(cruiSource).toContain(
      "const previousDraftSnapshot = lastInterpretResponse?.draft_payload ?? null;",
    );
  });

  it("commits the prior snapshot alongside the new lastInterpretResponse on success", () => {
    expect(cruiSource).toMatch(
      /setPriorDraftPayload\(previousDraftSnapshot\)[\s\S]*?setLastInterpretResponse\(nextInterpretResponse\)/,
    );
  });

  it("renders WhatChanged only in edit modes (hidden in create)", () => {
    expect(cruiSource).toMatch(
      /effectiveMode === "edit_series" \|\| effectiveMode === "edit_occurrence"[\s\S]*?<WhatChanged/,
    );
  });

  it("does not render WhatChanged on a clarification turn (clarification has no apply)", () => {
    // The render guard explicitly excludes ask_clarification turns so the
    // diff block does not appear when the AI is asking a question.
    expect(cruiSource).toMatch(
      /responseGuidance\.next_action !== "ask_clarification"[\s\S]*?<WhatChanged/,
    );
  });

  it("passes mode, before, and after props to WhatChanged", () => {
    expect(cruiSource).toContain("mode={effectiveMode}");
    expect(cruiSource).toContain("before={priorDraftPayload}");
    expect(cruiSource).toContain("after={responseGuidance.draft_payload}");
  });

  it("clears priorDraftPayload alongside lastInterpretResponse on mode change", () => {
    // Two cleanup useEffects each set both states.
    const cleanupBlocks = cruiSource.match(
      /setLastInterpretResponse\(null\);\s*setPriorDraftPayload\(null\);/g,
    );
    expect(cleanupBlocks?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Sub-goal 3: orange draft preview CTA via canonical btn-accent token.
// ---------------------------------------------------------------------------
describe("PR 11 — orange draft-preview CTA", () => {
  it("applies the canonical btn-accent utility class to the host draft-preview link", () => {
    // Both placements (header strip + aside) tag a testid for stable identity.
    expect(cruiSource).toContain('data-testid="orange-draft-preview-cta"');
    expect(cruiSource).toContain('data-testid="orange-draft-preview-cta-aside"');
    // Both occurrences must include btn-accent in their className.
    const hostHeader = cruiSource.match(
      /data-testid="orange-draft-preview-cta"[\s\S]*?className="([^"]*)"/,
    );
    expect(hostHeader).not.toBeNull();
    expect(hostHeader![1]).toContain("btn-accent");
    const hostAside = cruiSource.match(
      /data-testid="orange-draft-preview-cta-aside"[\s\S]*?className="([^"]*)"/,
    );
    expect(hostAside).not.toBeNull();
    expect(hostAside![1]).toContain("btn-accent");
  });

  it("does not pair the accent background with the legacy text-[var(--color-background)] override", () => {
    // The previous styling explicitly set text-[var(--color-background)] on
    // top of the accent background, which dodges the theme contract. After
    // PR 11 the canonical btn-accent class drives both bg + fg.
    const hostHeader = cruiSource.match(
      /data-testid="orange-draft-preview-cta"[\s\S]*?className="([^"]*)"/,
    );
    expect(hostHeader).not.toBeNull();
    expect(hostHeader![1]).not.toContain("text-[var(--color-background)]");
  });
});

// ---------------------------------------------------------------------------
// Sub-goal 4: calmer waiting state.
// ---------------------------------------------------------------------------
describe("PR 11 — calmer waiting state", () => {
  it("uses an accent-token ring instead of an amber pulsing ring on the waiting bubble", () => {
    expect(cruiSource).toContain(
      'const ASSISTANT_STATUS_ATTENTION_CLASS =\n  "ring-1 ring-[var(--color-accent-primary)]/30 shadow-sm";',
    );
  });

  it("uses calmer accent ring tokens for the just-arrived assistant message marker", () => {
    expect(cruiSource).toContain(
      'const ASSISTANT_RESPONSE_ATTENTION_CLASS =\n  "ring-1 ring-[var(--color-accent-primary)]/30 shadow-sm";',
    );
  });

  it("uses calmer accent ring tokens for the response panel highlight", () => {
    expect(cruiSource).toContain(
      'const RESPONSE_PANEL_ATTENTION_CLASS =\n  "ring-1 ring-[var(--color-accent-primary)]/30 shadow-md";',
    );
  });

  it("removes the element-level pulsing ring (no motion-safe:animate-pulse on the attention classes)", () => {
    // Element-level pulsing read as alarm, not activity. The Sparkles icon
    // still pulses on its own — that's the only motion in the waiting state.
    const attentionDefs = cruiSource.match(
      /const ASSISTANT_(?:RESPONSE|STATUS)_ATTENTION_CLASS =[\s\S]*?;/g,
    );
    expect(attentionDefs).not.toBeNull();
    for (const def of attentionDefs!) {
      expect(def).not.toContain("motion-safe:animate-pulse");
    }
    const panelDef = cruiSource.match(
      /const RESPONSE_PANEL_ATTENTION_CLASS =[\s\S]*?;/,
    );
    expect(panelDef).not.toBeNull();
    expect(panelDef![0]).not.toContain("motion-safe:animate-pulse");
  });

  it("removes the amber ring + amber background pairing from the attention classes", () => {
    // The previous "ring-2 ring-amber-300/80 bg-amber-500/10" combo was the
    // anxious styling. After PR 11 these tokens must not appear in the
    // attention class definitions.
    const allAttentionDefs = cruiSource.match(
      /const (?:ASSISTANT_RESPONSE|ASSISTANT_STATUS|RESPONSE_PANEL)_ATTENTION_CLASS =[\s\S]*?;/g,
    );
    expect(allAttentionDefs).not.toBeNull();
    for (const def of allAttentionDefs!) {
      expect(def).not.toContain("ring-amber-300");
      expect(def).not.toContain("bg-amber-500/10");
    }
  });

  it("uses softer waiting copy instead of the create-only 'Building private draft' chip", () => {
    expect(cruiSource).toContain("Working on it. No action needed.");
    expect(cruiSource).toContain("Tidying the draft");
    expect(cruiSource).not.toContain("Building private draft");
    expect(cruiSource).toContain("Hang tight — I'll show what I have as soon as it's ready.");
    expect(cruiSource).not.toContain("Tiny backstage clipboard noises");
  });
});

// ---------------------------------------------------------------------------
// Sub-goal 5: copy that accurately describes available capabilities.
// ---------------------------------------------------------------------------
describe("PR 11 — copy reflects current capabilities", () => {
  it("default host page title mentions both create and update", () => {
    // The host title is overridden by ai/page.tsx ("Edit Happening With AI")
    // and conversational/page.tsx omits it (uses the default). The default
    // must communicate both capabilities.
    expect(cruiSource).toContain("Create Happening with AI or update an existing one");
  });

  it("default host page description names create + edit + venue + cover + publish-gate behaviors", () => {
    expect(cruiSource).toContain("update an existing happening");
    expect(cruiSource).toContain("save safe edits");
    expect(cruiSource).toContain("resolve venues");
    expect(cruiSource).toContain("switch covers");
    expect(cruiSource).toContain("ask before changing publish-critical fields");
  });

  it("does not promise URL schedule import or festival management (Track 2 scope)", () => {
    // Per AGENTS / collab plan §10: "keep copy honest about what exists today".
    // These features are explicitly out of Track 1 scope.
    expect(cruiSource).not.toMatch(/url\s+(?:schedule\s+)?import/i);
    expect(cruiSource).not.toMatch(/scrape\s+a\s+schedule/i);
    expect(cruiSource).not.toMatch(/festival\s+lineup/i);
    expect(cruiSource).not.toMatch(/bulk\s+import/i);
    expect(cruiSource).not.toMatch(/paste\s+(?:a\s+)?url\s+to\s+import/i);
  });
});

// ---------------------------------------------------------------------------
// Anti-creep: no behavior change to interpret/PATCH/published-gate.
// ---------------------------------------------------------------------------
describe("PR 11 — no behavior change anti-creep", () => {
  it("preserves the host auto-apply branch wiring", () => {
    expect(cruiSource).toContain('await applySeriesPatch(nextInterpretResponse, { automatic: true })');
    expect(cruiSource).toContain('await createEvent(nextInterpretResponse, { automatic: true })');
  });

  it("preserves the published-risk confirmation gate handshake", () => {
    expect(cruiSource).toContain("ai_confirm_published_high_risk");
    expect(cruiSource).toContain("setPendingPublishedRiskConfirmation");
  });

  it("preserves the PR 3 follow-up edit-turn telemetry hook", () => {
    expect(cruiSource).toContain("postEditTurnOutcome");
    expect(cruiSource).toContain('"/api/events/telemetry/edit-turn"');
  });
});
