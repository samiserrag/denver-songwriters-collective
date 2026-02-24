"use client";

import { useState } from "react";

type InterpretMode = "create" | "edit_series" | "edit_occurrence";

export default function InterpreterLabPage() {
  const [mode, setMode] = useState<InterpretMode>("create");
  const [message, setMessage] = useState(
    "Open mic every Tuesday at 7:00 PM at Long Table Brewhouse. Free. Signup at venue."
  );
  const [eventId, setEventId] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setStatusCode(null);
    setResponseBody(null);

    try {
      const payload: Record<string, unknown> = {
        mode,
        message,
      };

      if (mode !== "create" && eventId.trim()) {
        payload.eventId = eventId.trim();
      }
      if (mode === "edit_occurrence" && dateKey.trim()) {
        payload.dateKey = dateKey.trim();
      }

      const res = await fetch("/api/events/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({ error: "Non-JSON response" }));
      setStatusCode(res.status);
      setResponseBody(body);
    } catch (error) {
      setStatusCode(0);
      setResponseBody({
        error: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-2">
            Interpreter Lab
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Hidden test surface for <code>/api/events/interpret</code>. This page is intentionally not linked in navigation.
          </p>
        </div>

        <div className="card-base p-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as InterpretMode)}
              className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="create">create</option>
              <option value="edit_series">edit_series</option>
              <option value="edit_occurrence">edit_occurrence</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[var(--color-text-secondary)]">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          {mode !== "create" && (
            <label className="block space-y-2">
              <span className="text-sm text-[var(--color-text-secondary)]">Event ID</span>
              <input
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="UUID"
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          )}

          {mode === "edit_occurrence" && (
            <label className="block space-y-2">
              <span className="text-sm text-[var(--color-text-secondary)]">Date Key (YYYY-MM-DD)</span>
              <input
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                placeholder="2026-03-03"
                className="w-full rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border-input)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          )}

          <button
            onClick={submit}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-background)] font-semibold disabled:opacity-60"
          >
            {isSubmitting ? "Running..." : "Run Interpreter"}
          </button>
        </div>

        <div className="card-base p-6 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Response</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            HTTP Status: <span className="font-mono">{statusCode ?? "—"}</span>
          </p>
          <pre className="overflow-auto rounded-lg bg-[var(--color-bg-secondary)] p-4 text-xs text-[var(--color-text-primary)]">
            {responseBody ? JSON.stringify(responseBody, null, 2) : "No response yet."}
          </pre>
        </div>
      </div>
    </main>
  );
}
