# Track 1 Eval Harness (PR 4)

This folder contains an on-demand eval harness for Track 1 AI edit/update behaviors.

## Goals

- Keep deterministic fixture cases for known failure modes.
- Validate outputs from manual prompt trials without making CI flaky.
- Provide a stable checklist before prompt-contract rewrites.

## Fixture Cases

Defined in `track1EvalCases.ts`:

1. ambiguous scope: "move next Thursday to 7"
2. series scope: "change the whole series to 6:30"
3. deterministic image switch: "use the other image"
4. event-type inference from source text
5. venue change resolves existing venue
6. missing event_type should not force "please provide event_type"

## Usage

Use from Node/ts-node/manual scripts by building an `outputsById` object and passing it to `evaluateTrack1Outputs` from `runTrack1EvalHarness.ts`.

This harness is intentionally **not** wired into CI as a model-dependent gate.
