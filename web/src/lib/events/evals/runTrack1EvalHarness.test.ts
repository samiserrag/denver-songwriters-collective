import { describe, expect, it } from "vitest";

import { TRACK1_EVAL_CASES } from "./track1EvalCases";
import { evaluateTrack1Outputs } from "./runTrack1EvalHarness";

describe("track1 eval harness", () => {
  it("contains the required PR4 fixture cases", () => {
    const caseIds = new Set(TRACK1_EVAL_CASES.map((item) => item.id));

    expect(caseIds).toEqual(
      new Set([
        "scope-ambiguous-next-thursday",
        "scope-series-whole-series",
        "image-switch-other-image",
        "event-type-inferred-from-source",
        "venue-change-resolves-existing",
        "missing-event-type-no-hard-block",
      ]),
    );
  });

  it("evaluates matching outputs as pass", () => {
    const results = evaluateTrack1Outputs({
      "scope-ambiguous-next-thursday": {
        scope: "ambiguous",
        followUpQuestion: "Do you want this one occurrence or the full series?",
      },
      "scope-series-whole-series": {
        scope: "series",
      },
      "image-switch-other-image": {
        selectedImageIndex: 1,
      },
      "event-type-inferred-from-source": {
        inferredEventTypes: ["workshop", "open mic", "showcase"],
      },
      "venue-change-resolves-existing": {
        venueResolutionHint: "Matched venue: Lost Lake",
      },
      "missing-event-type-no-hard-block": {
        assistantText: "I can apply those updates.",
      },
    });

    expect(results.every((result) => result.passed)).toBe(true);
  });
});
