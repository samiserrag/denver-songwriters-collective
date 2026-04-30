import { describe, expect, it } from "vitest";
import {
  evaluatePublishedAiSafetyGate,
  parseAiWriteMetadata,
} from "@/app/api/my-events/[id]/route";
import { canSendExplicitConfirmation } from "@/app/(protected)/dashboard/my-events/_components/publishedRiskConfirmation";

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

describe("parseAiWriteMetadata", () => {
  it("parses both AI metadata keys and strips them from sanitizedBody", () => {
    const body = {
      title: "Updated title",
      ai_write_source: "conversational_create_ui_auto_apply",
      ai_confirm_published_high_risk: true,
    };

    const parsed = parseAiWriteMetadata(body);

    expect(parsed.aiWriteSource).toBe("conversational_create_ui_auto_apply");
    expect(parsed.aiConfirmation).toBe(true);
    expect(parsed.isAiAutoApply).toBe(true);
    expect(parsed.sanitizedBody).toEqual({ title: "Updated title" });
  });

  it("treats non-string ai_write_source as null and not auto-apply", () => {
    expect(parseAiWriteMetadata({ ai_write_source: 42 }).aiWriteSource).toBeNull();
    expect(parseAiWriteMetadata({ ai_write_source: { src: "x" } }).isAiAutoApply).toBe(false);
  });

  it("requires strict boolean true for ai_confirm_published_high_risk", () => {
    const parsed = parseAiWriteMetadata({ ai_confirm_published_high_risk: "true" });
    expect(parsed.aiConfirmation).toBe(false);
  });

  it("returns defaults and unchanged deep-equal body when metadata keys are absent", () => {
    const body = { title: "Only title", categories: ["open_mic"] };
    const parsed = parseAiWriteMetadata(body);

    expect(parsed.aiWriteSource).toBeNull();
    expect(parsed.aiConfirmation).toBe(false);
    expect(parsed.isAiAutoApply).toBe(false);
    expect(parsed.sanitizedBody).toEqual(body);
  });

  it("does not mutate caller input object", () => {
    const body = {
      title: "Keep me",
      ai_write_source: "conversational_create_ui_auto_apply",
      ai_confirm_published_high_risk: true,
    } as Record<string, unknown>;

    const parsed = parseAiWriteMetadata(body);

    expect(Object.prototype.hasOwnProperty.call(body, "ai_write_source")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(body, "ai_confirm_published_high_risk")).toBe(true);
    expect(parsed.sanitizedBody).toEqual({ title: "Keep me" });
  });

  it("keeps persistence payload free of AI metadata", () => {
    const body = {
      title: "Updated title",
      ai_write_source: "conversational_create_ui_auto_apply",
      ai_confirm_published_high_risk: true,
    };
    const { sanitizedBody } = parseAiWriteMetadata(body);
    expect(sanitizedBody).toEqual({ title: "Updated title" });
  });
});

describe("canSendExplicitConfirmation", () => {
  it("returns false for automatic apply even when pending state matches", () => {
    expect(
      canSendExplicitConfirmation({
        automatic: true,
        pendingPublishedRiskConfirmation: true,
        pendingPublishedRiskPatchFingerprint: "abc",
        currentPatchFingerprint: "abc",
      })
    ).toBe(false);
  });

  it("returns true only for manual apply with matching pending fingerprint", () => {
    expect(
      canSendExplicitConfirmation({
        automatic: false,
        pendingPublishedRiskConfirmation: true,
        pendingPublishedRiskPatchFingerprint: "abc",
        currentPatchFingerprint: "abc",
      })
    ).toBe(true);
  });

  it("returns false when fingerprint mismatches", () => {
    expect(
      canSendExplicitConfirmation({
        automatic: false,
        pendingPublishedRiskConfirmation: true,
        pendingPublishedRiskPatchFingerprint: "abc",
        currentPatchFingerprint: "xyz",
      })
    ).toBe(false);
  });

  it("returns false when pending confirmation is false", () => {
    expect(
      canSendExplicitConfirmation({
        automatic: false,
        pendingPublishedRiskConfirmation: false,
        pendingPublishedRiskPatchFingerprint: "abc",
        currentPatchFingerprint: "abc",
      })
    ).toBe(false);
  });

  it("returns false when pending fingerprint is null", () => {
    expect(
      canSendExplicitConfirmation({
        automatic: false,
        pendingPublishedRiskConfirmation: true,
        pendingPublishedRiskPatchFingerprint: null,
        currentPatchFingerprint: "abc",
      })
    ).toBe(false);
  });
});
