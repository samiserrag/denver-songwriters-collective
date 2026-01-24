"use client";

/**
 * Venue Diff Table
 *
 * Displays diff between current DB state and incoming CSV.
 */

import { VenueDiff } from "@/lib/ops/venueDiff";

interface VenueDiffTableProps {
  updates: VenueDiff[];
  notFound: string[];
  unchanged: number;
}

export default function VenueDiffTable({
  updates,
  notFound,
  unchanged,
}: VenueDiffTableProps) {
  if (updates.length === 0 && notFound.length === 0) {
    return (
      <div className="p-4 bg-green-500/10 border border-green-500/30 rounded text-green-400">
        No changes detected. All {unchanged} venues are unchanged.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-amber-800 dark:text-amber-400">{updates.length} to update</span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-tertiary)]">{unchanged} unchanged</span>
        {notFound.length > 0 && (
          <>
            <span className="text-[var(--color-text-tertiary)]">•</span>
            <span className="text-red-800 dark:text-red-400">{notFound.length} not found (will skip)</span>
          </>
        )}
      </div>

      {/* Updates Table */}
      {updates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border-default)]">
                <th className="px-3 py-2">Venue</th>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">→</th>
                <th className="px-3 py-2">New</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) =>
                update.changes.map((change, idx) => (
                  <tr
                    key={`${update.id}-${change.field}`}
                    className="border-t border-[var(--color-border-subtle)]"
                  >
                    {idx === 0 ? (
                      <td
                        className="px-3 py-2 text-[var(--color-text-primary)] font-medium"
                        rowSpan={update.changes.length}
                      >
                        {update.name}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {change.field}
                    </td>
                    <td className="px-3 py-2 text-red-400 line-through">
                      {change.oldValue || "(empty)"}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-tertiary)]">→</td>
                    <td className="px-3 py-2 text-green-400">
                      {change.newValue || "(empty)"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Not Found IDs */}
      {notFound.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400 font-medium mb-2">
            IDs not found in database (will be skipped):
          </p>
          <ul className="text-red-400 text-sm font-mono space-y-1">
            {notFound.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
