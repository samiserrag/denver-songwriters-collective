"use client";

/**
 * Venue Import Card
 *
 * File input for CSV upload, preview diff, and apply changes.
 */

import { useState, useRef } from "react";
import VenueDiffTable from "./VenueDiffTable";
import { VenueDiff } from "@/lib/ops/venueDiff";

interface PreviewResult {
  valid: boolean;
  diff?: {
    updates: VenueDiff[];
    notFound: string[];
    unchanged: number;
  };
  summary?: {
    totalRows: number;
    willUpdate: number;
    willSkip: number;
    unchanged: number;
  };
  parseErrors?: string[];
  rowErrors?: { row: number; errors: string[]; warnings: string[] }[];
}

interface ApplyResult {
  applied: number;
  skipped: number;
  unchanged: number;
  message: string;
  errors?: { id: string; error: string }[];
}

export default function VenueImportCard() {
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
      const response = await fetch("/api/admin/ops/venues/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPreviewResult({
          valid: false,
          parseErrors: data.parseErrors,
          rowErrors: data.rowErrors,
        });
      } else {
        setPreviewResult(data);
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
      const response = await fetch("/api/admin/ops/venues/apply", {
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
    previewResult.diff &&
    previewResult.diff.updates.length > 0;

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        Import Venues
      </h2>
      <p className="text-[var(--color-text-secondary)] text-sm mb-4">
        Upload an edited CSV to preview and apply changes. Only existing venues
        will be updated (no new venues created).
      </p>

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
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded">
          <p className="text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Parse/Validation Errors */}
      {previewResult && !previewResult.valid && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-500/10 border border-red-300 dark:border-red-500/30 rounded">
          <p className="text-red-800 dark:text-red-400 font-medium mb-2">Validation Failed</p>
          {previewResult.parseErrors && (
            <ul className="text-red-800 dark:text-red-400 text-sm space-y-1">
              {previewResult.parseErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          )}
          {previewResult.rowErrors && (
            <ul className="text-red-800 dark:text-red-400 text-sm space-y-2 mt-2">
              {previewResult.rowErrors.map((rowErr, idx) => (
                <li key={idx}>
                  <span className="font-medium">Row {rowErr.row}:</span>{" "}
                  {rowErr.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Diff Preview */}
      {previewResult?.valid && previewResult.diff && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
            Preview Changes
          </h3>
          <VenueDiffTable
            updates={previewResult.diff.updates}
            notFound={previewResult.diff.notFound}
            unchanged={previewResult.diff.unchanged}
          />

          {/* Apply Button */}
          {canApply && !showConfirm && (
            <div className="mt-4">
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-white font-medium"
              >
                Apply {previewResult.diff.updates.length} Updates
              </button>
            </div>
          )}

          {/* Confirmation Dialog */}
          {showConfirm && (
            <div className="mt-4 p-4 bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded">
              <p className="text-amber-800 dark:text-amber-300 mb-4">
                Are you sure you want to apply these changes? This cannot be
                undone.
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
          <p className="text-green-400 font-medium">{applyResult.message}</p>
          <p className="text-green-400 text-sm mt-2">
            Applied: {applyResult.applied} • Skipped: {applyResult.skipped} •
            Unchanged: {applyResult.unchanged}
          </p>
          {applyResult.errors && applyResult.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-red-800 dark:text-red-400 text-sm">Errors:</p>
              <ul className="text-red-800 dark:text-red-400 text-sm">
                {applyResult.errors.map((err, idx) => (
                  <li key={idx}>
                    {err.id}: {err.error}
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
