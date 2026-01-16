"use client";

/**
 * Override Import Card
 *
 * File input for CSV upload, preview diff, and apply changes.
 * Supports upsert: creates new overrides and updates existing ones.
 */

import { useState, useRef } from "react";
import OverrideDiffTable from "./OverrideDiffTable";

interface OverrideInsertPreview {
  event_id: string;
  date_key: string;
  status: string;
}

interface OverrideUpdatePreview {
  event_id: string;
  date_key: string;
  changes: { field: string; oldValue: string | null; newValue: string | null }[];
}

interface PreviewResult {
  valid: boolean;
  summary?: {
    totalRows: number;
    inserts: number;
    updates: number;
    unchanged: number;
    eventIdsNotFound: number;
  };
  inserts?: OverrideInsertPreview[];
  updates?: OverrideUpdatePreview[];
  eventIdsNotFound?: string[];
  warnings?: { rowIndex: number; warnings: string[] }[];
  parseErrors?: string[];
  validationErrors?: { rowIndex: number; errors: string[] }[];
  error?: string;
}

interface ApplyResult {
  success: boolean;
  summary: {
    inserted: number;
    updated: number;
    unchanged: number;
    errors?: number;
  };
  errors?: { key: string; error: string }[];
}

export default function OverrideImportCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setPreviewResult(null);
    setApplyResult(null);
    setError(null);
    setShowConfirm(false);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      setFileName(file.name);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvContent) return;

    setPreviewLoading(true);
    setError(null);
    setPreviewResult(null);
    setApplyResult(null);

    try {
      const response = await fetch("/api/admin/ops/overrides/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPreviewResult({
          valid: false,
          parseErrors: data.parseErrors,
          validationErrors: data.validationErrors,
          error: data.error,
        });
      } else {
        setPreviewResult({
          valid: true,
          summary: data.summary,
          inserts: data.inserts,
          updates: data.updates,
          eventIdsNotFound: data.eventIdsNotFound,
          warnings: data.warnings,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApply = async () => {
    if (!csvContent) return;

    setApplyLoading(true);
    setError(null);
    setShowConfirm(false);

    try {
      const response = await fetch("/api/admin/ops/overrides/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = await response.json();

      if (!response.ok && data.error) {
        setError(data.error);
      } else {
        setApplyResult(data);
        setPreviewResult(null); // Clear preview after apply
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplyLoading(false);
    }
  };

  const handleReset = () => {
    setCsvContent(null);
    setFileName(null);
    setPreviewResult(null);
    setApplyResult(null);
    setError(null);
    setShowConfirm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canApply =
    previewResult?.valid &&
    ((previewResult.inserts && previewResult.inserts.length > 0) ||
      (previewResult.updates && previewResult.updates.length > 0));

  const totalChanges =
    (previewResult?.inserts?.length || 0) +
    (previewResult?.updates?.length || 0);

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        Import Overrides
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Upload a CSV to create or update occurrence overrides. New overrides
        will be created; existing ones (matched by event_id + date_key) will be
        updated.
      </p>

      {/* CSV Schema Help */}
      <div className="mb-4 p-3 bg-[var(--color-bg-tertiary)] rounded text-xs text-[var(--color-text-tertiary)]">
        <p className="font-medium mb-1">CSV Headers:</p>
        <code>event_id,date_key,status,override_start_time,override_notes,override_cover_image_url</code>
        <p className="mt-2">
          <strong>event_id:</strong> UUID of the recurring event<br />
          <strong>date_key:</strong> YYYY-MM-DD format<br />
          <strong>status:</strong> &quot;normal&quot; or &quot;cancelled&quot;
        </p>
      </div>

      {/* File Input */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="text-sm text-[var(--color-text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[var(--color-bg-tertiary)] file:text-[var(--color-text-primary)] hover:file:bg-[var(--color-accent-primary)] hover:file:text-[var(--color-text-on-accent)]"
          />
          {fileName && (
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {fileName}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        {csvContent && (
          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={previewLoading}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-text-on-accent)] rounded text-[var(--color-text-primary)] font-medium disabled:opacity-50"
            >
              {previewLoading ? "Previewing..." : "Preview Changes"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-secondary)] font-medium"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Parse/Validation Errors */}
      {previewResult && !previewResult.valid && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400 font-medium mb-2">
            {previewResult.error || "Validation Failed"}
          </p>
          {previewResult.parseErrors && (
            <ul className="text-red-400 text-sm space-y-1">
              {previewResult.parseErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
          {previewResult.validationErrors && (
            <ul className="text-red-400 text-sm space-y-2 mt-2">
              {previewResult.validationErrors.map((rowErr, idx) => (
                <li key={idx}>
                  <span className="font-medium">Row {rowErr.rowIndex}:</span>{" "}
                  {rowErr.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Diff Preview */}
      {previewResult?.valid && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
            Preview Changes
          </h3>
          <OverrideDiffTable
            inserts={previewResult.inserts || []}
            updates={previewResult.updates || []}
            unchanged={previewResult.summary?.unchanged || 0}
            eventIdsNotFound={previewResult.eventIdsNotFound || []}
          />

          {/* Apply Button */}
          {canApply && !showConfirm && (
            <div className="mt-4">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-white font-medium"
              >
                Apply {totalChanges} Changes
              </button>
            </div>
          )}

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div className="mt-4 p-4 bg-amber-100 border border-amber-300 rounded">
              <p className="text-amber-800 mb-4">
                Are you sure you want to apply these changes? This will create{" "}
                {previewResult.inserts?.length || 0} new overrides and update{" "}
                {previewResult.updates?.length || 0} existing ones.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleApply}
                  disabled={applyLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white font-medium disabled:opacity-50"
                >
                  {applyLoading ? "Applying..." : "Yes, Apply Changes"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)] font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Apply Result */}
      {applyResult && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded">
          <p className="text-green-400 font-medium">
            {applyResult.success
              ? "Changes applied successfully!"
              : "Completed with errors"}
          </p>
          <p className="text-green-400 text-sm mt-2">
            Inserted: {applyResult.summary.inserted} • Updated:{" "}
            {applyResult.summary.updated} • Unchanged:{" "}
            {applyResult.summary.unchanged}
          </p>
          {applyResult.errors && applyResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-red-400 text-sm">Errors:</p>
              <ul className="text-red-400 text-sm">
                {applyResult.errors.map((err, idx) => (
                  <li key={idx}>
                    {err.key}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
