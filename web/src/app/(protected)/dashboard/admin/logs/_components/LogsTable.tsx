"use client";

import { useState, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AppLog {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: Record<string, unknown>;
  user_id: string | null;
  user_email: string | null;
  source: string | null;
  url: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Props {
  logs: AppLog[];
  sources: string[];
  isSuperAdmin: boolean;
}

const LEVEL_COLORS = {
  error: "bg-red-500/20 text-red-400 border-red-500/30",
  warn: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  debug: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const LEVEL_ICONS = {
  error: "🔴",
  warn: "🟡",
  info: "🔵",
  debug: "⚪",
};

export default function LogsTable({ logs, sources, isSuperAdmin }: Props) {
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "all" && log.level !== levelFilter) return false;
      if (sourceFilter !== "all" && log.source !== sourceFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.user_email?.toLowerCase().includes(query) ||
          log.source?.toLowerCase().includes(query) ||
          JSON.stringify(log.context).toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, levelFilter, sourceFilter, searchQuery]);

  const handleClearOldLogs = async () => {
    if (!confirm("This will delete all logs older than 30 days. Continue?")) return;

    setClearing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("cleanup_old_logs");

      if (error) {
        alert("Error clearing logs: " + error.message);
      } else {
        alert(`Cleared ${data} old log entries.`);
        window.location.reload();
      }
    } catch {
      alert("Failed to clear logs");
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatContext = (context: Record<string, unknown>) => {
    return JSON.stringify(context, null, 2);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)]">
        <div>
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">Level</label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">Source</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm"
          >
            <option value="all">All Sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-[var(--color-text-tertiary)] mb-1">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, emails, context..."
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>

        {isSuperAdmin && (
          <div className="self-end">
            <button
              onClick={handleClearOldLogs}
              disabled={clearing}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm disabled:opacity-50"
            >
              {clearing ? "Clearing..." : "Clear Old Logs"}
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-[var(--color-text-secondary)]">
        Showing {filteredLogs.length} of {logs.length} logs
      </div>

      {/* Logs list */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          No logs found matching your filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg overflow-hidden"
            >
              {/* Log header */}
              <button
                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                className="w-full p-4 text-left hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{LEVEL_ICONS[log.level]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${LEVEL_COLORS[log.level]}`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      {log.source && (
                        <span className="text-xs px-2 py-0.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded">
                          {log.source}
                        </span>
                      )}
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-primary)] text-sm line-clamp-2">
                      {log.message}
                    </p>
                    {log.user_email && (
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        User: {log.user_email}
                      </p>
                    )}
                  </div>
                  <span className="text-[var(--color-text-tertiary)]">
                    {expandedLogId === log.id ? "▼" : "▶"}
                  </span>
                </div>
              </button>

              {/* Expanded details */}
              {expandedLogId === log.id && (
                <div className="px-4 pb-4 border-t border-[var(--color-border-default)] pt-4 space-y-3">
                  <div>
                    <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
                      Full Message
                    </h4>
                    <p className="text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] p-3 rounded font-mono whitespace-pre-wrap">
                      {log.message}
                    </p>
                  </div>

                  {log.context && Object.keys(log.context).length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
                        Context
                      </h4>
                      <pre className="text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] p-3 rounded font-mono overflow-x-auto">
                        {formatContext(log.context)}
                      </pre>
                    </div>
                  )}

                  {log.url && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
                        URL
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)] font-mono break-all">
                        {log.url}
                      </p>
                    </div>
                  )}

                  {log.user_agent && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">
                        User Agent
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary)] font-mono break-all">
                        {log.user_agent}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-[var(--color-text-tertiary)]">
                    <span>Log ID: {log.id}</span>
                    {log.user_id && <span>User ID: {log.user_id}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
