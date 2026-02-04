/**
 * Admin Email Control Panel
 *
 * Manage digest email automation, preview emails, send tests, and view history.
 *
 * Admin-only.
 *
 * Phase: GTM-2
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";

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
}

const DIGEST_LABELS: Record<string, string> = {
  weekly_happenings: "Weekly Happenings Digest",
  weekly_open_mics: "Weekly Open Mics Digest",
};

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
      const res = await fetch("/api/admin/digest/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestType, mode }),
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
      const res = await fetch(
        `/api/admin/digest/preview?type=${digestType}`
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
                      ? "All event types — sent weekly on Saturday evening (Denver time)"
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
                    {preview.totalOpenMics != null && (
                      <>
                        {" · "}
                        {preview.totalOpenMics} open mics across{" "}
                        {preview.totalVenues} venues
                      </>
                    )}
                  </div>
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
          Digests are sent automatically when enabled. The cron runs Sunday 3:00
          UTC (Saturday 8-9 PM Denver time). The idempotency guard prevents
          duplicate sends for the same week. Use &quot;Send test to me&quot; to preview
          without affecting the weekly lock.
        </p>
      </div>
    </div>
  );
}
