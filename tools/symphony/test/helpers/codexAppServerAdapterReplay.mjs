import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_APP_SERVER_FIXTURE_ROOT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "codex-app-server-adapter"
);

const VALID_EMIT_MODES = new Set(["line-by-line", "split-lines", "multi-line"]);
const VALID_STREAMS = new Set(["stdout", "stderr"]);
const VALID_ACTIONS = new Set(["fireTimer", "close"]);

function protocolLine(message) {
  return `${JSON.stringify(message)}\n`;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validatePlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function validateMetadata(metadata, fixtureName) {
  validatePlainObject(metadata, "fixture metadata");
  for (const field of ["name", "codex_version", "scenario"]) {
    if (typeof metadata[field] !== "string" || metadata[field].trim().length === 0) {
      throw new Error(`fixture metadata requires non-empty ${field}`);
    }
  }
  if (fixtureName && metadata.name !== fixtureName) {
    throw new Error(`fixture metadata name ${metadata.name} does not match ${fixtureName}`);
  }
}

function validateStep(step, fixtureName, index) {
  validatePlainObject(step, `${fixtureName}:${index + 1}`);
  const location = `${fixtureName}:${index + 1}`;
  if (hasOwn(step, "stream")) {
    if (!VALID_STREAMS.has(step.stream)) {
      throw new Error(`${location} stream must be stdout or stderr`);
    }
    const hasChunk = hasOwn(step, "chunk");
    const hasMessage = hasOwn(step, "message");
    if (hasChunk === hasMessage) {
      throw new Error(`${location} stream entry requires exactly one of chunk or message`);
    }
    if (hasChunk && typeof step.chunk !== "string") {
      throw new Error(`${location} chunk must be a string`);
    }
    if (hasMessage) {
      validatePlainObject(step.message, `${location} message`);
    }
    return;
  }
  if (hasOwn(step, "action")) {
    if (!VALID_ACTIONS.has(step.action)) {
      throw new Error(`${location} action is unsupported`);
    }
    if (step.action === "fireTimer") {
      if (!Number.isInteger(step.milliseconds) || step.milliseconds <= 0) {
        throw new Error(`${location} fireTimer requires positive integer milliseconds`);
      }
    }
    if (step.action === "close") {
      if (hasOwn(step, "code") && !Number.isInteger(step.code)) {
        throw new Error(`${location} close code must be an integer`);
      }
      if (hasOwn(step, "signal") && step.signal !== null && typeof step.signal !== "string") {
        throw new Error(`${location} close signal must be a string or null`);
      }
    }
    return;
  }
  throw new Error(`${location} entry requires stream or action`);
}

export function parseTranscriptJsonl(text, { fixtureName = "transcript" } = {}) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid transcript fixture ${fixtureName}:${index + 1}: ${error.message}`);
      }
    });
}

export function validateTranscriptRecords(records, { fixtureName = "transcript" } = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`${fixtureName} must include a fixture metadata header`);
  }
  const [header, ...steps] = records;
  validatePlainObject(header, `${fixtureName}:1`);
  if (!header.fixture) {
    throw new Error(`${fixtureName} must start with a fixture metadata header`);
  }
  validateMetadata(header.fixture, fixtureName);
  if (steps.length === 0) {
    throw new Error(`${fixtureName} must include at least one replay step`);
  }
  steps.forEach((step, index) => validateStep(step, fixtureName, index + 1));
  return {
    metadata: header.fixture,
    steps
  };
}

export async function loadTranscriptFixture(
  fixtureName,
  { fixtureRoot = DEFAULT_APP_SERVER_FIXTURE_ROOT } = {}
) {
  const text = await readFile(path.join(fixtureRoot, fixtureName), "utf8");
  return validateTranscriptRecords(parseTranscriptJsonl(text, { fixtureName }), { fixtureName });
}

export async function loadExpectedResult(
  fixtureName,
  { fixtureRoot = DEFAULT_APP_SERVER_FIXTURE_ROOT } = {}
) {
  const expectedName = fixtureName.replace(/\.jsonl$/, ".expected.json");
  const expected = JSON.parse(await readFile(path.join(fixtureRoot, expectedName), "utf8"));
  validatePlainObject(expected, `${expectedName} expected result`);
  for (const field of ["name", "ok", "reason", "terminal_status", "terminal_reason"]) {
    if (!hasOwn(expected, field)) {
      throw new Error(`${expectedName} expected result requires ${field}`);
    }
  }
  if (expected.name !== fixtureName) {
    throw new Error(`${expectedName} name ${expected.name} does not match ${fixtureName}`);
  }
  return expected;
}

function transcriptChunk(step) {
  if (typeof step.chunk === "string") {
    return step.chunk;
  }
  if (step.message) {
    return protocolLine(step.message);
  }
  throw new Error(`Transcript stream step needs chunk or message: ${JSON.stringify(step)}`);
}

function emitChunk(emitter, chunk, emitMode) {
  if (emitMode === "split-lines" && chunk.length > 1) {
    const splitAt = Math.max(1, Math.floor(chunk.length / 2));
    emitter.emit("data", chunk.slice(0, splitAt));
    emitter.emit("data", chunk.slice(splitAt));
    return;
  }
  emitter.emit("data", chunk);
}

function flushPending(pending, child, emitMode) {
  if (!pending.stream || pending.chunks.length === 0) {
    return;
  }
  emitChunk(child[pending.stream], pending.chunks.join(""), emitMode);
  pending.stream = null;
  pending.chunks = [];
}

export async function replayTranscriptFixture({
  fixtureName,
  startAdapter,
  emitMode = "line-by-line",
  fixtureRoot = DEFAULT_APP_SERVER_FIXTURE_ROOT,
  adapterOptions
}) {
  if (typeof startAdapter !== "function") {
    throw new Error("startAdapter is required");
  }
  if (!VALID_EMIT_MODES.has(emitMode)) {
    throw new Error(`Unsupported emit mode: ${emitMode}`);
  }
  const harness = await startAdapter(adapterOptions);
  const transcript = await loadTranscriptFixture(fixtureName, { fixtureRoot });
  const expected = await loadExpectedResult(fixtureName, { fixtureRoot });
  const pending = { stream: null, chunks: [] };

  for (const step of transcript.steps) {
    if (step.stream) {
      const chunk = transcriptChunk(step);
      if (emitMode === "multi-line") {
        if (pending.stream && pending.stream !== step.stream) {
          flushPending(pending, harness.child, emitMode);
        }
        pending.stream = step.stream;
        pending.chunks.push(chunk);
      } else {
        emitChunk(harness.child[step.stream], chunk, emitMode);
      }
      continue;
    }

    flushPending(pending, harness.child, emitMode);
    if (step.action === "fireTimer") {
      const timer = harness.timerHarness.activeTimer(step.milliseconds);
      if (!timer) {
        throw new Error(`expected active ${step.milliseconds}ms timer in ${fixtureName}`);
      }
      timer.fn();
      continue;
    }
    if (step.action === "close") {
      harness.child.emit("close", step.code ?? 0, step.signal ?? null);
      continue;
    }
    throw new Error(`Unsupported transcript action in ${fixtureName}: ${step.action}`);
  }

  flushPending(pending, harness.child, emitMode);
  return {
    ...harness,
    expected,
    metadata: transcript.metadata,
    result: await harness.resultPromise
  };
}
