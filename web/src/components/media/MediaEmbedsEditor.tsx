"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, ChevronDown, ChevronRight, Music, Video, Link as LinkIcon } from "lucide-react";
import { parseEmbedInput, classifyUrl } from "@/lib/mediaEmbeds";

interface EmbedRow {
  id: string;
  url: string;
  error?: string;
}

interface MediaEmbedsEditorProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

let nextRowId = 0;
function makeRowId() {
  return `embed-row-${++nextRowId}`;
}

// ---------------------------------------------------------------------------
// Provider badge: shows a small pill indicating which service the URL maps to
// ---------------------------------------------------------------------------
const PROVIDER_DISPLAY: Record<string, { label: string; color: string; icon: "music" | "video" | "link" }> = {
  youtube: { label: "YouTube", color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: "video" },
  spotify: { label: "Spotify", color: "bg-green-500/15 text-green-700 dark:text-green-400", icon: "music" },
  bandcamp: { label: "Bandcamp", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400", icon: "music" },
  external: { label: "Link", color: "bg-gray-500/15 text-[var(--color-text-tertiary)]", icon: "link" },
};

function ProviderBadge({ url }: { url: string }) {
  const info = useMemo(() => {
    if (!url.trim()) return null;
    try {
      const classified = classifyUrl(url);
      if (!classified) return null;
      return PROVIDER_DISPLAY[classified.provider] ?? PROVIDER_DISPLAY.external;
    } catch {
      return null;
    }
  }, [url]);

  if (!info) return null;

  const Icon = info.icon === "video" ? Video : info.icon === "music" ? Music : LinkIcon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${info.color}`}>
      <Icon size={10} />
      {info.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sortable row with provider badge
// ---------------------------------------------------------------------------
function SortableRow({
  row,
  onUrlChange,
  onPaste,
  onRemove,
}: {
  row: EmbedRow;
  onUrlChange: (id: string, url: string) => void;
  onPaste: (id: string, e: React.ClipboardEvent<HTMLInputElement>) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="cursor-grab text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="url"
            value={row.url}
            onChange={(e) => onUrlChange(row.id, e.target.value)}
            onPaste={(e) => onPaste(row.id, e)}
            placeholder="Paste a direct media URL (YouTube watch/playlist, Spotify track/playlist, Bandcamp EmbeddedPlayer)"
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50 text-sm"
          />
          {row.url.trim() && <ProviderBadge url={row.url} />}
        </div>
        {row.error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{row.error}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        aria-label="Remove link"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline preview: client-only, non-blocking. Renders embeds using iframes.
// Failures here must NEVER affect saving.
// ---------------------------------------------------------------------------
function EmbedPreview({ urls }: { urls: string[] }) {
  const validUrls = urls.filter((u) => u.trim());
  if (validUrls.length === 0) return null;

  return (
    <div className="space-y-3 mt-2">
      {validUrls.map((url, i) => {
        try {
          const classified = classifyUrl(url);
          if (!classified) {
            return (
              <div key={i} className="text-xs text-[var(--color-text-tertiary)] px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
                External link: {url}
              </div>
            );
          }

          if (classified.provider === "youtube" && classified.embed_url) {
            return (
              <div key={i} className="rounded-lg overflow-hidden border border-[var(--color-border-default)]">
                <div className="relative w-full pt-[56.25%]">
                  <iframe
                    src={classified.embed_url}
                    title="YouTube preview"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            );
          }

          if (classified.provider === "spotify" && classified.embed_url) {
            const height = classified.kind === "audio" ? 152 : 352;
            return (
              <div key={i} className="rounded-lg overflow-hidden border border-[var(--color-border-default)]">
                <iframe
                  src={classified.embed_url}
                  title="Spotify preview"
                  loading="lazy"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="block w-full border-0"
                  height={height}
                />
              </div>
            );
          }

          if (classified.provider === "bandcamp") {
            return (
              <div key={i} className="rounded-lg overflow-hidden border border-[var(--color-border-default)]">
                <iframe
                  src={url}
                  title="Bandcamp preview"
                  loading="lazy"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="block w-full border-0"
                  height={120}
                />
              </div>
            );
          }

          return (
            <div key={i} className="text-xs text-[var(--color-text-tertiary)] px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
              External link: {url}
            </div>
          );
        } catch {
          // Preview failure must never affect saving
          return (
            <div key={i} className="text-xs text-[var(--color-text-tertiary)] px-3 py-2 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]">
              Preview unavailable
            </div>
          );
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------
export function MediaEmbedsEditor({ value, onChange }: MediaEmbedsEditorProps) {
  const [rows, setRows] = useState<EmbedRow[]>(() =>
    value.length > 0
      ? value.map((url) => ({ id: makeRowId(), url }))
      : []
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const syncToParent = useCallback(
    (newRows: EmbedRow[]) => {
      onChange(newRows.map((r) => r.url).filter((u) => u.trim()));
    },
    [onChange]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setRows((prev) => {
          const oldIndex = prev.findIndex((r) => r.id === active.id);
          const newIndex = prev.findIndex((r) => r.id === over.id);
          const reordered = arrayMove(prev, oldIndex, newIndex);
          syncToParent(reordered);
          return reordered;
        });
      }
    },
    [syncToParent]
  );

  const handleUrlChange = useCallback(
    (id: string, rawInput: string) => {
      // If input contains an iframe, extract the src immediately
      const parsed = rawInput.trim() ? parseEmbedInput(rawInput) : { url: "" };
      const resolvedUrl = "url" in parsed ? parsed.url : "";
      const error = "error" in parsed ? parsed.error : undefined;

      setRows((prev) => {
        const updated = prev.map((r) =>
          r.id === id ? { ...r, url: resolvedUrl, error } : r
        );
        syncToParent(updated);
        return updated;
      });
    },
    [syncToParent]
  );

  /**
   * Intercept paste to read raw clipboard text BEFORE the browser sanitises it.
   * `<input type="text">` prevents most stripping, but onPaste gives us the
   * untouched clipboard content (HTML iframes, shortcodes, etc.).
   */
  const handlePaste = useCallback(
    (id: string, e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text/plain");
      if (text && (text.includes("<iframe") || text.includes("[bandcamp"))) {
        e.preventDefault();
        handleUrlChange(id, text);
      }
      // For plain URLs, let default paste + onChange handle it
    },
    [handleUrlChange]
  );

  const handleRemove = useCallback(
    (id: string) => {
      setRows((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        syncToParent(updated);
        return updated;
      });
    },
    [syncToParent]
  );

  const handleAdd = useCallback(() => {
    setRows((prev) => [...prev, { id: makeRowId(), url: "" }]);
  }, []);

  const hasNonEmptyUrls = rows.some((r) => r.url.trim());

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Media Links
        </h3>
        {rows.length > 0 && (
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {rows.filter((r) => r.url.trim()).length} link{rows.filter((r) => r.url.trim()).length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Prominent instruction */}
      <p className="text-sm text-[var(--color-text-secondary)]">
        Paste links to specific videos, tracks, albums, or playlists. Artist/channel profile links belong in the Music Profiles section.
      </p>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="py-6 px-4 rounded-lg border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]/50 text-center">
          <Music size={24} className="mx-auto mb-2 text-[var(--color-text-tertiary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            No media links yet
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Click &ldquo;+ Add a media link&rdquo; below to get started.
          </p>
        </div>
      )}

      {/* Sortable rows */}
      {rows.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rows.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {rows.map((row) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  onUrlChange={handleUrlChange}
                  onPaste={handlePaste}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={handleAdd}
        className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition-colors text-sm"
      >
        + Add a media link
      </button>

      {/* Preview toggle — collapsed by default, client-only, non-blocking */}
      {hasNonEmptyUrls && (
        <div>
          <button
            type="button"
            onClick={() => setPreviewOpen((o) => !o)}
            className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            {previewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
          {previewOpen && (
            <EmbedPreview urls={rows.map((r) => r.url)} />
          )}
        </div>
      )}

      <p className="text-xs text-[var(--color-text-tertiary)]">
        YouTube, Spotify, and Bandcamp media links show as embedded players. Other links appear as buttons. Drag rows to reorder.
      </p>
    </div>
  );
}
