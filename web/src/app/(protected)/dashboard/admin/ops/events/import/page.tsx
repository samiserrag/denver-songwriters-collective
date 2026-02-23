"use client";

/**
 * Happenings Import Page
 *
 * Admin UI for bulk importing events via CSV.
 * Flow: Upload CSV → Preview → Confirm → Apply
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { generateImportTemplate, IMPORT_CSV_HEADERS } from "@/lib/ops/eventImportParser";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewResponse {
  success: boolean;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicates: number;
  };
  validRows: Array<{
    row: number;
    title: string;
    event_type: string;
    event_date: string;
    day_of_week: string | null;
    recurrence_rule: string | null;
    venue_id: string | null;
    venue_name: string | null;
    pre_verified: boolean;
  }>;
  invalidRows: Array<{
    row: number;
    errors: string[];
  }>;
  duplicates: Array<{
    row: number;
    reason: string;
    matched_id: string;
    matched_slug?: string;
    matched_title?: string;
  }>;
  venueWarnings: Array<{
    row: number;
    warning: string;
  }>;
  parseErrors?: string[];
}

interface ApplyResponse {
  success: boolean;
  summary: {
    inserted: number;
    skipped_dedupe: number;
    skipped_validation: number;
    errors: number;
  };
  inserted: Array<{
    row: number;
    id: string;
    title: string;
  }>;
  skipped: Array<{
    row: number;
    reason: string;
  }>;
  errors: Array<{
    row: number;
    error: string;
  }>;
  venueWarnings: Array<{
    row: number;
    warning: string;
  }>;
}

type Step = "upload" | "preview" | "applying" | "results";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EventImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [applyData, setApplyData] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Expanded sections state
  const [showValid, setShowValid] = useState(false);
  const [showInvalid, setShowInvalid] = useState(true);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);

  // Handle file upload
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content);
        setFileName(file.name);
        setError("");
      };
      reader.onerror = () => {
        setError("Failed to read file");
      };
      reader.readAsText(file);
    },
    []
  );

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!csvContent) {
      setError("Please upload a CSV file first");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/ops/events/import-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data: PreviewResponse = await response.json();

      if (!response.ok) {
        if (data.parseErrors?.length) {
          setError(`Parse errors: ${data.parseErrors.join(", ")}`);
        } else {
          setError("Failed to preview import");
        }
        setPreviewData(data);
        setStep("preview");
      } else {
        setPreviewData(data);
        setStep("preview");
      }
    } catch {
      setError("Network error - please try again");
    } finally {
      setIsLoading(false);
    }
  }, [csvContent]);

  // Handle apply
  const handleApply = useCallback(async () => {
    if (!confirmed) {
      setError("Please confirm the checkbox before importing");
      return;
    }

    setIsLoading(true);
    setError("");
    setStep("applying");

    try {
      const response = await fetch("/api/admin/ops/events/import-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvContent }),
      });

      const data: ApplyResponse = await response.json();

      if (!response.ok) {
        setError("Import failed - see results below");
      }

      setApplyData(data);
      setStep("results");
    } catch {
      setError("Network error - please try again");
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  }, [csvContent, confirmed]);

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    const template = generateImportTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "event-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Download results as JSON
  const handleDownloadResults = useCallback(() => {
    if (!applyData) return;
    const blob = new Blob([JSON.stringify(applyData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-results-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [applyData]);

  // Reset to start
  const handleReset = useCallback(() => {
    setStep("upload");
    setCsvContent("");
    setFileName("");
    setPreviewData(null);
    setApplyData(null);
    setError("");
    setConfirmed(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Happenings Import (CSV v1)</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Bulk import events from CSV. INSERT-only (no updates to existing events).
          </p>
        </div>
        <Link
          href="/dashboard/admin/ops/events"
          className="text-[var(--color-accent)] hover:underline"
        >
          ← Back to Ops Console
        </Link>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="card-spotlight p-6 space-y-6">
          <h2 className="text-lg font-semibold">Step 1: Upload CSV</h2>

          <div className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer block space-y-2"
            >
              <div className="text-4xl">📄</div>
              <div className="text-[var(--color-text-secondary)]">
                {fileName ? (
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {fileName}
                  </span>
                ) : (
                  "Drag & drop CSV file here, or click to upload"
                )}
              </div>
            </label>
          </div>

          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)]"
          >
            Download Template CSV
          </button>

          {/* Column reference (self-contained collapsible) */}
          <ColumnReference />

          <button
            onClick={handlePreview}
            disabled={!csvContent || isLoading}
            className="w-full py-3 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Preview Import"}
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && previewData && (
        <div className="space-y-6">
          <div className="card-spotlight p-6">
            <h2 className="text-lg font-semibold mb-4">Step 2: Preview</h2>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Ready to Import"
                value={previewData.summary.validRows}
                variant="success"
              />
              <SummaryCard
                label="Validation Errors"
                value={previewData.summary.invalidRows}
                variant={previewData.summary.invalidRows > 0 ? "error" : "neutral"}
              />
              <SummaryCard
                label="Duplicates (Skip)"
                value={previewData.summary.duplicates}
                variant={previewData.summary.duplicates > 0 ? "warning" : "neutral"}
              />
              <SummaryCard
                label="Total Rows"
                value={previewData.summary.totalRows}
                variant="neutral"
              />
            </div>

            {/* Valid Rows */}
            {previewData.validRows.length > 0 && (
              <ExpandableSection
                title={`Valid Rows (${previewData.validRows.length})`}
                expanded={showValid}
                onToggle={() => setShowValid(!showValid)}
                variant="success"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left py-2 px-2">Row</th>
                        <th className="text-left py-2 px-2">Title</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Day</th>
                        <th className="text-left py-2 px-2">Recurrence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.validRows.map((row) => (
                        <tr
                          key={row.row}
                          className="border-b border-[var(--color-border)]/50"
                        >
                          <td className="py-2 px-2">{row.row}</td>
                          <td className="py-2 px-2 font-medium">{row.title}</td>
                          <td className="py-2 px-2">{row.event_type}</td>
                          <td className="py-2 px-2">{row.event_date}</td>
                          <td className="py-2 px-2">{row.day_of_week || "-"}</td>
                          <td className="py-2 px-2">{row.recurrence_rule || "one-time"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExpandableSection>
            )}

            {/* Invalid Rows */}
            {previewData.invalidRows.length > 0 && (
              <ExpandableSection
                title={`Validation Errors (${previewData.invalidRows.length})`}
                expanded={showInvalid}
                onToggle={() => setShowInvalid(!showInvalid)}
                variant="error"
              >
                <ul className="space-y-2">
                  {previewData.invalidRows.map((row) => (
                    <li key={row.row} className="text-sm">
                      <span className="font-medium">Row {row.row}:</span>{" "}
                      {row.errors.join("; ")}
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            )}

            {/* Duplicates */}
            {previewData.duplicates.length > 0 && (
              <ExpandableSection
                title={`Duplicates - Will Skip (${previewData.duplicates.length})`}
                expanded={showDuplicates}
                onToggle={() => setShowDuplicates(!showDuplicates)}
                variant="warning"
              >
                <ul className="space-y-2">
                  {previewData.duplicates.map((dup) => (
                    <li key={dup.row} className="text-sm">
                      <span className="font-medium">Row {dup.row}:</span>{" "}
                      {dup.reason === "slug_collision"
                        ? `Slug collision with "${dup.matched_title || dup.matched_slug}"`
                        : `Matches existing event: "${dup.matched_title}"`}
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            )}

            {/* Venue Warnings */}
            {previewData.venueWarnings.length > 0 && (
              <ExpandableSection
                title={`Venue Warnings (${previewData.venueWarnings.length})`}
                expanded={showWarnings}
                onToggle={() => setShowWarnings(!showWarnings)}
                variant="warning"
              >
                <ul className="space-y-2">
                  {previewData.venueWarnings.map((warn, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">Row {warn.row}:</span>{" "}
                      {warn.warning}
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            )}
          </div>

          {/* Confirmation */}
          {previewData.summary.validRows > 0 && (
            <div className="card-spotlight p-6">
              <h2 className="text-lg font-semibold mb-4">Step 3: Confirm Import</h2>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm">
                  I understand that imported events will appear on /happenings
                  with &quot;Unconfirmed&quot; badges until manually verified by an admin.
                </span>
              </label>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={!confirmed || isLoading}
                  className="flex-1 py-3 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] rounded font-medium disabled:opacity-50"
                >
                  {isLoading
                    ? "Importing..."
                    : `Import ${previewData.summary.validRows} Events`}
                </button>
              </div>
            </div>
          )}

          {previewData.summary.validRows === 0 && (
            <div className="card-spotlight p-6">
              <p className="text-[var(--color-text-secondary)]">
                No valid rows to import. Please fix the errors above and try again.
              </p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)]"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Applying */}
      {step === "applying" && (
        <div className="card-spotlight p-6 text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-lg font-semibold">Importing Events...</h2>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Please wait while events are being created.
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === "results" && applyData && (
        <div className="space-y-6">
          <div className="card-spotlight p-6">
            <h2 className="text-lg font-semibold mb-4">Step 4: Results</h2>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Inserted"
                value={applyData.summary.inserted}
                variant="success"
              />
              <SummaryCard
                label="Skipped (Dedupe)"
                value={applyData.summary.skipped_dedupe}
                variant={applyData.summary.skipped_dedupe > 0 ? "warning" : "neutral"}
              />
              <SummaryCard
                label="Skipped (Validation)"
                value={applyData.summary.skipped_validation}
                variant={applyData.summary.skipped_validation > 0 ? "error" : "neutral"}
              />
              <SummaryCard
                label="Errors"
                value={applyData.summary.errors}
                variant={applyData.summary.errors > 0 ? "error" : "neutral"}
              />
            </div>

            {applyData.summary.inserted > 0 && (
              <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 px-4 py-3 rounded mb-4">
                Successfully imported {applyData.summary.inserted} events!
              </div>
            )}

            {/* Inserted Events */}
            {applyData.inserted.length > 0 && (
              <ExpandableSection
                title={`Inserted Events (${applyData.inserted.length})`}
                expanded={true}
                onToggle={() => {}}
                variant="success"
              >
                <ul className="space-y-1 text-sm">
                  {applyData.inserted.map((item) => (
                    <li key={item.id}>
                      Row {item.row}: <span className="font-medium">{item.title}</span>{" "}
                      <span className="text-[var(--color-text-secondary)]">
                        (ID: {item.id.substring(0, 8)}...)
                      </span>
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            )}

            {/* Errors */}
            {applyData.errors.length > 0 && (
              <ExpandableSection
                title={`Insert Errors (${applyData.errors.length})`}
                expanded={true}
                onToggle={() => {}}
                variant="error"
              >
                <ul className="space-y-1 text-sm">
                  {applyData.errors.map((err) => (
                    <li key={err.row}>
                      Row {err.row}: {err.error}
                    </li>
                  ))}
                </ul>
              </ExpandableSection>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Link
              href="/dashboard/admin/events"
              className="px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-on-accent)] rounded font-medium"
            >
              View in Admin Happenings List
            </Link>
            <button
              onClick={handleDownloadResults}
              className="px-6 py-3 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)]"
            >
              Download Import Report
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)]"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "error" | "warning" | "neutral";
}) {
  const bgColors = {
    success: "bg-green-100 dark:bg-green-900/30",
    error: "bg-red-100 dark:bg-red-900/30",
    warning: "bg-amber-100 dark:bg-amber-900/30",
    neutral: "bg-[var(--color-bg-secondary)]",
  };

  const textColors = {
    success: "text-green-800 dark:text-green-300",
    error: "text-red-800 dark:text-red-300",
    warning: "text-amber-800 dark:text-amber-300",
    neutral: "text-[var(--color-text-primary)]",
  };

  return (
    <div className={`${bgColors[variant]} rounded p-4`}>
      <div className={`text-2xl font-bold ${textColors[variant]}`}>{value}</div>
      <div className="text-sm text-[var(--color-text-secondary)]">{label}</div>
    </div>
  );
}

function ExpandableSection({
  title,
  children,
  expanded,
  onToggle,
  variant,
}: {
  title: string;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  variant: "success" | "error" | "warning";
}) {
  const borderColors = {
    success: "border-green-300 dark:border-green-700",
    error: "border-red-300 dark:border-red-700",
    warning: "border-amber-300 dark:border-amber-700",
  };

  return (
    <div className={`border ${borderColors[variant]} rounded mt-4`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)]"
      >
        <span className="font-medium">{title}</span>
        <span>{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && <div className="px-4 py-3 border-t border-[var(--color-border)]">{children}</div>}
    </div>
  );
}

function ColumnReference() {
  const [show, setShow] = useState(false);

  return (
    <div className="border border-[var(--color-border)] rounded">
      <button
        onClick={() => setShow(!show)}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-secondary)]"
      >
        <span className="font-medium">Column Reference</span>
        <span>{show ? "▼" : "▶"}</span>
      </button>
      {show && (
        <div className="px-4 py-3 border-t border-[var(--color-border)] text-sm space-y-2">
          <p className="font-medium">Required columns:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li><code>title</code> - Event title</li>
            <li><code>event_type</code> - open_mic, showcase, song_circle, workshop, gig, jam_session, meetup, other</li>
            <li><code>event_date</code> - Anchor date (YYYY-MM-DD)</li>
          </ul>
          <p className="font-medium mt-3">Optional columns:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li><code>start_time</code> - HH:MM (24-hour)</li>
            <li><code>end_time</code> - HH:MM (24-hour)</li>
            <li><code>venue_id</code> - UUID of existing venue</li>
            <li><code>venue_name</code> - Venue name (for lookup)</li>
            <li><code>day_of_week</code> - Sunday, Monday, ... Saturday</li>
            <li><code>recurrence_rule</code> - weekly, biweekly, 1st, 2nd, 3rd, 4th, last, 1st/3rd, 2nd/4th</li>
            <li><code>description</code> - Event description</li>
            <li><code>external_url</code> - External event link</li>
            <li><code>categories</code> - Pipe-delimited: music|comedy</li>
            <li><code>is_free</code> - true/false</li>
            <li><code>cost_label</code> - e.g., &quot;$5 suggested&quot;</li>
            <li><code>age_policy</code> - all_ages, 18+, 21+</li>
            <li><code>pre_verified</code> - true to mark as verified on import</li>
          </ul>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Header order: {IMPORT_CSV_HEADERS.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
