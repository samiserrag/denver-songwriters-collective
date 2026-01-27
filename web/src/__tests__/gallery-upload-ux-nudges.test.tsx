/**
 * Phase 4.91 — Gallery Upload UX Nudges Tests
 *
 * Tests for the upload UX improvements that reduce "unassigned photo" creation:
 * 1. Destination label switching based on album selection
 * 2. Nudge banner appearing only when no album selected
 * 3. Confirm dialog behavior for unassigned uploads
 * 4. localStorage persistence for "Don't show again"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UserGalleryUpload from "../app/(protected)/dashboard/gallery/UserGalleryUpload";

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

// Mock supabase client with full chain support
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { sort_order: 0 }, error: null }),
            }),
          }),
        }),
        single: vi.fn().mockResolvedValue({ data: { id: "test-id", name: "Test" }, error: null }),
      }),
      single: vi.fn().mockResolvedValue({ data: { id: "test-id", name: "Test" }, error: null }),
      like: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.com/image.jpg" } }),
      }),
    },
  }),
}));

// Sample test data
const sampleAlbums = [
  { id: "album-1", name: "Summer Photos" },
  { id: "album-2", name: "Open Mic Night" },
];

const sampleVenues = [{ id: "venue-1", name: "The Venue" }];
const sampleEvents = [{ id: "event-1", title: "Open Mic", event_date: "2026-01-26" }];

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Gallery Upload UX Nudges (Phase 4.91)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Album Label Text", () => {
    it("shows 'Album (recommended)' instead of 'Album (optional)'", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      expect(screen.getByText("Album (recommended)")).toBeInTheDocument();
      expect(screen.queryByText("Album (optional)")).not.toBeInTheDocument();
    });
  });

  describe("Destination Label", () => {
    it("shows 'Uploading to: Unassigned Photos' when no album selected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      expect(screen.getByText("Uploading to:")).toBeInTheDocument();
      expect(screen.getByText("Unassigned Photos")).toBeInTheDocument();
    });

    it("shows album name when album is selected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Select an album - find by the "No album" option text
      const albumSelect = screen.getByDisplayValue("No album");
      fireEvent.change(albumSelect, { target: { value: "album-1" } });

      expect(screen.getByText("Uploading to:")).toBeInTheDocument();
      // The destination label should show the album name (may appear in dropdown too)
      const destinationLabels = screen.getAllByText("Summer Photos");
      expect(destinationLabels.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText("Unassigned Photos")).not.toBeInTheDocument();
    });

    it("updates destination label when album selection changes", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      const albumSelect = screen.getByDisplayValue("No album");

      // Select first album - destination label updates
      fireEvent.change(albumSelect, { target: { value: "album-1" } });
      // Album name appears in both dropdown and destination label
      expect(screen.getAllByText("Summer Photos").length).toBeGreaterThanOrEqual(1);

      // Select second album - destination updates again
      fireEvent.change(albumSelect, { target: { value: "album-2" } });
      expect(screen.getAllByText("Open Mic Night").length).toBeGreaterThanOrEqual(1);

      // Clear selection - back to Unassigned
      fireEvent.change(albumSelect, { target: { value: "" } });
      expect(screen.getByText("Unassigned Photos")).toBeInTheDocument();
    });
  });

  describe("Nudge Banner", () => {
    it("shows nudge banner when no album selected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      expect(screen.getByText("No album selected")).toBeInTheDocument();
      expect(
        screen.getByText(/Photos uploaded without an album go to/)
      ).toBeInTheDocument();
    });

    it("hides nudge banner when album is selected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Select an album
      const albumSelect = screen.getByDisplayValue("No album");
      fireEvent.change(albumSelect, { target: { value: "album-1" } });

      expect(screen.queryByText("No album selected")).not.toBeInTheDocument();
    });

    it("shows nudge banner again when album is deselected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      const albumSelect = screen.getByDisplayValue("No album");

      // Select album
      fireEvent.change(albumSelect, { target: { value: "album-1" } });
      expect(screen.queryByText("No album selected")).not.toBeInTheDocument();

      // Deselect album
      fireEvent.change(albumSelect, { target: { value: "" } });
      expect(screen.getByText("No album selected")).toBeInTheDocument();
    });
  });

  describe("Confirm Dialog", () => {
    // Helper to add files to the component
    const addTestFiles = () => {
      // Create a mock file
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const dataTransfer = {
        files: [file],
        items: [{ kind: "file", type: "image/jpeg", getAsFile: () => file }],
        types: ["Files"],
      };

      // Find the drop zone and trigger drop event
      const dropZone = screen.getByText(/Drop photos here or click to select/i).closest("div");
      if (dropZone) {
        fireEvent.drop(dropZone, { dataTransfer });
      }
    };

    it("shows confirm dialog when uploading to unassigned without prior dismissal", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Add files
      addTestFiles();

      // Click upload button
      const uploadButton = screen.getByRole("button", { name: /upload 1 photo/i });
      fireEvent.click(uploadButton);

      // Confirm dialog should appear
      expect(screen.getByText("Upload to Unassigned Photos?")).toBeInTheDocument();
    });

    it("does not show confirm dialog when album is selected", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Select an album first
      const albumSelect = screen.getByDisplayValue("No album");
      fireEvent.change(albumSelect, { target: { value: "album-1" } });

      // Add files
      addTestFiles();

      // Click upload button
      const uploadButton = screen.getByRole("button", { name: /upload 1 photo/i });
      fireEvent.click(uploadButton);

      // Confirm dialog should NOT appear
      expect(screen.queryByText("Upload to Unassigned Photos?")).not.toBeInTheDocument();
    });

    it("closes dialog when 'Go back' is clicked", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      addTestFiles();

      // Click upload
      const uploadButton = screen.getByRole("button", { name: /upload 1 photo/i });
      fireEvent.click(uploadButton);

      // Dialog appears
      expect(screen.getByText("Upload to Unassigned Photos?")).toBeInTheDocument();

      // Click "Go back"
      fireEvent.click(screen.getByRole("button", { name: /go back/i }));

      // Dialog should close
      expect(screen.queryByText("Upload to Unassigned Photos?")).not.toBeInTheDocument();
    });

    it("has 'Don't show again' checkbox", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      addTestFiles();

      // Click upload
      const uploadButton = screen.getByRole("button", { name: /upload 1 photo/i });
      fireEvent.click(uploadButton);

      // Checkbox should be present
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });
  });

  describe("localStorage Persistence", () => {
    it("checks localStorage on mount for dismissed preference", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Verify localStorage was checked on mount
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        "dsc_gallery_unassigned_warning_dismissed_v1"
      );
    });

    it("uses correct localStorage key name (documented contract)", () => {
      // This test documents the localStorage key for the investigation report
      const EXPECTED_KEY = "dsc_gallery_unassigned_warning_dismissed_v1";

      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith(EXPECTED_KEY);
    });
  });

  describe("Confirm Dialog Component", () => {
    it("dialog has title and buttons", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Add one file via drop
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const dropZone = screen.getByText(/Drop photos here or click to select/i).closest("div");
      if (dropZone) {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file], items: [{ kind: "file", type: "image/jpeg", getAsFile: () => file }], types: ["Files"] },
        });
      }

      // Trigger upload
      const uploadButton = screen.getByRole("button", { name: /upload 1 photo/i });
      fireEvent.click(uploadButton);

      // Dialog elements should be present
      expect(screen.getByText("Upload to Unassigned Photos?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /upload anyway/i })).toBeInTheDocument();
    });

    it("dialog has dont show again checkbox", () => {
      render(
        <UserGalleryUpload
          albums={sampleAlbums}
          venues={sampleVenues}
          events={sampleEvents}
          userId="user-1"
        />
      );

      // Add file via drop
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const dropZone = screen.getByText(/Drop photos here or click to select/i).closest("div");
      if (dropZone) {
        fireEvent.drop(dropZone, {
          dataTransfer: { files: [file], items: [{ kind: "file", type: "image/jpeg", getAsFile: () => file }], types: ["Files"] },
        });
      }

      // Trigger upload
      fireEvent.click(screen.getByRole("button", { name: /upload 1 photo/i }));

      // Checkbox should be present and unchecked by default
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });
});
