import { describe, expect, it } from "vitest";
import {
  buildInterpretResponseSchema,
  buildQualityHints,
  sanitizeInterpretDraftPayload,
  validateSanitizedDraftPayload,
} from "@/lib/events/interpretEventContract";

describe("interpretEventContract", () => {
  it("sanitizes create payload and derives start_date from event_date", () => {
    const sanitized = sanitizeInterpretDraftPayload("create", {
      title: "Tuesday Open Mic",
      event_type: ["open_mic", "kindred_group"],
      start_time: "19:00:00",
      event_date: "2026-03-10",
      series_mode: "weekly",
      random_key: "should-not-pass",
    });

    expect(sanitized).toEqual({
      title: "Tuesday Open Mic",
      event_type: ["open_mic", "other"],
      start_time: "19:00:00",
      event_date: "2026-03-10",
      start_date: "2026-03-10",
      series_mode: "weekly",
    });
  });

  it("validates required create fields", () => {
    const result = validateSanitizedDraftPayload("create", {
      title: "Missing start date",
      event_type: ["open_mic"],
      start_time: "19:00:00",
      series_mode: "single",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blockingField).toBe("start_date");
    }
  });

  it("sanitizes occurrence payload and override patch allowlist", () => {
    const sanitized = sanitizeInterpretDraftPayload(
      "edit_occurrence",
      {
        status: "normal",
        override_patch: {
          title: "Special title",
          event_type: ["open_mic"], // blocked at occurrence layer
          start_time: "20:00:00",
        },
      },
      "2026-03-17"
    );

    expect(sanitized).toEqual({
      date_key: "2026-03-17",
      status: "normal",
      override_patch: {
        title: "Special title",
        start_time: "20:00:00",
      },
    });
  });

  it("builds quality hints for performer-heavy events missing signup/timeslots", () => {
    const hints = buildQualityHints({
      event_type: ["open_mic"],
      has_timeslots: false,
      is_free: null,
    });

    const fields = hints.map((h) => h.field);
    expect(fields).toContain("signup_mode");
    expect(fields).toContain("has_timeslots");
    expect(fields).toContain("is_free");
  });

  it("builds strict schema for draft_payload and nested override_patch", () => {
    const schema = buildInterpretResponseSchema();
    const draftPayload = (schema.properties as Record<string, any>).draft_payload;
    expect(draftPayload).toBeDefined();
    expect(draftPayload.type).toBe("object");
    expect(draftPayload.additionalProperties).toBe(false);
    expect(draftPayload.properties.title).toBeDefined();
    expect(Array.isArray(draftPayload.required)).toBe(true);
    expect(draftPayload.required).toContain("title");
    expect(draftPayload.required).toContain("override_patch");

    const overridePatch = draftPayload.properties.override_patch;
    expect(overridePatch).toBeDefined();
    expect(overridePatch.type).toBe("object");
    expect(overridePatch.additionalProperties).toBe(false);
    expect(overridePatch.properties.start_time).toBeDefined();
    expect(Array.isArray(overridePatch.required)).toBe(true);
    expect(overridePatch.required).toContain("title");
    expect(overridePatch.required).toContain("start_time");
  });
});
