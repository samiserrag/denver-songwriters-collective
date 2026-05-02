import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CLIENT_INFO = Object.freeze({
  name: "symphony",
  version: "phase-2a-scaffold"
});

function isoTimestamp(nowFn) {
  const value = nowFn();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function buildCodexAppServerLaunch({ command = "codex app-server" } = {}) {
  return {
    command: "bash",
    args: ["-lc", command]
  };
}

export function buildInitializeRequest({ id = 1, clientInfo = DEFAULT_CLIENT_INFO } = {}) {
  return {
    id,
    method: "initialize",
    params: {
      clientInfo,
      capabilities: {}
    }
  };
}

export function buildInitializedNotification() {
  return {
    method: "initialized",
    params: {}
  };
}

export function buildThreadStartRequest({ id = 2, worktreePath, approvalPolicy, sandbox } = {}) {
  const params = {
    cwd: worktreePath
  };
  if (approvalPolicy) {
    params.approvalPolicy = approvalPolicy;
  }
  if (sandbox) {
    params.sandbox = sandbox;
  }
  return {
    id,
    method: "thread/start",
    params
  };
}

export function buildTurnStartRequest({
  id = 3,
  threadId,
  prompt,
  worktreePath,
  title = "Symphony issue",
  approvalPolicy,
  sandboxPolicy
} = {}) {
  const params = {
    threadId,
    input: [{ type: "text", text: prompt }],
    cwd: worktreePath,
    title
  };
  if (approvalPolicy) {
    params.approvalPolicy = approvalPolicy;
  }
  if (sandboxPolicy) {
    params.sandboxPolicy = sandboxPolicy;
  }
  return {
    id,
    method: "turn/start",
    params
  };
}

function asText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function messageName(message) {
  return asText(message?.method || message?.event || message?.type || message?.name);
}

function maybeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function extractThreadId(message) {
  const result = maybeObject(message?.result);
  const params = maybeObject(message?.params);
  const thread = maybeObject(result.thread || params.thread || message?.thread);
  return firstString(
    thread.id,
    result.thread_id,
    result.threadId,
    params.thread_id,
    params.threadId,
    message?.thread_id,
    message?.threadId
  );
}

function extractTurnId(message) {
  const result = maybeObject(message?.result);
  const params = maybeObject(message?.params);
  const turn = maybeObject(result.turn || params.turn || message?.turn);
  return firstString(
    turn.id,
    result.turn_id,
    result.turnId,
    params.turn_id,
    params.turnId,
    message?.turn_id,
    message?.turnId
  );
}

function extractTokenUsage(message) {
  const params = maybeObject(message?.params);
  const result = maybeObject(message?.result);
  return (
    message?.total_token_usage ||
    message?.tokenUsage ||
    message?.token_usage ||
    message?.usage ||
    params.total_token_usage ||
    params.tokenUsage ||
    params.token_usage ||
    params.usage ||
    result.total_token_usage ||
    result.tokenUsage ||
    result.token_usage ||
    result.usage ||
    null
  );
}

function extractRateLimits(message) {
  const params = maybeObject(message?.params);
  const result = maybeObject(message?.result);
  return (
    message?.rateLimits ||
    message?.rate_limits ||
    params.rateLimits ||
    params.rate_limits ||
    result.rateLimits ||
    result.rate_limits ||
    null
  );
}

function isTurnCompleted(name) {
  return name === "turn/completed" || name === "turn.completed" || name === "turn_completed";
}

function isTurnFailed(name) {
  return name === "turn/failed" || name === "turn.failed" || name === "turn_failed";
}

function isTurnCancelled(name) {
  return name === "turn/cancelled" || name === "turn.cancelled" || name === "turn_cancelled";
}

function isInputRequired(name) {
  return /requestUserInput|input_required|user_input_required|input-required/i.test(name);
}

function isUnsupportedToolCall(name) {
  return name === "item/tool/call" || name === "tool/call" || /unsupported.*tool|tool.*call/i.test(name);
}

function formatProtocolLine(message) {
  return `${JSON.stringify(message)}\n`;
}

function summarizeMessage(message) {
  return {
    id: message?.id ?? null,
    name: messageName(message) || null
  };
}

function jsonRpcError(message) {
  return message?.error && typeof message.error === "object" ? message.error : null;
}

function responseErrorReason(id) {
  if (id === 1) {
    return "initialize_error";
  }
  if (id === 2) {
    return "thread_start_error";
  }
  if (id === 3) {
    return "turn_start_error";
  }
  return "response_error";
}

function appendAdapterLog({ stdout, stderr, protocolEvents, result }) {
  return `${JSON.stringify({
    event: "symphony_app_server_adapter_result",
    result
  })}\n${JSON.stringify({
    event: "symphony_app_server_adapter_state_snapshot",
    snapshot: result.adapter_state_snapshot ?? null
  })}\n${JSON.stringify({
    event: "symphony_app_server_protocol_events",
    events: protocolEvents
  })}\n${JSON.stringify({
    event: "symphony_app_server_raw_output",
    stdout,
    stderr
  })}\n`;
}

export async function runCodexAppServerAdapter({
  command = "codex app-server",
  worktreePath,
  prompt,
  logPath,
  title = "Symphony issue",
  readTimeoutMs = 5000,
  turnTimeoutMs = 3600000,
  approvalPolicy,
  sandbox,
  sandboxPolicy,
  spawnFn = spawn,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  onEvent = null,
  nowFn = () => new Date()
}) {
  if (!worktreePath) {
    throw new Error("worktreePath is required");
  }
  if (!logPath) {
    throw new Error("logPath is required");
  }
  await mkdir(path.dirname(logPath), { recursive: true });

  const launch = buildCodexAppServerLaunch({ command });
  const child = spawnFn(launch.command, launch.args, {
    cwd: worktreePath,
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  let stdoutBuffer = "";
  let settled = false;
  let readTimer = null;
  let turnTimer = null;
  let threadId = null;
  let turnId = null;
  let turnCount = 0;
  let lastEventName = null;
  let lastEventAt = null;
  let tokenUsage = null;
  let rateLimits = null;
  let resolveResult = null;
  let rejectResult = null;
  const protocolEvents = [];
  const adapterEvents = [];

  function sessionId() {
    return threadId && turnId ? `${threadId}-${turnId}` : null;
  }

  function buildStateSnapshot(result) {
    return {
      pid: child.pid ?? null,
      thread_id: threadId,
      turn_id: turnId,
      session_id: sessionId(),
      turn_count: turnCount,
      last_protocol_event: lastEventName,
      last_protocol_event_at: lastEventAt,
      token_usage: tokenUsage,
      rate_limits: rateLimits,
      adapter_events_count: adapterEvents.length,
      protocol_events_count: protocolEvents.length,
      terminal_status: result.ok ? "completed" : "failed",
      terminal_reason: result.reason ?? null,
      ok: result.ok
    };
  }

  function clearTimer(timer) {
    if (timer) {
      clearTimeoutFn(timer);
    }
  }

  function clearAllTimers() {
    clearTimer(readTimer);
    clearTimer(turnTimer);
    readTimer = null;
    turnTimer = null;
  }

  function killChild(signal = "SIGTERM") {
    if (typeof child.kill === "function") {
      child.kill(signal);
    }
  }

  async function settle(result) {
    if (settled) {
      return;
    }
    settled = true;
    clearAllTimers();
    const adapterStateSnapshot = buildStateSnapshot(result);
    const finalResult = {
      ...result,
      logPath,
      stdout,
      stderr,
      thread_id: threadId,
      turn_id: turnId,
      session_id: sessionId(),
      turn_count: turnCount,
      last_protocol_event: lastEventName,
      last_protocol_event_at: lastEventAt,
      token_usage: tokenUsage,
      rate_limits: rateLimits,
      protocol_events: protocolEvents,
      adapter_events: adapterEvents,
      adapter_state_snapshot: adapterStateSnapshot
    };
    try {
      await writeFile(logPath, appendAdapterLog({
        stdout,
        stderr,
        protocolEvents,
        result: finalResult
      }), "utf8");
      resolveResult?.(finalResult);
    } catch (error) {
      rejectResult?.(error);
    }
  }

  function fail(reason, detail = {}) {
    killChild("SIGTERM");
    void settle({
      ok: false,
      reason,
      ...detail
    });
  }

  function emitAdapterEvent(event) {
    const entry = {
      timestamp: isoTimestamp(nowFn),
      codex_app_server_pid: child.pid ?? null,
      thread_id: threadId,
      turn_id: turnId,
      session_id: sessionId(),
      turn_count: turnCount,
      last_protocol_event: lastEventName,
      last_protocol_event_at: lastEventAt,
      token_usage: tokenUsage,
      rate_limits: rateLimits,
      ...event
    };
    adapterEvents.push(entry);
    if (typeof onEvent !== "function") {
      return true;
    }
    try {
      onEvent(entry);
      return true;
    } catch (error) {
      fail("event_callback_error", {
        error: error instanceof Error ? error.message : String(error),
        event: entry.event
      });
      return false;
    }
  }

  function startReadTimeout(phase) {
    clearTimer(readTimer);
    if (Number.isFinite(readTimeoutMs) && readTimeoutMs > 0) {
      readTimer = setTimeoutFn(() => {
        fail("response_timeout", {
          timeout: {
            phase,
            timeoutMs: readTimeoutMs
          }
        });
      }, readTimeoutMs);
    }
  }

  function startTurnTimeout() {
    clearTimer(turnTimer);
    if (Number.isFinite(turnTimeoutMs) && turnTimeoutMs > 0) {
      turnTimer = setTimeoutFn(() => {
        fail("turn_timeout", {
          timeout: {
            phase: "turn",
            timeoutMs: turnTimeoutMs
          }
        });
      }, turnTimeoutMs);
    }
  }

  function writeMessage(message) {
    child.stdin?.write(formatProtocolLine(message));
  }

  function recordProtocolEvent(message) {
    const name = messageName(message);
    if (name) {
      lastEventName = name;
      lastEventAt = isoTimestamp(nowFn);
    }
    const usage = extractTokenUsage(message);
    if (usage) {
      tokenUsage = usage;
    }
    const limits = extractRateLimits(message);
    if (limits) {
      rateLimits = limits;
    }
    protocolEvents.push({
      at: isoTimestamp(nowFn),
      ...summarizeMessage(message)
    });
    const eventThreadId = threadId || extractThreadId(message);
    const eventTurnId = turnId || extractTurnId(message);
    return emitAdapterEvent({
      event: "protocol_message",
      protocol_event: name || null,
      protocol_message_id: message?.id ?? null,
      protocol_message: summarizeMessage(message),
      thread_id: eventThreadId,
      turn_id: eventTurnId,
      session_id: eventThreadId && eventTurnId ? `${eventThreadId}-${eventTurnId}` : null
    });
  }

  function handleMessage(message) {
    if (!recordProtocolEvent(message)) {
      return;
    }
    const name = messageName(message);
    const error = jsonRpcError(message);
    if (error && [1, 2, 3].includes(message?.id)) {
      fail(responseErrorReason(message.id), {
        protocolMessage: summarizeMessage(message),
        responseError: error
      });
      return;
    }

    if (message?.id === 1) {
      clearTimer(readTimer);
      writeMessage(buildInitializedNotification());
      writeMessage(buildThreadStartRequest({ id: 2, worktreePath, approvalPolicy, sandbox }));
      startReadTimeout("thread/start");
      return;
    }

    if (message?.id === 2) {
      threadId = extractThreadId(message);
      clearTimer(readTimer);
      if (!threadId) {
        fail("missing_thread_id", { protocolMessage: summarizeMessage(message) });
        return;
      }
      turnCount += 1;
      writeMessage(buildTurnStartRequest({
        id: 3,
        threadId,
        prompt,
        worktreePath,
        title,
        approvalPolicy,
        sandboxPolicy
      }));
      startTurnTimeout();
      return;
    }

    if (message?.id === 3) {
      turnId = extractTurnId(message);
      if (!turnId) {
        fail("missing_turn_id", { protocolMessage: summarizeMessage(message) });
      }
      return;
    }

    if (isTurnCompleted(name)) {
      killChild("SIGTERM");
      void settle({
        ok: true,
        reason: "turn_completed"
      });
      return;
    }

    if (isTurnFailed(name)) {
      fail("turn_failed", { protocolMessage: summarizeMessage(message) });
      return;
    }

    if (isTurnCancelled(name)) {
      fail("turn_cancelled", { protocolMessage: summarizeMessage(message) });
      return;
    }

    if (isInputRequired(name)) {
      fail("turn_input_required", { protocolMessage: summarizeMessage(message) });
      return;
    }

    if (isUnsupportedToolCall(name)) {
      fail("unsupported_tool_call", { protocolMessage: summarizeMessage(message) });
    }
  }

  function handleBufferedProtocolTail() {
    const line = stdoutBuffer;
    stdoutBuffer = "";
    if (line.trim().length === 0) {
      return;
    }
    try {
      handleMessage(JSON.parse(line));
    } catch (error) {
      fail("malformed_protocol_message", {
        error: error instanceof Error ? error.message : String(error),
        line,
        unterminated: true
      });
    }
  }

  return new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
    const settleWith = (result) => settle(result);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      stdoutBuffer += text;
      let newlineIndex = stdoutBuffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (line.trim().length > 0) {
          try {
            handleMessage(JSON.parse(line));
          } catch (error) {
            fail("malformed_protocol_message", {
              error: error instanceof Error ? error.message : String(error),
              line
            });
            return;
          }
        }
        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearAllTimers();
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("close", (code, signal) => {
      if (settled) {
        return;
      }
      handleBufferedProtocolTail();
      if (settled) {
        return;
      }
      void settleWith({
        ok: false,
        code,
        signal: signal || null,
        reason: "process_exit_before_completion"
      });
    });

    writeMessage(buildInitializeRequest({ id: 1 }));
    if (!emitAdapterEvent({
      event: "adapter_started",
      command: launch.command,
      args: launch.args,
      cwd: worktreePath
    })) {
      return;
    }
    startReadTimeout("initialize");
  });
}
