import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { evaluatePublishedAiSafetyGate } from "@/app/api/my-events/[id]/route";

const UI_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const uiSource = fs.readFileSync(UI_PATH, "utf-8");

describe("Track 1 PR 9 published-event AI safety gate behavior", () => {
  it("blocks published high-risk AI auto-apply writes with structured 409 payload shape", () => {
    const result = evaluatePublishedAiSafetyGate({
      prevEvent: { is_published: true, title: "Old", start_time: "18:00:00" },
      updates: { updated_at: "2026-04-30T00:00:00Z", start_time: "19:00:00" },
      isAiAutoApply: true,
      aiConfirmation: false,
    });

    expect(result.blocked).toBe(true);
    if (!result.blocked) return;
    expect(result.response.requires_confirmation).toBe(true);
    expect(result.response.confirmation_token).toBe("published_high_risk");
    expect(result.response.blocked_fields).toContain("start_time");
  });

  it("allows published AI writes when explicit confirmation is present", () => {
    const result = evaluatePublishedAiSafetyGate({
      prevEvent: { is_published: true, start_time: "18:00:00" },
      updates: { updated_at: "2026-04-30T00:00:00Z", start_time: "19:00:00" },
      isAiAutoApply: true,
      aiConfirmation: true,
    });

    expect(result.blocked).toBe(false);
  });

  it("does not block unpublished draft edits", () => {
    const result = evaluatePublishedAiSafetyGate({
      prevEvent: { is_published: false, start_time: "18:00:00" },
      updates: { updated_at: "2026-04-30T00:00:00Z", start_time: "19:00:00" },
      isAiAutoApply: true,
      aiConfirmation: false,
    });

    expect(result.blocked).toBe(false);
  });

  it("does not block non-AI/manual writes even if confirmation metadata exists", () => {
    const result = evaluatePublishedAiSafetyGate({
      prevEvent: { is_published: true, start_time: "18:00:00" },
      updates: { updated_at: "2026-04-30T00:00:00Z", start_time: "19:00:00" },
      isAiAutoApply: false,
      aiConfirmation: true,
    });

    expect(result.blocked).toBe(false);
  });
});

describe("Track 1 PR 9 explicit confirmation loop client guard", () => {
  it("never sends confirmation during automatic apply paths", () => {
    expect(uiSource).toContain("const canSendExplicitConfirmation =");
    expect(uiSource).toContain("!options.automatic &&");
  });

  it("binds pending confirmation to the exact patch fingerprint", () => {
    expect(uiSource).toContain("pendingPublishedRiskPatchFingerprint");
    expect(uiSource).toContain("const patchFingerprint = JSON.stringify(mapResult.body)");
    expect(uiSource).toContain("pendingPublishedRiskPatchFingerprint === patchFingerprint");
  });
});
