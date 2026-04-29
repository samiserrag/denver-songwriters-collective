import { TRACK1_EVAL_CASES, type Track1EvalCase } from "./track1EvalCases";

export type Track1EvalResult = {
  id: string;
  passed: boolean;
  failures: string[];
};

export type Track1EvalScenarioOutput = {
  scope?: "series" | "occurrence" | "ambiguous";
  followUpQuestion?: string | null;
  selectedImageIndex?: number | null;
  venueResolutionHint?: string | null;
  inferredEventTypes?: string[];
  assistantText?: string;
};

export function evaluateTrack1Case(
  testCase: Track1EvalCase,
  output: Track1EvalScenarioOutput,
): Track1EvalResult {
  const failures: string[] = [];

  if (testCase.expected.scope && output.scope !== testCase.expected.scope) {
    failures.push(
      `expected scope ${testCase.expected.scope}, got ${String(output.scope)}`,
    );
  }

  if (typeof testCase.expected.expectedFollowUpQuestion === "boolean") {
    const hasQuestion = Boolean(output.followUpQuestion?.trim());
    if (hasQuestion !== testCase.expected.expectedFollowUpQuestion) {
      failures.push(
        `expected follow-up question=${testCase.expected.expectedFollowUpQuestion}, got ${hasQuestion}`,
      );
    }
  }

  if (
    typeof testCase.expected.expectedImageSelectionIndex === "number" &&
    output.selectedImageIndex !== testCase.expected.expectedImageSelectionIndex
  ) {
    failures.push(
      `expected image index ${testCase.expected.expectedImageSelectionIndex}, got ${String(output.selectedImageIndex)}`,
    );
  }

  if (testCase.expected.expectedVenueResolverHint) {
    const haystack = `${output.venueResolutionHint ?? ""} ${output.assistantText ?? ""}`.toLowerCase();
    if (!haystack.includes(testCase.expected.expectedVenueResolverHint.toLowerCase())) {
      failures.push(
        `expected venue resolver hint including "${testCase.expected.expectedVenueResolverHint}"`,
      );
    }
  }

  if (testCase.expected.expectedEventTypeHint) {
    const hintRegex = new RegExp(testCase.expected.expectedEventTypeHint, "i");
    const inferred = (output.inferredEventTypes ?? []).join(", ");
    const haystack = `${inferred} ${output.assistantText ?? ""}`;
    if (!hintRegex.test(haystack)) {
      failures.push(
        `expected event type hint matching /${testCase.expected.expectedEventTypeHint}/`,
      );
    }
  }

  for (const phrase of testCase.expected.forbiddenPhrases ?? []) {
    if ((output.assistantText ?? "").toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`assistant text contains forbidden phrase: "${phrase}"`);
    }
  }

  return {
    id: testCase.id,
    passed: failures.length === 0,
    failures,
  };
}

export function evaluateTrack1Outputs(
  outputsById: Record<string, Track1EvalScenarioOutput>,
): Track1EvalResult[] {
  return TRACK1_EVAL_CASES.map((testCase) =>
    evaluateTrack1Case(testCase, outputsById[testCase.id] ?? {}),
  );
}

if (require.main === module) {
  // Placeholder for local/manual runs; this harness is intentionally on-demand only.
  const results = evaluateTrack1Outputs({});
  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.id}`);
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }
}
