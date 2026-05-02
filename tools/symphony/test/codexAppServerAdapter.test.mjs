import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseTranscriptJsonl,
  replayTranscriptFixture,
  validateTranscriptRecords
} from "./helpers/codexAppServerAdapterReplay.mjs";
import {
  buildCodexAppServerLaunch,
  runCodexAppServerAdapter
} from "../lib/codexAppServerAdapter.mjs";

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.pid = 12345;
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = {
      writes: [],
      write: (chunk) => {
        this.stdin.writes.push(String(chunk));
        return true;
      }
    };
    this.killSignals = [];
  }

  kill(signal) {
    this.killSignals.push(signal);
    return true;
  }
}

function makeTimerHarness() {
  const timers = [];
  return {
    timers,
    setTimeoutFn(fn, milliseconds) {
      const timer = { fn, milliseconds, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      timer.cleared = true;
    },
    activeTimer(milliseconds) {
      return timers.find((timer) => timer.milliseconds === milliseconds && !timer.cleared);
    }
  };
}

function protocolLine(message) {
  return `${JSON.stringify(message)}\n`;
}

async function startAdapter(options = {}) {
  const child = new FakeChild();
  const timerHarness = makeTimerHarness();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "symphony-app-server-adapter-"));
  const logPath = path.join(tempRoot, "issue-1.jsonl");
  let spawnCall = null;
  let resolveSpawned;
  const spawned = new Promise((resolve) => {
    resolveSpawned = resolve;
  });

  const resultPromise = runCodexAppServerAdapter({
    worktreePath: tempRoot,
    prompt: "do app-server work",
    logPath,
    title: "Issue #1",
    readTimeoutMs: 5000,
    turnTimeoutMs: 60000,
    spawnFn: (command, args, spawnOptions) => {
      spawnCall = { command, args, spawnOptions };
      resolveSpawned();
      return child;
    },
    setTimeoutFn: timerHarness.setTimeoutFn,
    clearTimeoutFn: timerHarness.clearTimeoutFn,
    nowFn: () => new Date("2026-05-02T00:00:00.000Z"),
    ...options
  });
  await spawned;
  return { child, timerHarness, tempRoot, logPath, resultPromise, spawnCall };
}

function sentMessages(child) {
  return child.stdin.writes.map((line) => JSON.parse(line));
}

function assertNoActiveTimers(timerHarness) {
  assert.deepEqual(timerHarness.timers.filter((timer) => !timer.cleared), []);
}

function assertTerminal(result, terminalStatus, terminalReason) {
  assert.equal(result.terminal_status, terminalStatus);
  assert.equal(result.terminal_reason, terminalReason);
  assert.equal(result.adapter_state_snapshot.terminal_status, terminalStatus);
  assert.equal(result.adapter_state_snapshot.terminal_reason, terminalReason);
}

function assertSnapshotMatchesResult(result) {
  assert.equal(result.adapter_state_snapshot.thread_id, result.thread_id);
  assert.equal(result.adapter_state_snapshot.turn_id, result.turn_id);
  assert.equal(result.adapter_state_snapshot.session_id, result.session_id);
  assert.equal(result.adapter_state_snapshot.turn_count, result.turn_count);
  assert.equal(result.adapter_state_snapshot.last_protocol_event, result.last_protocol_event);
  assert.deepEqual(result.adapter_state_snapshot.token_usage, result.token_usage);
  assert.deepEqual(result.adapter_state_snapshot.rate_limits, result.rate_limits);
  assert.equal(result.adapter_state_snapshot.adapter_events_count, result.adapter_events.length);
  assert.equal(result.adapter_state_snapshot.protocol_events_count, result.protocol_events.length);
  assertTerminal(result, result.terminal_status, result.terminal_reason);
}

function assertAdapterEventsAreDeterministic(result) {
  assert.equal(result.adapter_events[0].event, "adapter_started");
  assert.equal(result.adapter_events[0].codex_app_server_pid, 12345);
  assert.deepEqual(result.adapter_events.slice(1).map((event) => event.event), (
    Array.from({ length: result.protocol_events.length }, () => "protocol_message")
  ));
  assert.equal(result.adapter_events.length, result.protocol_events.length + 1);
}

function assertExpectedResult(result, expected) {
  assert.equal(result.ok, expected.ok);
  assert.equal(result.reason, expected.reason);
  assertTerminal(result, expected.terminal_status, expected.terminal_reason);
  for (const field of [
    "thread_id",
    "turn_id",
    "session_id",
    "turn_count",
    "last_protocol_event",
    "token_usage",
    "rate_limits"
  ]) {
    if (Object.prototype.hasOwnProperty.call(expected, field)) {
      assert.deepEqual(result[field], expected[field], field);
    }
  }
  assert.equal(result.protocol_events.length, expected.protocol_events_count);
  assert.equal(result.adapter_events.length, expected.adapter_events_count);
  if (expected.response_error_message) {
    assert.equal(result.responseError.message, expected.response_error_message);
  }
  if (expected.error) {
    assert.equal(result.error, expected.error);
  }
  if (expected.event) {
    assert.equal(result.event, expected.event);
  }
  if (expected.stderr_pattern) {
    assert.match(result.stderr, new RegExp(expected.stderr_pattern));
  }
  if (expected.timeout_phase) {
    assert.equal(result.timeout.phase, expected.timeout_phase);
  }
  if (expected.process_exit_code !== undefined) {
    assert.equal(result.code, expected.process_exit_code);
  }
  assertSnapshotMatchesResult(result);
}

async function replayFixture(fixtureName, options = {}) {
  return replayTranscriptFixture({
    fixtureName,
    startAdapter,
    ...options
  });
}

function adapterOptionsForFixture(fixtureName) {
  if (fixtureName !== "event-callback-error.jsonl") {
    return undefined;
  }
  return {
    onEvent: (event) => {
      if (event.event === "protocol_message") {
        throw new Error("event sink failed");
      }
    }
  };
}

const REPLAY_FIXTURE_NAMES = Object.freeze([
  "event-callback-error.jsonl",
  "initialize-json-rpc-error.jsonl",
  "malformed-protocol-message.jsonl",
  "missing-thread-id.jsonl",
  "missing-turn-id.jsonl",
  "process-exit-before-completion.jsonl",
  "read-timeout.jsonl",
  "stderr-only-diagnostics.jsonl",
  "success-turn-completed.jsonl",
  "thread-json-rpc-error.jsonl",
  "turn-cancelled.jsonl",
  "turn-failed.jsonl",
  "turn-input-required.jsonl",
  "turn-json-rpc-error.jsonl",
  "turn-timeout.jsonl",
  "unsupported-tool-call.jsonl"
]);

const REPLAY_EMIT_MODES = Object.freeze(["line-by-line", "split-lines", "multi-line"]);

test("buildCodexAppServerLaunch uses a shell command for the app-server process", () => {
  assert.deepEqual(buildCodexAppServerLaunch({ command: "codex app-server" }), {
    command: "bash",
    args: ["-lc", "codex app-server"]
  });
});

test("replay helper fails closed on malformed JSONL", () => {
  assert.throws(
    () => parseTranscriptJsonl("{not-json}\n", { fixtureName: "bad.jsonl" }),
    /Invalid transcript fixture bad\.jsonl:1/
  );
});

test("replay helper requires fixture metadata header", () => {
  assert.throws(
    () => validateTranscriptRecords([{ stream: "stdout", message: { id: 1, result: {} } }], {
      fixtureName: "missing-header.jsonl"
    }),
    /must start with a fixture metadata header/
  );
});

test("replay helper validates metadata fields and replay steps", () => {
  assert.throws(
    () => validateTranscriptRecords([
      {
        fixture: {
          name: "bad-metadata.jsonl",
          scenario: "missing codex version"
        }
      },
      { stream: "stdout", message: { id: 1, result: {} } }
    ], { fixtureName: "bad-metadata.jsonl" }),
    /requires non-empty codex_version/
  );
  assert.throws(
    () => validateTranscriptRecords([
      {
        fixture: {
          name: "bad-step.jsonl",
          codex_version: "fixture",
          scenario: "bad step"
        }
      },
      { stream: "stdout" }
    ], { fixtureName: "bad-step.jsonl" }),
    /requires exactly one of chunk or message/
  );
  assert.throws(
    () => validateTranscriptRecords([
      {
        fixture: {
          name: "bad-action.jsonl",
          codex_version: "fixture",
          scenario: "bad action"
        }
      },
      { action: "unknown" }
    ], { fixtureName: "bad-action.jsonl" }),
    /action is unsupported/
  );
});

for (const fixture of REPLAY_FIXTURE_NAMES) {
  for (const emitMode of REPLAY_EMIT_MODES) {
    test(`replay fixture: ${fixture} matches fixture-side expectations (${emitMode})`, async () => {
      const { child, expected, metadata, result, timerHarness } = await replayFixture(fixture, {
        adapterOptions: adapterOptionsForFixture(fixture),
        emitMode
      });

      assert.equal(metadata.name, fixture);
      assert.equal(metadata.codex_version, "codex-app-server-fixture-v1");
      assertExpectedResult(result, expected);
      if (result.protocol_events.length > 0) {
        assertAdapterEventsAreDeterministic(result);
      }
      assert.deepEqual(child.killSignals, expected.kill_signals ?? ["SIGTERM"]);
      assertNoActiveTimers(timerHarness);
    });
  }
}

test("runCodexAppServerAdapter completes a single app-server turn and preserves metadata", async () => {
  const { child, logPath, resultPromise, spawnCall, tempRoot, timerHarness } = await startAdapter();

  assert.equal(spawnCall.command, "bash");
  assert.deepEqual(spawnCall.args, ["-lc", "codex app-server"]);
  assert.equal(spawnCall.spawnOptions.cwd, tempRoot);
  assert.deepEqual(sentMessages(child), [
    {
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "symphony",
          version: "phase-2a-scaffold"
        },
        capabilities: {}
      }
    }
  ]);

  child.stdout.emit("data", protocolLine({ id: 1, result: { capabilities: {} } }));
  assert.deepEqual(sentMessages(child).map((message) => message.method), [
    "initialize",
    "initialized",
    "thread/start"
  ]);
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-1" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-1" } } }));
  child.stderr.emit("data", protocolLine({ method: "turn/completed" }));
  child.stdout.emit("data", protocolLine({
    method: "thread/tokenUsage/updated",
    params: {
      total_token_usage: {
        input_tokens: 10,
        output_tokens: 4,
        total_tokens: 14
      },
      rate_limits: {
        requests_remaining: 99
      }
    }
  }));
  child.stdout.emit("data", protocolLine({ method: "turn/completed" }));

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.reason, "turn_completed");
  assert.equal(result.thread_id, "thread-1");
  assert.equal(result.turn_id, "turn-1");
  assert.equal(result.session_id, "thread-1-turn-1");
  assert.equal(result.turn_count, 1);
  assert.equal(result.last_protocol_event, "turn/completed");
  assert.deepEqual(result.token_usage, {
    input_tokens: 10,
    output_tokens: 4,
    total_tokens: 14
  });
  assert.deepEqual(result.rate_limits, { requests_remaining: 99 });
  assert.deepEqual(result.adapter_state_snapshot, {
    pid: 12345,
    thread_id: "thread-1",
    turn_id: "turn-1",
    session_id: "thread-1-turn-1",
    turn_count: 1,
    last_protocol_event: "turn/completed",
    last_protocol_event_at: "2026-05-02T00:00:00.000Z",
    token_usage: {
      input_tokens: 10,
      output_tokens: 4,
      total_tokens: 14
    },
    rate_limits: { requests_remaining: 99 },
    adapter_events_count: 6,
    protocol_events_count: 5,
    terminal_status: "success",
    terminal_reason: "turn_completed",
    ok: true
  });
  assertTerminal(result, "success", "turn_completed");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);

  const log = await readFile(logPath, "utf8");
  assert.match(log, /symphony_app_server_adapter_result/);
  assert.match(log, /symphony_app_server_adapter_state_snapshot/);
  assert.match(log, /thread-1-turn-1/);
  assert.match(result.stderr, /turn\/completed/);
});

test("runCodexAppServerAdapter emits normalized adapter events for future orchestrator state", async () => {
  const observedEvents = [];
  const { child, resultPromise } = await startAdapter({
    onEvent: (event) => {
      observedEvents.push(event);
    }
  });

  child.stdout.emit("data", protocolLine({ id: 1, result: { capabilities: {} } }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-events" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-events" } } }));
  child.stdout.emit("data", protocolLine({
    method: "thread/tokenUsage/updated",
    params: {
      total_token_usage: {
        input_tokens: 20,
        output_tokens: 7,
        total_tokens: 27
      },
      rate_limits: {
        primary: {
          remaining: 88
        }
      }
    }
  }));
  child.stdout.emit("data", protocolLine({ method: "turn/completed" }));

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.adapter_events.length, observedEvents.length);
  assert.deepEqual(result.adapter_events, observedEvents);
  assert.deepEqual(observedEvents.map((event) => event.event), [
    "adapter_started",
    "protocol_message",
    "protocol_message",
    "protocol_message",
    "protocol_message",
    "protocol_message"
  ]);
  assert.equal(observedEvents[0].codex_app_server_pid, 12345);
  assert.equal(observedEvents[0].thread_id, null);
  assert.equal(observedEvents[1].protocol_message_id, 1);
  assert.equal(observedEvents[2].thread_id, "thread-events");
  assert.equal(observedEvents[3].turn_id, "turn-events");
  assert.equal(observedEvents[3].session_id, "thread-events-turn-events");
  assert.equal(observedEvents[3].turn_count, 1);
  assert.deepEqual(observedEvents[4].token_usage, {
    input_tokens: 20,
    output_tokens: 7,
    total_tokens: 27
  });
  assert.deepEqual(observedEvents[4].rate_limits, {
    primary: {
      remaining: 88
    }
  });
  assert.equal(observedEvents.at(-1).last_protocol_event, "turn/completed");
  assert.equal(observedEvents.at(-1).session_id, "thread-events-turn-events");
});

test("runCodexAppServerAdapter reports log write errors with terminal taxonomy", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter({
    writeFileFn: async () => {
      throw new Error("disk full");
    }
  });

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-log" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-log" } } }));
  child.stdout.emit("data", protocolLine({ method: "turn/completed" }));

  await assert.rejects(resultPromise, (error) => {
    assert.equal(error.message, "disk full");
    assert.equal(error.ok, false);
    assert.equal(error.reason, "log_write_error");
    assert.equal(error.log_write_error, "disk full");
    assert.equal(error.thread_id, "thread-log");
    assert.equal(error.turn_id, "turn-log");
    assertTerminal(error, "failure", "log_write_error");
    return true;
  });
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed when the adapter event sink throws", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter({
    onEvent: (event) => {
      if (event.event === "protocol_message") {
        throw new Error("event sink failed");
      }
    }
  });

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "event_callback_error");
  assert.equal(result.error, "event sink failed");
  assert.equal(result.event, "protocol_message");
  assertTerminal(result, "failure", "event_callback_error");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
  assert.equal(result.adapter_events[0].event, "adapter_started");
  assert.equal(result.adapter_events[1].event, "protocol_message");
});

test("runCodexAppServerAdapter buffers partial stdout lines before parsing", async () => {
  const { child, resultPromise } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-split" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-split" } } }));
  const completed = protocolLine({ method: "turn/completed" });
  child.stdout.emit("data", completed.slice(0, 12));
  child.stdout.emit("data", completed.slice(12));

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.session_id, "thread-split-turn-split");
});

test("runCodexAppServerAdapter parses a valid final stdout buffer on process close", async () => {
  const { child, resultPromise } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-tail" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-tail" } } }));
  child.stdout.emit("data", JSON.stringify({ method: "turn/completed" }));
  child.emit("close", 0, null);

  const result = await resultPromise;
  assert.equal(result.ok, true);
  assert.equal(result.reason, "turn_completed");
  assert.equal(result.session_id, "thread-tail-turn-tail");
});

test("runCodexAppServerAdapter fails closed on an invalid final stdout buffer", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", "{unterminated");
  child.emit("close", 1, null);

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "malformed_protocol_message");
  assert.equal(result.unterminated, true);
  assertTerminal(result, "failure", "protocol_parse_error");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed on malformed JSON protocol lines", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", "{not json}\n");

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "malformed_protocol_message");
  assertTerminal(result, "failure", "protocol_parse_error");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed on initialize JSON-RPC errors", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({
    id: 1,
    error: { code: -32603, message: "initialize failed" }
  }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "initialize_error");
  assertTerminal(result, "failure", "json_rpc_error");
  assert.deepEqual(result.responseError, { code: -32603, message: "initialize failed" });
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed on thread/start JSON-RPC errors", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({
    id: 2,
    error: { code: -32000, message: "thread start failed" }
  }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "thread_start_error");
  assertTerminal(result, "failure", "json_rpc_error");
  assert.deepEqual(result.responseError, { code: -32000, message: "thread start failed" });
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed on turn/start JSON-RPC errors", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-error" } } }));
  child.stdout.emit("data", protocolLine({
    id: 3,
    error: { code: -32000, message: "turn start failed" }
  }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "turn_start_error");
  assertTerminal(result, "failure", "json_rpc_error");
  assert.equal(result.thread_id, "thread-error");
  assert.deepEqual(result.responseError, { code: -32000, message: "turn start failed" });
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed when thread/start omits thread id", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: {} } }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_thread_id");
  assertTerminal(result, "failure", "protocol_parse_error");
  assert.equal(result.thread_id, null);
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed when turn/start omits turn id", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-no-turn" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: {} } }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_turn_id");
  assertTerminal(result, "failure", "protocol_parse_error");
  assert.equal(result.thread_id, "thread-no-turn");
  assert.equal(result.turn_id, null);
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter maps turn/failed to a failed result", async () => {
  const { child, resultPromise } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread_id: "thread-fail" } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn_id: "turn-fail" } }));
  child.stdout.emit("data", protocolLine({ method: "turn/failed", params: { message: "boom" } }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "turn_failed");
  assertTerminal(result, "failure", "turn_failed");
  assert.equal(result.session_id, "thread-fail-turn-fail");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
});

test("runCodexAppServerAdapter maps turn/cancelled to a failed result", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread_id: "thread-cancel" } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn_id: "turn-cancel" } }));
  child.stdout.emit("data", protocolLine({ method: "turn/cancelled" }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "turn_cancelled");
  assertTerminal(result, "failure", "turn_cancelled");
  assert.equal(result.session_id, "thread-cancel-turn-cancel");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails closed when app-server requests user input", async () => {
  const { child, resultPromise } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-input" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-input" } } }));
  child.stdout.emit("data", protocolLine({ method: "item/tool/requestUserInput", params: { prompt: "Continue?" } }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "turn_input_required");
  assertTerminal(result, "failure", "turn_failed");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
});

test("runCodexAppServerAdapter treats dynamic tool calls as unsupported in the scaffold", async () => {
  const { child, resultPromise } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-tool" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-tool" } } }));
  child.stdout.emit("data", protocolLine({ method: "item/tool/call", params: { name: "linear_graphql" } }));

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unsupported_tool_call");
  assertTerminal(result, "failure", "turn_failed");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
});

test("runCodexAppServerAdapter treats stderr as diagnostics only", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-stderr" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-stderr" } } }));
  child.stderr.emit("data", protocolLine({ method: "turn/completed" }));
  child.emit("close", 1, null);

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "process_exit_before_completion");
  assertTerminal(result, "failure", "process_exit_before_completion");
  assert.equal(result.session_id, "thread-stderr-turn-stderr");
  assert.match(result.stderr, /turn\/completed/);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter fails when the process exits before completion", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.emit("close", 1, null);

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "process_exit_before_completion");
  assert.equal(result.code, 1);
  assert.deepEqual(result.adapter_state_snapshot, {
    pid: 12345,
    thread_id: null,
    turn_id: null,
    session_id: null,
    turn_count: 0,
    last_protocol_event: null,
    last_protocol_event_at: null,
    token_usage: null,
    rate_limits: null,
    adapter_events_count: 2,
    protocol_events_count: 1,
    terminal_status: "failure",
    terminal_reason: "process_exit_before_completion",
    ok: false
  });
  assertTerminal(result, "failure", "process_exit_before_completion");
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter enforces startup response timeout with fake timers", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  const timer = timerHarness.activeTimer(5000);
  assert.ok(timer);
  timer.fn();

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "response_timeout");
  assertTerminal(result, "failure", "read_timeout");
  assert.equal(result.timeout.phase, "initialize");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});

test("runCodexAppServerAdapter enforces turn timeout with fake timers", async () => {
  const { child, resultPromise, timerHarness } = await startAdapter();

  child.stdout.emit("data", protocolLine({ id: 1, result: {} }));
  child.stdout.emit("data", protocolLine({ id: 2, result: { thread: { id: "thread-timeout" } } }));
  child.stdout.emit("data", protocolLine({ id: 3, result: { turn: { id: "turn-timeout" } } }));
  const timer = timerHarness.activeTimer(60000);
  assert.ok(timer);
  timer.fn();

  const result = await resultPromise;
  assert.equal(result.ok, false);
  assert.equal(result.reason, "turn_timeout");
  assertTerminal(result, "failure", "read_timeout");
  assert.equal(result.timeout.phase, "turn");
  assert.equal(result.session_id, "thread-timeout-turn-timeout");
  assert.deepEqual(child.killSignals, ["SIGTERM"]);
  assertNoActiveTimers(timerHarness);
});
