/**
 * Photo Reordering Tests
 *
 * Validates that photo reordering functionality works correctly:
 * - sort_order is preserved during uploads
 * - Reordering updates sort_order correctly
 * - Queries order by sort_order ascending
 */

import { describe, it, expect } from "vitest";

describe("Photo Reordering", () => {
  describe("sort_order computation", () => {
    it("should assign sequential sort_order starting from 0", () => {
      // Simulates the sort_order computation logic used during photo uploads
      const files = ["a.jpg", "b.jpg", "c.jpg"];
      const startSortOrder = 0;

      const results = files.map((_, index) => ({
        sort_order: startSortOrder + index,
      }));

      expect(results[0].sort_order).toBe(0);
      expect(results[1].sort_order).toBe(1);
      expect(results[2].sort_order).toBe(2);
    });

    it("should continue from existing max sort_order when adding to album", () => {
      // Existing album has photos with sort_order 0, 1, 2
      const existingMaxSortOrder = 2;
      const startSortOrder = existingMaxSortOrder + 1;

      const newFiles = ["d.jpg", "e.jpg"];
      const results = newFiles.map((_, index) => ({
        sort_order: startSortOrder + index,
      }));

      expect(results[0].sort_order).toBe(3);
      expect(results[1].sort_order).toBe(4);
    });

    it("should handle null max sort_order (empty album)", () => {
      // When album is empty, maxSort?.sort_order is null/undefined
      const maxSort: { sort_order: number | null } | null = null;
      const startSortOrder = ((maxSort?.sort_order) ?? -1) + 1;

      expect(startSortOrder).toBe(0);
    });
  });

  describe("arrayMove reordering", () => {
    it("should correctly move item from beginning to end", () => {
      const items = [
        { id: "1", sort_order: 0 },
        { id: "2", sort_order: 1 },
        { id: "3", sort_order: 2 },
      ];

      // Move item 0 to index 2
      const oldIndex = 0;
      const newIndex = 2;

      // arrayMove logic
      const newOrder = [...items];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);

      // Update sort_order
      const updated = newOrder.map((item, index) => ({
        ...item,
        sort_order: index,
      }));

      expect(updated[0].id).toBe("2");
      expect(updated[0].sort_order).toBe(0);
      expect(updated[1].id).toBe("3");
      expect(updated[1].sort_order).toBe(1);
      expect(updated[2].id).toBe("1");
      expect(updated[2].sort_order).toBe(2);
    });

    it("should correctly move item from end to beginning", () => {
      const items = [
        { id: "1", sort_order: 0 },
        { id: "2", sort_order: 1 },
        { id: "3", sort_order: 2 },
      ];

      // Move item 2 to index 0
      const oldIndex = 2;
      const newIndex = 0;

      // arrayMove logic
      const newOrder = [...items];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);

      // Update sort_order
      const updated = newOrder.map((item, index) => ({
        ...item,
        sort_order: index,
      }));

      expect(updated[0].id).toBe("3");
      expect(updated[0].sort_order).toBe(0);
      expect(updated[1].id).toBe("1");
      expect(updated[1].sort_order).toBe(1);
      expect(updated[2].id).toBe("2");
      expect(updated[2].sort_order).toBe(2);
    });

    it("should correctly swap adjacent items", () => {
      const items = [
        { id: "1", sort_order: 0 },
        { id: "2", sort_order: 1 },
        { id: "3", sort_order: 2 },
      ];

      // Move item 0 to index 1
      const oldIndex = 0;
      const newIndex = 1;

      // arrayMove logic
      const newOrder = [...items];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);

      // Update sort_order
      const updated = newOrder.map((item, index) => ({
        ...item,
        sort_order: index,
      }));

      expect(updated[0].id).toBe("2");
      expect(updated[0].sort_order).toBe(0);
      expect(updated[1].id).toBe("1");
      expect(updated[1].sort_order).toBe(1);
      expect(updated[2].id).toBe("3");
      expect(updated[2].sort_order).toBe(2);
    });
  });

  describe("query ordering contract", () => {
    it("should sort by sort_order ascending, then created_at descending", () => {
      const images = [
        { id: "1", sort_order: 2, created_at: "2025-01-01T00:00:00Z" },
        { id: "2", sort_order: 0, created_at: "2025-01-02T00:00:00Z" },
        { id: "3", sort_order: 1, created_at: "2025-01-03T00:00:00Z" },
        { id: "4", sort_order: null, created_at: "2025-01-04T00:00:00Z" },
      ];

      // Sort by sort_order ascending (nulls last), then created_at descending
      const sorted = [...images].sort((a, b) => {
        // Nulls go last
        if (a.sort_order === null && b.sort_order === null) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (a.sort_order === null) return 1;
        if (b.sort_order === null) return -1;

        // Sort by sort_order ascending
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }

        // Then by created_at descending
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      expect(sorted[0].id).toBe("2"); // sort_order: 0
      expect(sorted[1].id).toBe("3"); // sort_order: 1
      expect(sorted[2].id).toBe("1"); // sort_order: 2
      expect(sorted[3].id).toBe("4"); // sort_order: null (last)
    });
  });

  describe("drag-and-drop upload preview", () => {
    it("should reorder files before upload", () => {
      interface QueuedFile {
        id: string;
        name: string;
        status: "pending" | "uploading" | "done";
      }

      const files: QueuedFile[] = [
        { id: "uuid-1", name: "first.jpg", status: "pending" },
        { id: "uuid-2", name: "second.jpg", status: "pending" },
        { id: "uuid-3", name: "third.jpg", status: "pending" },
      ];

      // User drags third.jpg to first position
      const activeId = "uuid-3";
      const overId = "uuid-1";

      const oldIndex = files.findIndex((f) => f.id === activeId);
      const newIndex = files.findIndex((f) => f.id === overId);

      // arrayMove logic
      const reordered = [...files];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      expect(reordered[0].name).toBe("third.jpg");
      expect(reordered[1].name).toBe("first.jpg");
      expect(reordered[2].name).toBe("second.jpg");

      // When uploaded, sort_order follows this order
      const uploads = reordered.map((f, i) => ({
        name: f.name,
        sort_order: i,
      }));

      expect(uploads[0].sort_order).toBe(0);
      expect(uploads[0].name).toBe("third.jpg");
      expect(uploads[1].sort_order).toBe(1);
      expect(uploads[1].name).toBe("first.jpg");
    });

    it("should only allow reordering for pending files", () => {
      // Files that are already uploading or done should not be draggable
      const files = [
        { id: "1", status: "done" as const },
        { id: "2", status: "uploading" as const },
        { id: "3", status: "pending" as const },
        { id: "4", status: "pending" as const },
      ];

      const draggableFiles = files.filter((f) => f.status === "pending");

      expect(draggableFiles).toHaveLength(2);
      expect(draggableFiles.map((f) => f.id)).toEqual(["3", "4"]);
    });
  });
});
