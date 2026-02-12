"use client";

import { useState, useCallback } from "react";
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
import { GripVertical, X } from "lucide-react";
import { parseEmbedInput } from "@/lib/mediaEmbeds";

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

function SortableRow({
  row,
  onUrlChange,
  onRemove,
}: {
  row: EmbedRow;
  onUrlChange: (id: string, url: string) => void;
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
      <div className="flex-1">
        <input
          type="url"
          value={row.url}
          onChange={(e) => onUrlChange(row.id, e.target.value)}
          placeholder="Paste a URL or embed code (YouTube, Spotify, Bandcamp…)"
          className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]/50 text-sm"
        />
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

export function MediaEmbedsEditor({ value, onChange }: MediaEmbedsEditorProps) {
  const [rows, setRows] = useState<EmbedRow[]>(() =>
    value.length > 0
      ? value.map((url) => ({ id: makeRowId(), url }))
      : []
  );

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
      const resolvedUrl = "url" in parsed ? parsed.url : rawInput;
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

  return (
    <div className="space-y-3">
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
                  onRemove={handleRemove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <button
        type="button"
        onClick={handleAdd}
        className="px-4 py-2 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] transition-colors text-sm"
      >
        + Add a new outside link
      </button>
      <p className="text-xs text-[var(--color-text-tertiary)]">
        YouTube, Spotify, and Bandcamp links show as embedded players. You can also paste an embed code. Other links appear as buttons.
      </p>
    </div>
  );
}
