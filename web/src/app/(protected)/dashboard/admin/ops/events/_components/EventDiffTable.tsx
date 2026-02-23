"use client";

/**
 * Event Diff Table
 *
 * Displays preview of changes that will be applied to events.
 */

import { EventDiff } from "@/lib/ops/eventDiff";

interface Props {
  updates: EventDiff[];
  notFound: string[];
  unchanged: number;
}

export default function EventDiffTable({ updates, notFound, unchanged }: Props) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-[var(--color-text-secondary)]">
          <span className="text-amber-400 font-medium">{updates.length}</span> to
          update
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-text-primary)]">{unchanged}</span>{" "}
          unchanged
        </span>
        {notFound.length > 0 && (
          <>
            <span className="text-[var(--color-text-tertiary)]">•</span>
            <span className="text-[var(--color-text-secondary)]">
              <span className="text-red-800 dark:text-red-400">{notFound.length}</span> not found
            </span>
          </>
        )}
      </div>

      {/* Changes Table */}
      {updates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-default)]">
                <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                  Event
                </th>
                <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                  Field
                </th>
                <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                  Old Value
                </th>
                <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                  New Value
                </th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) =>
                update.changes.map((change, idx) => (
                  <tr
                    key={`${update.id}-${change.field}`}
                    className="border-b border-[var(--color-border-subtle)]"
                  >
                    {idx === 0 && (
                      <td
                        rowSpan={update.changes.length}
                        className="py-2 px-3 text-[var(--color-text-primary)] align-top"
                      >
                        <span className="font-medium">{update.title}</span>
                        <br />
                        <span className="text-xs text-[var(--color-text-tertiary)]">
                          {update.id.slice(0, 8)}...
                        </span>
                      </td>
                    )}
                    <td className="py-2 px-3 text-[var(--color-text-secondary)]">
                      {change.field}
                    </td>
                    <td className="py-2 px-3 text-red-400 font-mono text-xs">
                      {formatValue(change.oldValue)}
                    </td>
                    <td className="py-2 px-3 text-green-400 font-mono text-xs">
                      {formatValue(change.newValue)}
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
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm font-medium mb-2">
            Events not found in database ({notFound.length}):
          </p>
          <ul className="text-red-400 text-xs font-mono space-y-1">
            {notFound.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatValue(value: string | string[] | boolean | null): string {
  if (value === null) return "(empty)";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(", ") || "(empty)";
  if (value === "") return "(empty)";
  // Truncate long values
  if (value.length > 50) return value.slice(0, 47) + "...";
  return value;
}
