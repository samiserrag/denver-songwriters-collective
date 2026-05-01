/**
 * Track 1 PR 3 follow-up — source-text wiring tests for the
 * client-side userOutcome capture hook in `ConversationalCreateUI.tsx`.
 *
 * Mirrors the established CRUI test pattern in this repo
 * (source-string assertions, e.g. `interpreter-lab-conversation-ux.test.ts`)
 * because CRUI is large and lacks a real-render test harness. The
 * complete behavioral path (interpret response → state capture → patch
 * success → fire-and-forget POST) is exercised end-to-end at the
 * server-emit boundary by `edit-turn-telemetry-wiring.test.ts` and
 * `edit-turn-telemetry-followup.test.ts`. This file ensures the client
 * wiring that bridges them is present and unbroken.
 *
 * If a future PR introduces a real React Testing Library harness for
 * CRUI, these source-string assertions should be replaced with
 * real-render assertions. See PR handoff: client behavioral coverage
 * is acknowledged as the gap closed in a separate refactor.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const CRUI_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx",
);
const cruiSource = fs.readFileSync(CRUI_PATH, "utf-8");

describe("CRUI — userOutcome client hook (PR 3 follow-up)", () => {
  it("declares latestEditTurnId state with a string-or-null shape", () => {
    expect(cruiSource).toContain("latestEditTurnId");
    expect(cruiSource).toContain("setLatestEditTurnId");
    expect(cruiSource).toMatch(
      /useState<string \| null>\(null\)/,
    );
  });

  it("defines a postEditTurnOutcome callback that POSTs to the followup endpoint", () => {
    expect(cruiSource).toContain("postEditTurnOutcome");
    expect(cruiSource).toContain('"/api/events/telemetry/edit-turn"');
  });

  it("postEditTurnOutcome sends turnId + userOutcome in the JSON body", () => {
    expect(cruiSource).toMatch(
      /JSON\.stringify\(\{\s*turnId,\s*userOutcome\s*\}\)/,
    );
  });

  it("postEditTurnOutcome is fire-and-forget — wraps fetch in try/catch and silently swallows promise rejection", () => {
    // Promise .catch suppresses async failures; surrounding try/catch
    // suppresses synchronous throw paths. Both must be present.
    expect(cruiSource).toMatch(/postEditTurnOutcome[\s\S]*?\.catch\(/);
    expect(cruiSource).toMatch(/postEditTurnOutcome = useCallback[\s\S]*?try\s*\{/);
  });

  it("postEditTurnOutcome clears latestEditTurnId after initiating the post", () => {
    // After the fire-and-forget post, state is cleared so the next
    // accept/reject cannot accidentally re-fire with a stale turnId.
    expect(cruiSource).toMatch(
      /postEditTurnOutcome = useCallback[\s\S]*?setLatestEditTurnId\(null\)/,
    );
  });

  it("captures editTurnId from a successful interpret response into state", () => {
    // The interpret response handler stores the server-issued editTurnId
    // so a later accept/reject can correlate by turnId.
    expect(cruiSource).toMatch(
      /res\.ok[\s\S]*?editTurnId[\s\S]*?setLatestEditTurnId/,
    );
  });

  it("captures editTurnId from a successful AI-origin my-events PATCH response into state", () => {
    // applySeriesPatch reads result.editTurnId and stores it for the
    // accept hook below.
    expect(cruiSource).toContain("seriesPatchEditTurnId");
    expect(cruiSource).toMatch(/result[\s\S]*?editTurnId[\s\S]*?seriesPatchEditTurnId/);
  });

  it("fires accept with the freshly captured turnId after a successful series patch", () => {
    // The accept fire uses seriesPatchEditTurnId (local var) rather
    // than latestEditTurnId state to avoid React async-state races.
    expect(cruiSource).toMatch(
      /postEditTurnOutcome\(seriesPatchEditTurnId,\s*"accepted"\)/,
    );
  });

  it("fires accept after a successful occurrence override apply", () => {
    expect(cruiSource).toMatch(
      /postEditTurnOutcome\(latestEditTurnId,\s*"accepted"\)/,
    );
  });

  it("fires accept after a successful create POST", () => {
    // createEvent fires the accept hook once at the start of the
    // success-path branches. There may be more than one such call; we
    // assert at least one.
    const matches = cruiSource.match(/postEditTurnOutcome\(latestEditTurnId,\s*"accepted"\)/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("does not auto-emit anything on component unmount (state clears with React)", () => {
    // Sanity check: there is no useEffect cleanup that posts the outcome
    // on unmount. Per task: 'do NOT auto-emit — that's neither
    // acceptance nor rejection. Just clear.'
    expect(cruiSource).not.toMatch(
      /useEffect\([^)]*?return\s*\(\)\s*=>\s*\{[^}]*?postEditTurnOutcome/,
    );
  });
});
