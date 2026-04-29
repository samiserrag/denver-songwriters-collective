export type Track1ExpectedScope = "series" | "occurrence" | "ambiguous";

export type Track1EvalCase = {
  id: string;
  prompt: string;
  expected: {
    scope?: Track1ExpectedScope;
    expectedFollowUpQuestion?: boolean;
    expectedImageSelectionIndex?: number;
    expectedVenueResolverHint?: string;
    expectedEventTypeHint?: string;
    forbiddenPhrases?: string[];
  };
  notes: string;
};

export const TRACK1_EVAL_CASES: Track1EvalCase[] = [
  {
    id: "scope-ambiguous-next-thursday",
    prompt: "move next Thursday to 7",
    expected: {
      scope: "ambiguous",
      expectedFollowUpQuestion: true,
    },
    notes:
      "Should force clarification for series vs occurrence instead of guessing scope.",
  },
  {
    id: "scope-series-whole-series",
    prompt: "change the whole series to 6:30",
    expected: {
      scope: "series",
      expectedFollowUpQuestion: false,
    },
    notes: "Explicitly requests a series-wide update.",
  },
  {
    id: "image-switch-other-image",
    prompt: "use the other image",
    expected: {
      expectedImageSelectionIndex: 1,
      expectedFollowUpQuestion: false,
    },
    notes:
      "Should resolve deterministically when ordered image references are provided.",
  },
  {
    id: "event-type-inferred-from-source",
    prompt: "Flyer says this is a songwriting workshop and open mic showcase.",
    expected: {
      expectedEventTypeHint: "workshop|open mic|showcase",
      expectedFollowUpQuestion: false,
    },
    notes: "Event type should be inferred from supplied source language.",
  },
  {
    id: "venue-change-resolves-existing",
    prompt: "change the venue to Lost Lake",
    expected: {
      expectedVenueResolverHint: "Lost Lake",
      expectedFollowUpQuestion: false,
    },
    notes: "Should route through existing venue resolution behavior.",
  },
  {
    id: "missing-event-type-no-hard-block",
    prompt: "update details but keep the style similar",
    expected: {
      forbiddenPhrases: ["please provide event_type"],
    },
    notes:
      "Missing event type should not trigger hard-block language asking for event_type.",
  },
];
