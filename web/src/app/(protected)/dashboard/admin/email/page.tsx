/**
 * Admin Email Control Panel
 *
 * Manage digest email automation, preview emails, send tests, and view history.
 * GTM-3: Editorial editor for weekly happenings digest.
 *
 * Admin-only.
 *
 * Phase: GTM-2, GTM-3
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { escapeHtml } from "@/lib/highlight";

interface DigestSetting {
  id: string;
  digest_type: string;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

interface SendHistoryEntry {
  id: string;
  digest_type: string;
  week_key: string;
  sent_at: string;
  recipient_count: number;
}

interface PreviewData {
  subject: string;
  html: string;
  recipientCount: number;
  totalHappenings?: number;
  totalOpenMics?: number;
  totalVenues?: number;
  hasEditorial?: boolean;
  weekKey?: string;
  unresolved?: Array<{
    field: string;
    url?: string;
    reason?: string;
    index?: number;
  }>;
}

interface EditorialData {
  subject_override: string;
  intro_note: string;
  featured_happenings_refs: string;
  member_spotlight_ref: string;
  venue_spotlight_ref: string;
  blog_feature_ref: string;
  gallery_feature_ref: string;
}

/**
 * Client-side ISO week key computation matching server-side computeWeekKey().
 * Format: "YYYY-Www" (e.g., "2026-W06")
 */
function computeWeekKeyClient(date: Date = new Date()): string {
  const denverDate = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Denver" })
  );
  const target = new Date(denverDate.valueOf());
  const dayNum = target.getDay() || 7;
  target.setDate(target.getDate() + 4 - dayNum);
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  const year = target.getFullYear();
  const paddedWeek = String(weekNum).padStart(2, "0");
  return `${year}-W${paddedWeek}`;
}

const EMPTY_EDITORIAL: EditorialData = {
  subject_override: "",
  intro_note: "",
  featured_happenings_refs: "",
  member_spotlight_ref: "",
  venue_spotlight_ref: "",
  blog_feature_ref: "",
  gallery_feature_ref: "",
};

const DIGEST_LABELS: Record<string, string> = {
  weekly_happenings: "Weekly Happenings Digest",
  weekly_open_mics: "Weekly Open Mics Digest",
};

function normalizeMarkdownLink(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return null;
}

function renderRichTextInlineHtml(text: string): string {
  const linkTokens: string[] = [];
  const tokenized = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const normalizedUrl = normalizeMarkdownLink(url);
    const safeLabel = escapeHtml(label.trim() || "link");

    if (!normalizedUrl) {
      return safeLabel;
    }

    const token = `__EDITOR_LINK_${linkTokens.length}__`;
    linkTokens.push(
      `<a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-text-accent); text-decoration: underline;">${safeLabel}</a>`
    );
    return token;
  });

  let html = escapeHtml(tokenized);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  for (let i = 0; i < linkTokens.length; i++) {
    html = html.replace(`__EDITOR_LINK_${i}__`, linkTokens[i]);
  }
  return html;
}

function renderRichTextPreviewHtml(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/^\n+|\n+$/g, "");
  if (!normalized.trim()) {
    return `<p style="margin: 0; color: var(--color-text-tertiary);">No intro note yet.</p>`;
  }

  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const renderedLines = paragraph.split("\n").map((line) => {
        const leading = line.match(/^[\t ]+/)?.[0] ?? "";
        const nbspPrefix = leading
          .replace(/\t/g, "    ")
          .replace(/ /g, "&nbsp;");
        const contentOnly = line.slice(leading.length);
        return `${nbspPrefix}${renderRichTextInlineHtml(contentOnly)}`;
      });
      const withBreaks = renderedLines.join("<br>");
      return `<p style="margin: 0 0 12px 0; color: var(--color-text-primary); line-height: 1.6; font-style: italic;">${withBreaks}</p>`;
    })
    .join("");
}

export default function AdminEmailPage() {
  const [settings, setSettings] = useState<DigestSetting[]>([]);
  const [history, setHistory] = useState<SendHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingType, setTogglingType] = useState<string | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{
    type: string;
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // GTM-3: Editorial state
  const [editorialWeekKey, setEditorialWeekKey] = useState(() => {
    // Default to next week's key
    const next = new Date();
    next.setDate(next.getDate() + 7);
    return computeWeekKeyClient(next);
  });
  const [editorial, setEditorial] = useState<EditorialData>({
    subject_override: "",
    intro_note: "",
    featured_happenings_refs: "",
    member_spotlight_ref: "",
    venue_spotlight_ref: "",
    blog_feature_ref: "",
    gallery_feature_ref: "",
  });
  const [editorialLoading, setEditorialLoading] = useState(false);
  const [editorialSaving, setEditorialSaving] = useState(false);
  const [showIntroNotePreview, setShowIntroNotePreview] = useState(false);
  const introNoteTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [editorialResult, setEditorialResult] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  // GTM-3: Fetch editorial for selected week
  const fetchEditorial = useCallback(async (weekKey: string) => {
    setEditorialLoading(true);
    setEditorialResult(null);
    try {
      const res = await fetch(
        `/api/admin/digest/editorial?week_key=${weekKey}&digest_type=weekly_happenings`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.editorial) {
          setEditorial({
            subject_override: data.editorial.subject_override || "",
            intro_note: data.editorial.intro_note || "",
            featured_happenings_refs: (data.editorial.featured_happenings_refs || []).join("\n"),
            member_spotlight_ref: data.editorial.member_spotlight_ref || "",
            venue_spotlight_ref: data.editorial.venue_spotlight_ref || "",
            blog_feature_ref: data.editorial.blog_feature_ref || "",
            gallery_feature_ref: data.editorial.gallery_feature_ref || "",
          });
        } else {
          setEditorial({ ...EMPTY_EDITORIAL });
        }
      }
    } catch {
      setEditorialResult({ message: "Failed to load editorial.", variant: "error" });
    } finally {
      setEditorialLoading(false);
    }
  }, []);

  // GTM-3: Save editorial
  const handleEditorialSave = async () => {
    setEditorialSaving(true);
    setEditorialResult(null);
    try {
      // Build payload — send all fields so clears persist
      const payload: Record<string, unknown> = {
        weekKey: editorialWeekKey,
        digestType: "weekly_happenings",
        subject_override: editorial.subject_override,
        intro_note: editorial.intro_note,
        member_spotlight_ref: editorial.member_spotlight_ref,
        venue_spotlight_ref: editorial.venue_spotlight_ref,
        blog_feature_ref: editorial.blog_feature_ref,
        gallery_feature_ref: editorial.gallery_feature_ref,
      };
      const featuredRefs = editorial.featured_happenings_refs
        .split("\n")
        .map((ref) => ref.trim())
        .filter(Boolean);
      payload.featured_happenings_refs = featuredRefs;

      const res = await fetch("/api/admin/digest/editorial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditorialResult({ message: `Editorial saved for ${editorialWeekKey}.`, variant: "success" });
      } else {
        const data = await res.json();
        const fieldLabel = data.field
          ? `${data.field}${typeof data.index === "number" ? ` (item ${data.index + 1})` : ""}`
          : "";
        const message = data.error
          ? `${data.error}${fieldLabel ? ` — ${fieldLabel}` : ""}${data.guidance ? `: ${data.guidance}` : ""}${data.example ? ` Example: ${data.example}` : ""}`
          : "Failed to save editorial.";
        setEditorialResult({ message, variant: "error" });
      }
    } catch {
      setEditorialResult({ message: "Network error saving editorial.", variant: "error" });
    } finally {
      setEditorialSaving(false);
    }
  };

  // GTM-3: Delete editorial
  const handleEditorialDelete = async () => {
    if (!window.confirm(`Delete editorial for ${editorialWeekKey}? This cannot be undone.`)) return;
    setEditorialSaving(true);
    setEditorialResult(null);
    try {
      const res = await fetch(
        `/api/admin/digest/editorial?week_key=${editorialWeekKey}&digest_type=weekly_happenings`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setEditorial({ ...EMPTY_EDITORIAL });
        setEditorialResult({ message: `Editorial deleted for ${editorialWeekKey}.`, variant: "success" });
      } else {
        const data = await res.json();
        setEditorialResult({ message: data.error || "Failed to delete editorial.", variant: "error" });
      }
    } catch {
      setEditorialResult({ message: "Network error deleting editorial.", variant: "error" });
    } finally {
      setEditorialSaving(false);
    }
  };

  const insertIntroFormatting = useCallback((before: string, after = "") => {
    const textarea = introNoteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = editorial.intro_note;
    const selected = current.slice(start, end);
    const replacement = `${before}${selected}${after}`;
    const next = `${current.slice(0, start)}${replacement}${current.slice(end)}`;

    setEditorial((prev) => ({ ...prev, intro_note: next }));

    setTimeout(() => {
      textarea.focus();
      const cursor = selected ? start + replacement.length : start + before.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  }, [editorial.intro_note]);

  const insertIntroLink = useCallback(() => {
    const textarea = introNoteTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editorial.intro_note.slice(start, end).trim();
    const label = selected || window.prompt("Link text:", "Read more")?.trim() || "Read more";
    const urlInput = window.prompt("Link URL (https://...):", "https://");
    if (!urlInput) return;

    const normalizedUrl = normalizeMarkdownLink(urlInput);
    if (!normalizedUrl) {
      setEditorialResult({
        message: "Invalid link URL. Use https://, http://, mailto:, /path, or www.",
        variant: "error",
      });
      return;
    }

    const markdownLink = `[${label}](${normalizedUrl})`;
    const current = editorial.intro_note;
    const next = `${current.slice(0, start)}${markdownLink}${current.slice(end)}`;
    setEditorial((prev) => ({ ...prev, intro_note: next }));

    setTimeout(() => {
      textarea.focus();
      const cursor = start + markdownLink.length;
      textarea.setSelectionRange(cursor, cursor);
    }, 0);
  }, [editorial.intro_note]);

  // GTM-3: Load editorial when week key changes
  useEffect(() => {
    fetchEditorial(editorialWeekKey);
  }, [editorialWeekKey, fetchEditorial]);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, historyRes] = await Promise.all([
        fetch("/api/admin/digest/settings"),
        fetch("/api/admin/digest/history"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings ?? []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.history ?? []);
      }
    } catch {
      // Silently handle — page still usable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (digestType: string, newValue: boolean) => {
    setTogglingType(digestType);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/digest/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestType, isEnabled: newValue }),
      });

      if (res.ok) {
        setSettings((prev) =>
          prev.map((s) =>
            s.digest_type === digestType ? { ...s, is_enabled: newValue } : s
          )
        );
        setSendResult({
          type: digestType,
          message: `${DIGEST_LABELS[digestType] ?? digestType} ${newValue ? "enabled" : "disabled"}.`,
          variant: "success",
        });
      } else {
        const data = await res.json();
        setSendResult({
          type: digestType,
          message: data.error ?? "Failed to update setting",
          variant: "error",
        });
      }
    } catch {
      setSendResult({
        type: digestType,
        message: "Network error. Please try again.",
        variant: "error",
      });
    } finally {
      setTogglingType(null);
    }
  };

  const handleSend = async (digestType: string, mode: "full" | "test") => {
    const actionLabel = mode === "test" ? "test email" : "full send";
    if (
      mode === "full" &&
      !window.confirm(
        `Send ${DIGEST_LABELS[digestType] ?? digestType} to ALL eligible recipients?\n\nThis action respects the idempotency lock — it cannot be sent twice for the same week.`
      )
    ) {
      return;
    }

    setSendingType(`${digestType}-${mode}`);
    setSendResult(null);
    try {
      const sendPayload: Record<string, unknown> = { digestType, mode };
      if (digestType === "weekly_happenings") {
        sendPayload.weekKey = editorialWeekKey;
      }
      const res = await fetch("/api/admin/digest/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendPayload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.skipped) {
          setSendResult({
            type: digestType,
            message: data.message,
            variant: "info",
          });
        } else {
          const sentTo = mode === "test" ? ` to ${data.sentTo}` : "";
          setSendResult({
            type: digestType,
            message: `${mode === "test" ? "Test" : "Full"} ${actionLabel} complete: ${data.sent} sent, ${data.failed} failed${sentTo}.`,
            variant: data.failed > 0 ? "error" : "success",
          });
          // Refresh history after successful full send
          if (mode === "full") {
            fetchData();
          }
        }
      } else {
        setSendResult({
          type: digestType,
          message: data.message ?? data.error ?? `Failed to send ${actionLabel}`,
          variant: data.skipped ? "info" : "error",
        });
      }
    } catch {
      setSendResult({
        type: digestType,
        message: `Network error sending ${actionLabel}. Please try again.`,
        variant: "error",
      });
    } finally {
      setSendingType(null);
    }
  };

  const handlePreview = async (digestType: string) => {
    if (previewType === digestType) {
      setPreview(null);
      setPreviewType(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewType(digestType);
    setPreview(null);
    try {
      // GTM-3: Pass week_key for editorial-aware previews
      const previewParams = new URLSearchParams({ type: digestType });
      if (digestType === "weekly_happenings") {
        previewParams.set("week_key", editorialWeekKey);
      }
      const res = await fetch(
        `/api/admin/digest/preview?${previewParams.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const data = await res.json();
        setSendResult({
          type: digestType,
          message: data.error ?? "Failed to load preview",
          variant: "error",
        });
        setPreviewType(null);
      }
    } catch {
      setSendResult({
        type: digestType,
        message: "Network error loading preview.",
        variant: "error",
      });
      setPreviewType(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
        <h1 className="font-display text-2xl text-[var(--color-text-primary)] mb-6">
          Email & Digests
        </h1>
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">
        Email & Digests
      </h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Manage weekly digest automation, preview emails, and send tests.
      </p>

      {/* Result banner */}
      {sendResult && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            sendResult.variant === "success"
              ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
              : sendResult.variant === "error"
                ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300"
                : "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
          }`}
        >
          {sendResult.message}
        </div>
      )}

      {/* Digest Settings Cards */}
      <div className="space-y-6 mb-10">
        {settings.map((setting) => {
          const label = DIGEST_LABELS[setting.digest_type] ?? setting.digest_type;
          const isToggling = togglingType === setting.digest_type;
          const isSendingFull = sendingType === `${setting.digest_type}-full`;
          const isSendingTest = sendingType === `${setting.digest_type}-test`;
          const isAnySending = isSendingFull || isSendingTest;
          const isPreviewOpen = previewType === setting.digest_type;

          return (
            <section
              key={setting.digest_type}
              className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg"
            >
              {/* Header row: label + toggle */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {label}
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {setting.digest_type === "weekly_happenings"
                      ? "All event types — sent weekly on Sunday afternoon (Denver time)"
                      : "Open mics only — sent weekly on Saturday evening (Denver time)"}
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {setting.is_enabled ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={setting.is_enabled}
                    aria-label={`Toggle ${label}`}
                    onClick={() =>
                      handleToggle(setting.digest_type, !setting.is_enabled)
                    }
                    disabled={isToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      setting.is_enabled
                        ? "bg-[var(--color-accent-primary)]"
                        : "bg-[var(--color-bg-tertiary)]"
                    } ${isToggling ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        setting.is_enabled
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    handleSend(setting.digest_type, "full")
                  }
                  disabled={isAnySending}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSendingFull ? "Sending..." : "Send now"}
                </button>
                <button
                  onClick={() =>
                    handleSend(setting.digest_type, "test")
                  }
                  disabled={isAnySending}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
                >
                  {isSendingTest ? "Sending..." : "Send test to me"}
                </button>
                <button
                  onClick={() => handlePreview(setting.digest_type)}
                  disabled={previewLoading && previewType === setting.digest_type}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
                >
                  {previewLoading && previewType === setting.digest_type
                    ? "Loading..."
                    : isPreviewOpen
                      ? "Hide preview"
                      : "Preview email"}
                </button>
              </div>

              {/* Preview panel */}
              {isPreviewOpen && preview && (
                <div className="mt-4">
                  <div className="mb-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-medium">Subject:</span>{" "}
                    {preview.subject}
                    {" · "}
                    <span className="font-medium">Recipients:</span>{" "}
                    {preview.recipientCount}
                    {preview.totalHappenings != null && (
                      <>
                        {" · "}
                        {preview.totalHappenings} happenings across{" "}
                        {preview.totalVenues} venues
                      </>
                    )}
                    {preview.hasEditorial != null && (
                      <>
                        {" · "}
                        Editorial: {preview.hasEditorial ? "✓ included" : "none"}
                        {preview.weekKey && ` (${preview.weekKey})`}
                      </>
                    )}
                    {preview.totalOpenMics != null && (
                      <>
                        {" · "}
                        {preview.totalOpenMics} open mics across{" "}
                        {preview.totalVenues} venues
                      </>
                    )}
                  </div>
                  {preview.unresolved && preview.unresolved.length > 0 && (
                    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-100/70 px-3 py-2 text-xs text-amber-900">
                      <div className="font-semibold mb-1">Unresolved editorial links</div>
                      <ul className="list-disc pl-4 space-y-1">
                        {preview.unresolved.map((item, index) => (
                          <li key={`${item.field}-${item.index ?? index}`}>
                            {item.field}
                            {typeof item.index === "number" ? ` (item ${item.index + 1})` : ""}
                            {item.url ? ` — ${item.url}` : ""}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-1">
                        Fix these URLs before sending. Preview and send will skip unresolved items.
                      </div>
                    </div>
                  )}
                  <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={preview.html}
                      title="Email Preview"
                      className="w-full bg-white"
                      style={{ height: "600px" }}
                      sandbox=""
                    />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* GTM-3: Editorial Editor */}
      <section className="mb-10 p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          Editorial Content
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Add personal editorial to the Weekly Happenings Digest, including member and host spotlights. All fields are optional.
        </p>

        {/* Editorial result banner */}
        {editorialResult && (
          <div
            className={`mb-4 p-3 rounded-lg border text-sm ${
              editorialResult.variant === "success"
                ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300"
            }`}
          >
            {editorialResult.message}
          </div>
        )}

        {/* Week key selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Week
          </label>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={editorialWeekKey}
              onChange={(e) => setEditorialWeekKey(e.target.value)}
              placeholder="2026-W06"
              className="w-32 px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
            <button
              type="button"
              onClick={() => setEditorialWeekKey(computeWeekKeyClient())}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => {
                const next = new Date();
                next.setDate(next.getDate() + 7);
                setEditorialWeekKey(computeWeekKeyClient(next));
              }}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              Next week
            </button>
            {editorialLoading && (
              <span className="text-sm text-[var(--color-text-tertiary)]">Loading...</span>
            )}
          </div>
        </div>

        {/* Subject override */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Subject Line Override
          </label>
          <input
            type="text"
            value={editorial.subject_override}
            onChange={(e) =>
              setEditorial((prev) => ({ ...prev, subject_override: e.target.value }))
            }
            placeholder="Leave blank for default subject"
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
          />
        </div>

        {/* Intro note */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Intro Note
          </label>
          <div className="border border-[var(--color-border-default)] rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border-default)]">
              <button
                type="button"
                onClick={() => insertIntroFormatting("**", "**")}
                className="px-3 py-1 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => insertIntroFormatting("*", "*")}
                className="px-3 py-1 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={insertIntroLink}
                className="px-3 py-1 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                Link
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowIntroNotePreview((prev) => !prev)}
                className="px-3 py-1 text-xs rounded border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                {showIntroNotePreview ? "Edit" : "Preview"}
              </button>
            </div>
            {showIntroNotePreview ? (
              <div
                className="px-4 py-3 text-sm bg-[var(--color-bg-primary)]"
                dangerouslySetInnerHTML={{
                  __html: renderRichTextPreviewHtml(editorial.intro_note),
                }}
              />
            ) : (
              <textarea
                ref={introNoteTextareaRef}
                value={editorial.intro_note}
                onChange={(e) =>
                  setEditorial((prev) => ({ ...prev, intro_note: e.target.value }))
                }
                placeholder="A personal message that appears at the top of the digest..."
                rows={6}
                className="w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] resize-vertical focus:outline-none"
              />
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            Supports markdown-style rich text: <code>**bold**</code>, <code>*italic*</code>, and <code>[link text](https://...)</code>.
          </p>
        </div>

        {/* Featured happenings */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
            Featured Happenings
          </label>
          <p className="text-xs text-[var(--color-text-tertiary)] mb-2">
            Paste a URL from this site, one per line. Example:
            {" "}
            <span className="font-mono text-[11px]">
              https://coloradosongwriterscollective.org/events/a-lodge-lyons-the-rock-garden
            </span>
          </p>
          <textarea
            value={editorial.featured_happenings_refs}
            onChange={(e) =>
              setEditorial((prev) => ({
                ...prev,
                featured_happenings_refs: e.target.value,
              }))
            }
            placeholder={`Paste one URL per line:\nhttps://coloradosongwriterscollective.org/events/a-lodge-lyons-the-rock-garden`}
            rows={4}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] resize-vertical"
          />
        </div>

        {/* Spotlight + Feature fields in 2-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Member spotlight */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Member / Host Spotlight URL
            </label>
            <input
              type="text"
              value={editorial.member_spotlight_ref}
              onChange={(e) =>
                setEditorial((prev) => ({ ...prev, member_spotlight_ref: e.target.value }))
              }
              placeholder="Paste a songwriter/host URL. Example: https://coloradosongwriterscollective.org/songwriters/host-slug"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              Use a host profile URL here when you want a host spotlight in the newsletter.
            </p>
          </div>

          {/* Venue spotlight */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Venue Spotlight URL
            </label>
            <input
              type="text"
              value={editorial.venue_spotlight_ref}
              onChange={(e) =>
                setEditorial((prev) => ({ ...prev, venue_spotlight_ref: e.target.value }))
              }
              placeholder="Paste a URL from this site. Example: https://coloradosongwriterscollective.org/venues/a-lodge-lyons-the-rock-garden"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
          </div>

          {/* Blog feature */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Blog Feature URL
            </label>
            <input
              type="text"
              value={editorial.blog_feature_ref}
              onChange={(e) =>
                setEditorial((prev) => ({ ...prev, blog_feature_ref: e.target.value }))
              }
              placeholder="Paste a URL from this site. Example: https://coloradosongwriterscollective.org/blog/my-post"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
          </div>

          {/* Gallery feature */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
              Gallery Feature URL
            </label>
            <input
              type="text"
              value={editorial.gallery_feature_ref}
              onChange={(e) =>
                setEditorial((prev) => ({ ...prev, gallery_feature_ref: e.target.value }))
              }
              placeholder="Paste a URL from this site. Example: https://coloradosongwriterscollective.org/gallery/album-slug"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleEditorialSave}
            disabled={editorialSaving || editorialLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent-primary)] text-[var(--color-text-on-accent)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {editorialSaving ? "Saving..." : "Save Editorial"}
          </button>
          <button
            onClick={() => setEditorial({ ...EMPTY_EDITORIAL })}
            disabled={editorialSaving}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
          >
            Clear Form
          </button>
          <button
            onClick={handleEditorialDelete}
            disabled={editorialSaving || editorialLoading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            Delete Editorial
          </button>
        </div>
      </section>

      {/* Send History */}
      <section className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
          Send History
        </h2>
        {history.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-sm">
            No digests sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 pr-4 text-[var(--color-text-secondary)] font-medium">
                    Digest
                  </th>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-secondary)] font-medium">
                    Week
                  </th>
                  <th className="text-left py-2 pr-4 text-[var(--color-text-secondary)] font-medium">
                    Sent At
                  </th>
                  <th className="text-right py-2 text-[var(--color-text-secondary)] font-medium">
                    Recipients
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--color-border-default)] last:border-0"
                  >
                    <td className="py-2 pr-4 text-[var(--color-text-primary)]">
                      {DIGEST_LABELS[entry.digest_type] ?? entry.digest_type}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">
                      {entry.week_key}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-text-secondary)]">
                      {new Date(entry.sent_at).toLocaleString("en-US", {
                        timeZone: "America/Denver",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 text-right text-[var(--color-text-primary)]">
                      {entry.recipient_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Info footer */}
      <div className="mt-6 text-sm text-[var(--color-text-tertiary)]">
        <p>
          Digests are sent automatically when enabled. The happenings cron runs
          Sunday 23:20 UTC (Sunday 4:20 PM MST / 5:20 PM MDT Denver time). The
          idempotency guard prevents duplicate sends for the same week. Use
          &quot;Send test to me&quot; to preview without affecting the weekly lock.
        </p>
      </div>
    </div>
  );
}
