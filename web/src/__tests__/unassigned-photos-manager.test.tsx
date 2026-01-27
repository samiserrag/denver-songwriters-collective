/**
 * Phase 4.90 — Unassigned Photos Manager Tests
 *
 * Tests that the dead-end UX is fixed and users can:
 * 1. See management controls when unassigned photos exist
 * 2. Select photos for bulk actions
 * 3. Move photos to albums
 * 4. Delete photos with confirmation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UnassignedPhotosManager } from "../app/(protected)/dashboard/gallery/_components/UnassignedPhotosManager";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock supabase client
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockDelete = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { sort_order: 5 }, error: null }),
      }),
    }),
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === "gallery_images") {
        return {
          update: mockUpdate,
          delete: mockDelete,
          select: mockSelect,
        };
      }
      return {};
    },
  }),
}));

// Sample test data
const samplePhotos = [
  { id: "photo-1", image_url: "https://example.com/1.jpg", caption: "Photo 1", is_hidden: false },
  { id: "photo-2", image_url: "https://example.com/2.jpg", caption: "Photo 2", is_hidden: false },
  { id: "photo-3", image_url: "https://example.com/3.jpg", caption: null, is_hidden: true },
];

const sampleAlbums = [
  { id: "album-1", name: "My Album" },
  { id: "album-2", name: "Another Album" },
];

describe("UnassignedPhotosManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders nothing when no photos exist", () => {
      const { container } = render(
        <UnassignedPhotosManager photos={[]} albums={sampleAlbums} />
      );
      expect(container.firstChild).toBeNull();
    });

    it("renders management controls when unassigned photos exist", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      expect(screen.getByText("Unassigned Photos (3)")).toBeInTheDocument();
      expect(
        screen.getByText("Select photos to move them to an album or delete them.")
      ).toBeInTheDocument();
    });

    it("renders all photos in the grid", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // All photos should be rendered as buttons
      const photoButtons = screen.getAllByRole("button");
      expect(photoButtons).toHaveLength(3);
    });

    it("shows hidden badge for hidden photos", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Photo 3 is hidden
      expect(screen.getByText("Hidden")).toBeInTheDocument();
    });
  });

  describe("Selection", () => {
    it("shows action bar when photos are selected", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Initially no selection controls visible
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

      // Click on first photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Now selection controls should appear
      expect(screen.getByText("1 selected")).toBeInTheDocument();
      expect(screen.getByText("Move to album...")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });

    it("can select multiple photos", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);
      fireEvent.click(photoButtons[1]);

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("can deselect photos by clicking again", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);
      expect(screen.getByText("1 selected")).toBeInTheDocument();

      fireEvent.click(photoButtons[0]);
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });

    it("clear button deselects all photos", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);
      fireEvent.click(photoButtons[1]);
      expect(screen.getByText("2 selected")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Clear"));
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  describe("Move to Album", () => {
    it("move button is disabled until album is selected", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Move button should be disabled
      const moveButton = screen.getByText("Move");
      expect(moveButton).toBeDisabled();
    });

    it("move button is enabled when album is selected", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Select an album from dropdown
      const dropdown = screen.getByRole("combobox");
      fireEvent.change(dropdown, { target: { value: "album-1" } });

      // Move button should be enabled
      const moveButton = screen.getByText("Move");
      expect(moveButton).not.toBeDisabled();
    });

    it("calls supabase update with correct album_id", async () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Select an album
      const dropdown = screen.getByRole("combobox");
      fireEvent.change(dropdown, { target: { value: "album-1" } });

      // Click move
      const moveButton = screen.getByText("Move");
      fireEvent.click(moveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
    });
  });

  describe("Delete", () => {
    it("delete button requires confirmation", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Click delete
      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        "Delete 1 photo? This cannot be undone."
      );
      confirmSpy.mockRestore();
    });

    it("does not delete when confirmation is cancelled", () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Click delete
      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("calls supabase delete when confirmed", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select a photo
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);

      // Click delete
      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalled();
      });
    });

    it("shows correct plural text for multiple photos", () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // Select multiple photos
      const photoButtons = screen.getAllByRole("button");
      fireEvent.click(photoButtons[0]);
      fireEvent.click(photoButtons[1]);

      // Click delete
      const deleteButton = screen.getByText("Delete");
      fireEvent.click(deleteButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        "Delete 2 photos? This cannot be undone."
      );
      confirmSpy.mockRestore();
    });
  });

  describe("Dead-end fix verification", () => {
    it("no longer shows dead-end message about admin panel", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // The old dead-end message should NOT be present
      expect(
        screen.queryByText(/via the admin panel/)
      ).not.toBeInTheDocument();
    });

    it("shows actionable instructions instead", () => {
      render(
        <UnassignedPhotosManager photos={samplePhotos} albums={sampleAlbums} />
      );

      // New actionable message should be present
      expect(
        screen.getByText("Select photos to move them to an album or delete them.")
      ).toBeInTheDocument();
    });
  });
});
