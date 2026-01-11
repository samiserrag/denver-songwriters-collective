"use client";

/**
 * Override Diff Table
 *
 * Displays preview of changes that will be applied to occurrence overrides.
 * Shows both inserts (new overrides) and updates (changes to existing).
 */

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

interface Props {
  inserts: OverrideInsertPreview[];
  updates: OverrideUpdatePreview[];
  unchanged: number;
  eventIdsNotFound: string[];
}

export default function OverrideDiffTable({
  inserts,
  updates,
  unchanged,
  eventIdsNotFound,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-[var(--color-text-secondary)]">
          <span className="text-green-400 font-medium">{inserts.length}</span>{" "}
          new overrides
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-secondary)]">
          <span className="text-amber-400 font-medium">{updates.length}</span>{" "}
          updates
        </span>
        <span className="text-[var(--color-text-tertiary)]">•</span>
        <span className="text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-text-primary)]">{unchanged}</span>{" "}
          unchanged
        </span>
        {eventIdsNotFound.length > 0 && (
          <>
            <span className="text-[var(--color-text-tertiary)]">•</span>
            <span className="text-[var(--color-text-secondary)]">
              <span className="text-red-400">{eventIdsNotFound.length}</span>{" "}
              invalid event IDs
            </span>
          </>
        )}
      </div>

      {/* Inserts Table */}
      {inserts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            New Overrides to Create
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                    Event ID
                  </th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                    Date
                  </th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {inserts.map((insert) => (
                  <tr
                    key={`${insert.event_id}-${insert.date_key}`}
                    className="border-b border-[var(--color-border-subtle)]"
                  >
                    <td className="py-2 px-3 text-[var(--color-text-tertiary)] font-mono text-xs">
                      {insert.event_id.slice(0, 8)}...
                    </td>
                    <td className="py-2 px-3 text-[var(--color-text-primary)]">
                      {insert.date_key}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          insert.status === "cancelled"
                            ? "text-red-400"
                            : "text-green-400"
                        }
                      >
                        {insert.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Updates Table */}
      {updates.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Existing Overrides to Update
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">
                    Event + Date
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
                      key={`${update.event_id}-${update.date_key}-${change.field}`}
                      className="border-b border-[var(--color-border-subtle)]"
                    >
                      {idx === 0 && (
                        <td
                          rowSpan={update.changes.length}
                          className="py-2 px-3 text-[var(--color-text-primary)] align-top"
                        >
                          <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                            {update.event_id.slice(0, 8)}...
                          </span>
                          <br />
                          <span className="font-medium">{update.date_key}</span>
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
        </div>
      )}

      {/* Invalid Event IDs */}
      {eventIdsNotFound.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm font-medium mb-2">
            Event IDs not found in database ({eventIdsNotFound.length}):
          </p>
          <ul className="text-red-400 text-xs font-mono space-y-1">
            {eventIdsNotFound.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatValue(value: string | null): string {
  if (value === null) return "(empty)";
  if (value === "") return "(empty)";
  // Truncate long values
  if (value.length > 50) return value.slice(0, 47) + "...";
  return value;
}
