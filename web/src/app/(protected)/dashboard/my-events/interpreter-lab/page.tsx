"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  type InterpretMode,
  type ImageInput,
  IMAGE_INPUT_LIMITS,
} from "@/lib/events/interpretEventContract";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  uploadCoverForEvent,
  softDeleteCoverImageRow,
} from "@/lib/events/uploadCoverForEvent";
import type { NextAction } from "@/lib/events/interpretEventContract";

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

interface ResponseGuidance {
  next_action: string;
  human_summary: string | null;
  clarification_question: string | null;
  blocking_fields: string[];
}

// ---------------------------------------------------------------------------
// Feature flag: client-side gate for write actions in the lab.
// Set NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES=true in env to enable.
// ---------------------------------------------------------------------------

const LAB_WRITES_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_INTERPRETER_LAB_WRITES === "true";

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

/**
 * Convert a base64 JPEG string back into a File suitable for uploadCoverForEvent.
 * Uses .jpg extension so the helper derives the correct storage path extension.
 */
function base64ToJpegFile(base64: string): File {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    bytes[i] = byteChars.charCodeAt(i);
  }
  return new File([bytes], `cover-${crypto.randomUUID()}.jpg`, {
    type: "image/jpeg",
  });
}

// ---------------------------------------------------------------------------
// Phase 4B: Allowed next_action values for create write
// ---------------------------------------------------------------------------

const CREATABLE_NEXT_ACTIONS: ReadonlySet<NextAction> = new Set([
  "show_preview",
  "await_confirmation",
  "done",
]);

// ---------------------------------------------------------------------------
// Phase 4B: Map interpreter draft_payload → POST /api/my-events body
// ---------------------------------------------------------------------------

/** Fields required by POST /api/my-events */
const CREATE_REQUIRED_FIELDS = ["title", "event_type", "start_time", "start_date"] as const;

/**
 * Optional fields that pass through directly from the interpreter draft_payload
 * to the create API body when present and non-null.
 */
const CREATE_PASSTHROUGH_OPTIONALS = [
  "description",
  "series_mode",
  "recurrence_rule",
  "end_time",
  "capacity",
  "is_free",
  "cost_label",
  "signup_mode",
  "signup_url",
  "signup_deadline",
  "signup_time",
  "age_policy",
  "external_url",
  "has_timeslots",
  "total_slots",
  "slot_duration_minutes",
  "allow_guests",
  "categories",
  "max_occurrences",
  "occurrence_count",
  "custom_dates",
  "timezone",
  "host_notes",
  "online_url",
  "venue_name",
  "day_of_week",
] as const;

type MapResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Map an interpreter sanitized draft_payload into a body suitable for
 * POST /api/my-events. Returns an error if required fields are missing.
 *
 * Venue handling:
 * - If draft has `venue_id` (UUID), pass it through.
 * - Else if draft has `custom_location_name`, use custom location path.
 * - Else if draft has `online_url`, use online location path.
 * - Else return a mapper error (no silent fallback).
 */
function mapDraftToCreatePayload(draft: Record<string, unknown>): MapResult {
  // 1. Check required fields
  for (const field of CREATE_REQUIRED_FIELDS) {
    const val = draft[field];
    if (val === undefined || val === null || val === "") {
      return { ok: false, error: `Missing required field: ${field}` };
    }
  }

  // event_type must be a non-empty array
  const eventType = draft.event_type;
  if (!Array.isArray(eventType) || eventType.length === 0) {
    return { ok: false, error: "event_type must be a non-empty array" };
  }

  // 2. Build base payload with required fields
  const body: Record<string, unknown> = {
    title: draft.title,
    event_type: eventType,
    start_time: draft.start_time,
    start_date: draft.start_date,
  };

  // 3. Venue / location resolution
  const hasVenueId =
    typeof draft.venue_id === "string" && draft.venue_id.trim().length > 0;
  const hasCustomLocationName =
    typeof draft.custom_location_name === "string" &&
    (draft.custom_location_name as string).trim().length > 0;
  const hasOnlineUrl =
    typeof draft.online_url === "string" && draft.online_url.trim().length > 0;

  if (hasVenueId) {
    body.venue_id = (draft.venue_id as string).trim();
    body.location_mode = (draft.location_mode as string) || "venue";
  } else if (hasCustomLocationName) {
    body.custom_location_name = (draft.custom_location_name as string).trim();
    body.location_mode = (draft.location_mode as string) || "venue";
    // Pass through optional custom location fields
    for (const f of ["custom_address", "custom_city", "custom_state", "custom_latitude", "custom_longitude", "location_notes"] as const) {
      if (draft[f] !== undefined && draft[f] !== null) {
        body[f] = draft[f];
      }
    }
  } else if (hasOnlineUrl) {
    body.location_mode = "online";
    body.online_url = (draft.online_url as string).trim();
  } else {
    // No valid location resolved for create payload
    return {
      ok: false,
      error:
        "Missing location: provide venue_id, custom_location_name, or online_url",
    };
  }

  // 4. Pass through optional fields
  for (const field of CREATE_PASSTHROUGH_OPTIONALS) {
    const val = draft[field];
    if (val !== undefined && val !== null) {
      body[field] = val;
    }
  }

  // 5. series_mode default
  if (!body.series_mode) {
    body.series_mode = "single";
  }

  return { ok: true, body };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InterpreterLabPage() {
  // ---- core state (unchanged from original) ----
  const [mode, setMode] = useState<InterpretMode>("create");
  const [message, setMessage] = useState("");
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

  // ---- Phase 4A: cover candidate state ----
  const [coverCandidateId, setCoverCandidateId] = useState<string | null>(null);
  const [isApplyingCover, setIsApplyingCover] = useState(false);
  const [coverMessage, setCoverMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ---- Phase 4B: create-mode write state ----
  const [lastInterpretResponse, setLastInterpretResponse] = useState<{
    next_action: string;
    draft_payload: Record<string, unknown>;
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const responseGuidance = useMemo<ResponseGuidance | null>(() => {
    if (!responseBody || typeof responseBody !== "object") return null;
    const maybe = responseBody as Record<string, unknown>;
    if (typeof maybe.next_action !== "string") return null;
    const blocking = Array.isArray(maybe.blocking_fields)
      ? maybe.blocking_fields.filter((v): v is string => typeof v === "string")
      : [];
    return {
      next_action: maybe.next_action,
      human_summary: typeof maybe.human_summary === "string" ? maybe.human_summary : null,
      clarification_question:
        typeof maybe.clarification_question === "string" ? maybe.clarification_question : null,
      blocking_fields: blocking,
    };
  }, [responseBody]);

  // Derived: is current mode an edit mode with a valid eventId?
  const isEditMode = mode === "edit_series" || mode === "edit_occurrence";
  const hasValidEventId = eventId.trim().length > 0;

  // Can show cover controls (click-to-select thumbnails):
  // Edit mode: flag + edit mode + valid eventId + images
  // Create mode: flag + create mode + images (no eventId needed until create time)
  const canShowCoverControls =
    LAB_WRITES_ENABLED &&
    stagedImages.length > 0 &&
    (
      (isEditMode && hasValidEventId) ||
      mode === "create"
    );

  // Phase 4B: Can show create action in create mode
  const canShowCreateAction =
    LAB_WRITES_ENABLED &&
    mode === "create" &&
    lastInterpretResponse !== null &&
    CREATABLE_NEXT_ACTIONS.has(lastInterpretResponse.next_action as NextAction);

  // Clear cover candidate when mode changes or images change
  useEffect(() => {
    if (coverCandidateId && !stagedImages.some((img) => img.id === coverCandidateId)) {
      setCoverCandidateId(null);
    }
  }, [stagedImages, coverCandidateId]);

  // Clear cover message when mode/eventId changes
  useEffect(() => {
    setCoverMessage(null);
  }, [mode, eventId]);

  // Clear create state when mode changes
  useEffect(() => {
    setLastInterpretResponse(null);
    setCreateMessage(null);
  }, [mode]);

  // If create inputs change, require a fresh interpret run before create write.
  useEffect(() => {
    if (mode === "create") {
      setLastInterpretResponse(null);
      setCreateMessage(null);
    }
  }, [mode, message, stagedImages.length]);

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

  // ---- submit (interpret request) ----

  async function submit() {
    setIsSubmitting(true);
    setStatusCode(null);
    setResponseBody(null);

    // Avoid stale create writes if the new interpret call fails.
    if (mode === "create") {
      setLastInterpretResponse(null);
      setCreateMessage(null);
    }

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
        const assistantParts: string[] = [];
        if (typeof body.human_summary === "string" && body.human_summary.trim().length > 0) {
          assistantParts.push(body.human_summary.trim());
        }
        if (
          body.next_action === "ask_clarification" &&
          typeof body.clarification_question === "string" &&
          body.clarification_question.trim().length > 0
        ) {
          assistantParts.push(`Question: ${body.clarification_question.trim()}`);
        }

        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: message },
          {
            role: "assistant",
            content: assistantParts.join("\n\n") || JSON.stringify(body),
          },
        ]);

        if (body.next_action === "ask_clarification") {
          // Keep follow-up turns lightweight by clearing the original long prompt.
          setMessage("");
        }

        // Phase 4B: Track last successful interpreter response for create action
        if (body.next_action && body.draft_payload) {
          setLastInterpretResponse({
            next_action: body.next_action as string,
            draft_payload: body.draft_payload as Record<string, unknown>,
          });
        }
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

  // ---- Phase 4A: Apply cover to event (edit mode only) ----

  async function applyCover() {
    // Guard: preconditions
    if (!coverCandidateId || !isEditMode || !hasValidEventId) return;

    const candidate = stagedImages.find((img) => img.id === coverCandidateId);
    if (!candidate) {
      setCoverMessage({ type: "error", text: "Selected cover image no longer staged." });
      return;
    }

    setIsApplyingCover(true);
    setCoverMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();

      // 1. Get authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCoverMessage({ type: "error", text: "Not authenticated. Please log in again." });
        return;
      }

      const targetEventId = eventId.trim();

      // 2. Fresh-fetch current event cover_image_url
      const { data: eventRow, error: fetchError } = await supabase
        .from("events")
        .select("cover_image_url")
        .eq("id", targetEventId)
        .maybeSingle();

      if (fetchError || !eventRow) {
        setCoverMessage({
          type: "error",
          text: fetchError ? `Failed to fetch event: ${fetchError.message}` : "Event not found.",
        });
        return;
      }

      const previousCoverUrl = eventRow.cover_image_url as string | null;

      // 3. Convert base64 to File (resized JPEG)
      const coverFile = base64ToJpegFile(candidate.base64);

      // 4. Upload via shared helper
      const uploadedUrl = await uploadCoverForEvent({
        supabase,
        eventId: targetEventId,
        file: coverFile,
        userId: session.user.id,
      });

      // 5. Update events.cover_image_url
      const { error: updateError } = await supabase
        .from("events")
        .update({ cover_image_url: uploadedUrl })
        .eq("id", targetEventId);

      if (updateError) {
        setCoverMessage({
          type: "error",
          text: `Upload succeeded but cover update failed: ${updateError.message}`,
        });
        return;
      }

      // 6. Soft-delete previous cover row if it existed and differs
      if (previousCoverUrl && previousCoverUrl !== uploadedUrl) {
        await softDeleteCoverImageRow(supabase, targetEventId, previousCoverUrl);
      }

      setCoverMessage({
        type: "success",
        text: `Cover image applied to event ${targetEventId.slice(0, 8)}…`,
      });
    } catch (error) {
      setCoverMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Cover apply failed.",
      });
    } finally {
      setIsApplyingCover(false);
    }
  }

  // ---- Phase 4B: Create event from interpreter draft (create mode only) ----

  async function createEvent() {
    if (!canShowCreateAction || !lastInterpretResponse) return;

    // Map draft_payload to POST /api/my-events body
    const mapResult = mapDraftToCreatePayload(lastInterpretResponse.draft_payload);
    if (!mapResult.ok) {
      setCreateMessage({ type: "error", text: `Cannot create: ${mapResult.error}` });
      return;
    }

    setIsCreating(true);
    setCreateMessage(null);

    try {
      // 1. POST to create API
      const res = await fetch("/api/my-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(mapResult.body),
      });

      const result = await res.json().catch(() => ({ error: "Non-JSON response" }));

      if (!res.ok) {
        setCreateMessage({
          type: "error",
          text: `Create failed (${res.status}): ${result.error || JSON.stringify(result)}`,
        });
        return;
      }

      const newEventId = result.id as string;
      const slug = result.slug as string | undefined;

      // 2. Deferred cover assignment (optional)
      if (coverCandidateId && newEventId) {
        const candidate = stagedImages.find((img) => img.id === coverCandidateId);
        if (candidate) {
          try {
            const supabase = createSupabaseBrowserClient();
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              const coverFile = base64ToJpegFile(candidate.base64);
              const uploadedUrl = await uploadCoverForEvent({
                supabase,
                eventId: newEventId,
                file: coverFile,
                userId: session.user.id,
              });

              // Update events.cover_image_url
              const { error: updateError } = await supabase
                .from("events")
                .update({ cover_image_url: uploadedUrl })
                .eq("id", newEventId);

              if (updateError) {
                await softDeleteCoverImageRow(supabase, newEventId, uploadedUrl).catch(() => {
                  // Best-effort cleanup for partial failure path.
                });
                setCreateMessage({
                  type: "warning",
                  text: `Event created (${newEventId.slice(0, 8)}…${slug ? `, slug: ${slug}` : ""}), but cover update failed: ${updateError.message}`,
                });
                return;
              }

              setCreateMessage({
                type: "success",
                text: `Event created with cover (${newEventId.slice(0, 8)}…${slug ? `, slug: ${slug}` : ""})`,
              });
              return;
            } else {
              // No session for cover upload — event still created
              setCreateMessage({
                type: "warning",
                text: `Event created (${newEventId.slice(0, 8)}…${slug ? `, slug: ${slug}` : ""}), but cover upload skipped: not authenticated.`,
              });
              return;
            }
          } catch (coverError) {
            // Cover upload failed — event still created
            setCreateMessage({
              type: "warning",
              text: `Event created (${newEventId.slice(0, 8)}…${slug ? `, slug: ${slug}` : ""}), cover upload failed: ${coverError instanceof Error ? coverError.message : "unknown error"}`,
            });
            return;
          }
        }
      }

      // Success without cover
      setCreateMessage({
        type: "success",
        text: `Event created (${newEventId.slice(0, 8)}…${slug ? `, slug: ${slug}` : ""})`,
      });
    } catch (error) {
      setCreateMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Create request failed.",
      });
    } finally {
      setIsCreating(false);
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
    setCoverCandidateId(null);
    setCoverMessage(null);
    setLastInterpretResponse(null);
    setCreateMessage(null);
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
                {stagedImages.map((img) => {
                  const isSelected = coverCandidateId === img.id;
                  return (
                    <div
                      key={img.id}
                      className={`relative group w-24 h-24 rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] transition-all ${
                        isSelected
                          ? "ring-2 ring-[var(--color-accent-primary)] border-2 border-[var(--color-accent-primary)]"
                          : "border border-[var(--color-border-input)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt="Staged"
                        className={`w-full h-full object-cover ${
                          canShowCoverControls ? "cursor-pointer" : ""
                        }`}
                        onClick={
                          canShowCoverControls
                            ? () => setCoverCandidateId(isSelected ? null : img.id)
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        x
                      </button>
                      {isSelected && (
                        <span className="absolute top-1 left-1 bg-[var(--color-accent-primary)] text-[var(--color-background)] text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Cover
                        </span>
                      )}
                      <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center truncate px-1">
                        {(img.file.size / 1024).toFixed(0)}KB
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {stagedImages.length === 0 && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Drag and drop, paste from clipboard, or click &ldquo;+ Add image&rdquo; to stage flyer images for extraction.
              </p>
            )}

            {canShowCoverControls && stagedImages.length > 0 && !coverCandidateId && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Click a thumbnail to select it as the event cover image.
              </p>
            )}

            {imageError && (
              <p className="text-xs text-[var(--color-text-error)]">{imageError}</p>
            )}
          </div>

          {/* ---- Action buttons ---- */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={submit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-background)] font-semibold disabled:opacity-60"
            >
              {isSubmitting ? "Running..." : "Run Interpreter"}
            </button>

            {/* Phase 4A: Apply as Cover — edit mode only */}
            {canShowCoverControls && isEditMode && coverCandidateId && (
              <button
                onClick={applyCover}
                disabled={isApplyingCover || isSubmitting}
                type="button"
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-60 transition-colors hover:bg-emerald-700"
              >
                {isApplyingCover ? "Applying..." : "Apply as Cover"}
              </button>
            )}

            {/* Phase 4B: Confirm & Create — only visible in create mode with valid response */}
            {canShowCreateAction && (
              <button
                onClick={createEvent}
                disabled={isCreating || isSubmitting}
                type="button"
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 transition-colors hover:bg-blue-700"
              >
                {isCreating ? "Creating..." : "Confirm & Create"}
              </button>
            )}

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

          {/* Phase 4A: Cover apply status message */}
          {coverMessage && (
            <p
              className={`text-xs ${
                coverMessage.type === "success"
                  ? "text-emerald-500"
                  : "text-[var(--color-text-error)]"
              }`}
            >
              {coverMessage.text}
            </p>
          )}

          {/* Phase 4B: Create status message */}
          {createMessage && (
            <p
              className={`text-xs ${
                createMessage.type === "success"
                  ? "text-emerald-500"
                  : createMessage.type === "warning"
                    ? "text-amber-500"
                    : "text-[var(--color-text-error)]"
              }`}
            >
              {createMessage.text}
            </p>
          )}
        </div>

        {/* ---- Human-readable next-step guidance ---- */}
        {statusCode === 200 && responseGuidance && (
          <div className="card-base p-6 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              What Happens Next
            </h2>

            {responseGuidance.human_summary && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {responseGuidance.human_summary}
              </p>
            )}

            {responseGuidance.next_action === "ask_clarification" && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-text-primary)]">
                  <span className="font-semibold">Question:</span>{" "}
                  {responseGuidance.clarification_question ||
                    "Please answer the missing required fields."}
                </p>
                {responseGuidance.blocking_fields.length > 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Missing required fields:{" "}
                    <span className="font-mono">
                      {responseGuidance.blocking_fields.join(", ")}
                    </span>
                  </p>
                )}
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  In the message box above, reply with only the missing details, then click
                  &nbsp;<span className="font-semibold">Run Interpreter</span>.
                </p>
              </div>
            )}

            {responseGuidance.next_action !== "ask_clarification" && (
              <p className="text-xs text-[var(--color-text-tertiary)]">
                The draft is ready for the next step.
                {canShowCreateAction ? " Click Confirm & Create to publish." : ""}
              </p>
            )}
          </div>
        )}

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
