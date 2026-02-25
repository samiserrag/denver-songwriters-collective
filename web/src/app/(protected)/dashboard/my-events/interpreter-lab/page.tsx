"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  type InterpretMode,
  type ImageInput,
  IMAGE_INPUT_LIMITS,
} from "@/lib/events/interpretEventContract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StagedImage {
  id: string;
  file: File;
  previewUrl: string;
  /** base64 data (no prefix) produced after client-side resize */
  base64: string;
  mime_type: string;
}

interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Helpers: client-side canvas resize → base64
// ---------------------------------------------------------------------------

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.8;
const ACCEPTED_MIMES = [...IMAGE_INPUT_LIMITS.acceptedMimes];

function resizeImageToBase64(file: File): Promise<{ base64: string; mime_type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D context unavailable"));

      ctx.drawImage(img, 0, 0, width, height);

      // Always output as JPEG for consistent compression
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mime_type: "image/jpeg" });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InterpreterLabPage() {
  // ---- core state (unchanged from original) ----
  const [mode, setMode] = useState<InterpretMode>("create");
  const [message, setMessage] = useState(
    "Open mic every Tuesday at 7:00 PM at Long Table Brewhouse. Free. Signup at venue."
  );
  const [eventId, setEventId] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- image staging ----
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // P1 fix: ref-based count prevents concurrent stageFiles() from exceeding max
  const stagedCountRef = useRef(0);
  useEffect(() => { stagedCountRef.current = stagedImages.length; }, [stagedImages.length]);

  // P2 fix: track all created object URLs for reliable cleanup on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // ---- conversation history ----
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);

  // Cleanup all tracked object URLs on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // ---- image staging logic ----

  const stageFiles = useCallback(
    async (files: File[]) => {
      setImageError(null);

      // Use ref for accurate count even during concurrent calls
      const remaining = IMAGE_INPUT_LIMITS.maxCount - stagedCountRef.current;
      if (remaining <= 0) {
        setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
        return;
      }

      const toProcess = files.slice(0, remaining);

      for (const file of toProcess) {
        // Re-check on each iteration since previous iterations may have added images
        if (stagedCountRef.current >= IMAGE_INPUT_LIMITS.maxCount) {
          setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
          break;
        }

        if (!ACCEPTED_MIMES.includes(file.type)) {
          setImageError(`Unsupported type: ${file.type}. Use JPEG, PNG, WebP, or GIF.`);
          continue;
        }

        if (file.size > IMAGE_INPUT_LIMITS.maxIntakeBytes) {
          setImageError(
            `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${IMAGE_INPUT_LIMITS.maxIntakeBytes / 1024 / 1024}MB.`
          );
          continue;
        }

        try {
          const { base64, mime_type } = await resizeImageToBase64(file);

          // Post-await re-check: a concurrent stageFiles() may have filled slots during resize
          if (stagedCountRef.current >= IMAGE_INPUT_LIMITS.maxCount) {
            setImageError(`Max ${IMAGE_INPUT_LIMITS.maxCount} images allowed`);
            break;
          }

          // Check decoded size after resize
          const decodedBytes = Math.ceil(base64.length * 3 / 4);
          if (decodedBytes > IMAGE_INPUT_LIMITS.maxDecodedBytes) {
            setImageError("Resized image still exceeds 1MB — try a smaller image.");
            continue;
          }

          const previewUrl = URL.createObjectURL(file);
          objectUrlsRef.current.add(previewUrl);

          const staged: StagedImage = {
            id: crypto.randomUUID(),
            file,
            previewUrl,
            base64,
            mime_type,
          };

          // Eagerly increment ref so concurrent calls see it immediately
          stagedCountRef.current += 1;
          setStagedImages((prev) => [...prev, staged]);
        } catch {
          setImageError("Failed to process image.");
        }
      }
    },
    [] // No deps needed — uses refs for mutable state
  );

  const removeImage = useCallback((id: string) => {
    setStagedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        objectUrlsRef.current.delete(target.previewUrl);
        stagedCountRef.current = Math.max(0, stagedCountRef.current - 1);
      }
      return prev.filter((img) => img.id !== id);
    });
    setImageError(null);
  }, []);

  // ---- clipboard paste handler ----

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      e.preventDefault();
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length > 0) stageFiles(files);
    },
    [stageFiles]
  );

  // ---- drag and drop ----

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) stageFiles(files);
    },
    [stageFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ---- submit ----

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

      // Attach conversation history for multi-turn
      if (conversationHistory.length > 0) {
        payload.conversationHistory = conversationHistory;
      }

      // Attach image inputs
      if (stagedImages.length > 0) {
        payload.image_inputs = stagedImages.map(
          (img): ImageInput => ({
            data: img.base64,
            mime_type: img.mime_type,
          })
        );
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

      // Append to conversation history for multi-turn
      if (res.ok && body) {
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: message },
          {
            role: "assistant",
            content: body.human_summary || body.clarification_question || JSON.stringify(body),
          },
        ]);
      }
    } catch (error) {
      setStatusCode(0);
      setResponseBody({
        error: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearHistory() {
    setConversationHistory([]);
    setStatusCode(null);
    setResponseBody(null);
    setStagedImages((prev) => {
      prev.forEach((img) => {
        URL.revokeObjectURL(img.previewUrl);
        objectUrlsRef.current.delete(img.previewUrl);
      });
      return [];
    });
    stagedCountRef.current = 0;
    setImageError(null);
  }

  return (
    <main
      className="min-h-screen bg-[var(--color-background)] py-12 px-6"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
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
              placeholder="Describe the event, or paste an image of a flyer..."
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

          {/* ---- Image staging area ---- */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Images ({stagedImages.length}/{IMAGE_INPUT_LIMITS.maxCount})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={stagedImages.length >= IMAGE_INPUT_LIMITS.maxCount}
                className="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
              >
                + Add image
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) stageFiles(files);
                  e.target.value = "";
                }}
              />
            </div>

            {stagedImages.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {stagedImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group w-24 h-24 rounded-lg overflow-hidden border border-[var(--color-border-input)] bg-[var(--color-bg-secondary)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt="Staged"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      x
                    </button>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center truncate px-1">
                      {(img.file.size / 1024).toFixed(0)}KB
                    </span>
                  </div>
                ))}
              </div>
            )}

            {stagedImages.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Drag and drop, paste from clipboard, or click &ldquo;+ Add image&rdquo; to stage flyer images for extraction.
              </p>
            )}

            {imageError && (
              <p className="text-xs text-[var(--color-text-error)]">{imageError}</p>
            )}
          </div>

          {/* ---- Action buttons ---- */}
          <div className="flex gap-3">
            <button
              onClick={submit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-background)] font-semibold disabled:opacity-60"
            >
              {isSubmitting ? "Running..." : "Run Interpreter"}
            </button>

            {conversationHistory.length > 0 && (
              <button
                onClick={clearHistory}
                type="button"
                className="px-4 py-2 rounded-lg border border-[var(--color-border-input)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Clear History ({conversationHistory.length / 2} turns)
              </button>
            )}
          </div>
        </div>

        {/* ---- Conversation history display ---- */}
        {conversationHistory.length > 0 && (
          <div className="card-base p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Conversation History
            </h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {conversationHistory.map((entry, i) => (
                <div
                  key={i}
                  className={`text-xs p-2 rounded ${
                    entry.role === "user"
                      ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                      : "bg-[var(--color-accent-primary)]/10 text-[var(--color-text-secondary)]"
                  }`}
                >
                  <span className="font-mono font-bold">{entry.role}:</span>{" "}
                  {entry.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- Response display ---- */}
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
