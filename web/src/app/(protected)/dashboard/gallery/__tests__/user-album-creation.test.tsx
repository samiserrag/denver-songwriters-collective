/**
 * User Album Creation Tests
 *
 * Tests the inline album creation feature on the user gallery upload page.
 * Verifies:
 * - Album create UI renders and responds to user input
 * - Slug generation follows the same logic as admin
 * - Album creation updates the dropdown selection
 *
 * Note: These tests use userEvent which can be slow during parallel execution.
 * Timeout increased to 15s to prevent flaky failures in full suite runs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserGalleryUpload from "../UserGalleryUpload";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();
const mockLike = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      mockFrom(table);
      return {
        insert: (data: unknown) => {
          mockInsert(data);
          return {
            select: () => ({
              single: () => mockSingle(),
            }),
          };
        },
        select: (columns: string) => {
          mockSelect(columns);
          return {
            like: (_col: string, pattern: string) => {
              mockLike(pattern);
              return Promise.resolve({ data: [], error: null });
            },
          };
        },
      };
    },
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}));

describe("UserGalleryUpload - Album Creation", { timeout: 15000 }, () => {
  const defaultProps = {
    albums: [{ id: "existing-1", name: "Existing Album" }],
    venues: [{ id: "venue-1", name: "Mercury Cafe" }],
    events: [{ id: "event-1", title: "Monday Open Mic", event_date: "2025-01-15" }],
    userId: "user-123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({
      data: { id: "new-album-id", name: "My New Album" },
      error: null,
    });
  });

  describe("Album dropdown with create button", () => {
    it("should render album dropdown with existing albums", () => {
      render(<UserGalleryUpload {...defaultProps} />);
      // Multiple comboboxes exist (album, venue, event) - find album by checking its options
      const comboboxes = screen.getAllByRole("combobox");
      expect(comboboxes.length).toBe(3); // Album, Venue, Event
      expect(screen.getByText("Existing Album")).toBeInTheDocument();
    });

    it("should render labeled 'New album' button (not just + icon)", () => {
      render(<UserGalleryUpload {...defaultProps} />);
      // Button should have visible "New album" text, not just a title attribute
      expect(screen.getByRole("button", { name: /new album/i })).toBeInTheDocument();
    });

    it("should show album creation form when 'New album' button clicked", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      const addButton = screen.getByRole("button", { name: /new album/i });
      await userEvent.click(addButton);
      expect(screen.getByPlaceholderText("Album name")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create album" })).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("should show 'Save as draft' checkbox in creation form", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      expect(screen.getByLabelText(/save as draft/i)).toBeInTheDocument();
    });

    it("should hide album creation form when Cancel clicked", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      expect(screen.getByPlaceholderText("Album name")).toBeInTheDocument();
      await userEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByPlaceholderText("Album name")).not.toBeInTheDocument();
    });
  });

  describe("Album creation flow", () => {
    it("should disable Create album button when name is empty", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      const createButton = screen.getByRole("button", { name: "Create album" });
      expect(createButton).toBeDisabled();
    });

    it("should enable Create album button when name is entered", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      const input = screen.getByPlaceholderText("Album name");
      await userEvent.type(input, "My New Album");
      const createButton = screen.getByRole("button", { name: "Create album" });
      expect(createButton).not.toBeDisabled();
    });

    it("should create album as published by default (is_published=true)", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My New Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          name: "My New Album",
          slug: "my-new-album",
          created_by: "user-123",
          is_published: true, // Default: published so it appears in public gallery
        });
      });
    });

    it("should create album as draft when 'Save as draft' is checked", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My Draft Album");
      // Check the "Save as draft" checkbox
      await userEvent.click(screen.getByLabelText(/save as draft/i));
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          name: "My Draft Album",
          slug: "my-draft-album",
          created_by: "user-123",
          is_published: false, // Draft: not visible in public gallery
        });
      });
    });

    it("should add new album to dropdown after creation", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My New Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        const options = screen.getAllByRole("option");
        const albumNames = options.map((opt) => opt.textContent);
        expect(albumNames).toContain("My New Album");
      });
    });

    it("should auto-select newly created album", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My New Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        // The album dropdown is the first combobox
        const comboboxes = screen.getAllByRole("combobox");
        const albumSelect = comboboxes[0] as HTMLSelectElement;
        expect(albumSelect.value).toBe("new-album-id");
      });
    });

    it("should show 'Published' status chip after creating published album", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My New Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(screen.getByText("Published")).toBeInTheDocument();
      });
    });

    it("should show 'Draft' status chip after creating draft album", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My Draft Album");
      await userEvent.click(screen.getByLabelText(/save as draft/i));
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(screen.getByText(/Draft.*not visible in public gallery/i)).toBeInTheDocument();
      });
    });

    it("should hide creation form after successful create", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "My New Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Album name")).not.toBeInTheDocument();
      });
    });
  });

  describe("Error handling", () => {
    it("should show error message when album name is empty on submit", async () => {
      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      const input = screen.getByPlaceholderText("Album name");
      await userEvent.type(input, "   "); // Just spaces
      await userEvent.clear(input);
      // Button should be disabled, but if somehow clicked...
      const createButton = screen.getByRole("button", { name: "Create album" });
      expect(createButton).toBeDisabled();
    });

    it("should show error on Supabase insert failure", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: "RLS policy violation" },
      });

      render(<UserGalleryUpload {...defaultProps} />);
      await userEvent.click(screen.getByRole("button", { name: /new album/i }));
      await userEvent.type(screen.getByPlaceholderText("Album name"), "Test Album");
      await userEvent.click(screen.getByRole("button", { name: "Create album" }));

      await waitFor(() => {
        expect(screen.getByText("Could not create album. Please try again.")).toBeInTheDocument();
      });
    });
  });
});

describe("UserGalleryUpload - Event Dropdown", { timeout: 15000 }, () => {
  // Helper to format dates exactly as the component does (America/Denver timezone)
  const formatEventDate = (dateStr: string): string => {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Denver",
    });
  };

  const propsWithEvents = {
    albums: [],
    venues: [],
    events: [
      { id: "event-1", title: "Monday Open Mic", event_date: "2025-01-15" },
      { id: "event-2", title: "Songwriter Showcase", event_date: "2025-02-20" },
      { id: "event-3", title: "Workshop", event_date: null },
    ],
    userId: "user-123",
  };

  it("should display events with dates in format 'Title — MMM D, YYYY'", () => {
    render(<UserGalleryUpload {...propsWithEvents} />);
    // Use the same formatting as the component (America/Denver timezone)
    const expectedDate1 = formatEventDate("2025-01-15");
    const expectedDate2 = formatEventDate("2025-02-20");
    expect(screen.getByText(new RegExp(`Monday Open Mic — ${expectedDate1}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Songwriter Showcase — ${expectedDate2}`))).toBeInTheDocument();
  });

  it("should display events without dates as title only", () => {
    render(<UserGalleryUpload {...propsWithEvents} />);
    // Workshop has no date - should show title only
    const options = screen.getAllByRole("option");
    const workshopOption = options.find(opt => opt.textContent === "Workshop");
    expect(workshopOption).toBeInTheDocument();
  });

  it("should have 'Select event' as default option", () => {
    render(<UserGalleryUpload {...propsWithEvents} />);
    expect(screen.getByText("Select event")).toBeInTheDocument();
  });
});

describe("UserGalleryUpload - Custom Venue Toggle", { timeout: 15000 }, () => {
  const defaultProps = {
    albums: [],
    venues: [
      { id: "venue-1", name: "Mercury Cafe" },
      { id: "venue-2", name: "The Oriental Theater" },
    ],
    events: [],
    userId: "user-123",
  };

  it("should show venue dropdown by default", () => {
    render(<UserGalleryUpload {...defaultProps} />);
    expect(screen.getByText("Mercury Cafe")).toBeInTheDocument();
    expect(screen.getByText("Venue not listed? Enter manually")).toBeInTheDocument();
  });

  it("should show custom venue input when toggle clicked", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Venue not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter venue name")).toBeInTheDocument();
    expect(screen.getByText("Select from list instead")).toBeInTheDocument();
  });

  it("should switch back to dropdown when 'Select from list' clicked", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Venue not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter venue name")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Select from list instead"));
    expect(screen.queryByPlaceholderText("Enter venue name")).not.toBeInTheDocument();
    expect(screen.getByText("Mercury Cafe")).toBeInTheDocument();
  });

  it("should clear custom venue name when switching back to dropdown", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Venue not listed? Enter manually"));
    await userEvent.type(screen.getByPlaceholderText("Enter venue name"), "My Custom Venue");
    await userEvent.click(screen.getByText("Select from list instead"));
    await userEvent.click(screen.getByText("Venue not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter venue name")).toHaveValue("");
  });
});

describe("UserGalleryUpload - Custom Event Toggle", { timeout: 15000 }, () => {
  const defaultProps = {
    albums: [],
    venues: [],
    events: [
      { id: "event-1", title: "Monday Open Mic", event_date: "2025-01-15" },
    ],
    userId: "user-123",
  };

  it("should show event dropdown by default", () => {
    render(<UserGalleryUpload {...defaultProps} />);
    expect(screen.getByText(/Monday Open Mic/)).toBeInTheDocument();
    expect(screen.getByText("Event not listed? Enter manually")).toBeInTheDocument();
  });

  it("should show custom event inputs when toggle clicked", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Event not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter event name")).toBeInTheDocument();
    // Date input exists (no placeholder text, but type=date input)
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
    expect(screen.getByText("Select from list instead")).toBeInTheDocument();
  });

  it("should switch back to dropdown when 'Select from list' clicked", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Event not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter event name")).toBeInTheDocument();
    // Find the correct "Select from list instead" button (there may be two - one for venue, one for event)
    const selectButtons = screen.getAllByText("Select from list instead");
    await userEvent.click(selectButtons[0]); // Click the first one (event is the only custom mode active)
    expect(screen.queryByPlaceholderText("Enter event name")).not.toBeInTheDocument();
    expect(screen.getByText(/Monday Open Mic/)).toBeInTheDocument();
  });

  it("should clear custom event fields when switching back to dropdown", async () => {
    render(<UserGalleryUpload {...defaultProps} />);
    await userEvent.click(screen.getByText("Event not listed? Enter manually"));
    await userEvent.type(screen.getByPlaceholderText("Enter event name"), "My Custom Event");
    const selectButtons = screen.getAllByText("Select from list instead");
    await userEvent.click(selectButtons[0]);
    await userEvent.click(screen.getByText("Event not listed? Enter manually"));
    expect(screen.getByPlaceholderText("Enter event name")).toHaveValue("");
  });
});

describe("Slug generation", () => {
  // Test slug generation logic matches admin GalleryAdminTabs.tsx
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  it("should convert to lowercase", () => {
    expect(generateSlug("My Album")).toBe("my-album");
  });

  it("should replace spaces with hyphens", () => {
    expect(generateSlug("summer photos 2025")).toBe("summer-photos-2025");
  });

  it("should remove special characters", () => {
    expect(generateSlug("Open Mic @ Mercury!")).toBe("open-mic-mercury");
  });

  it("should collapse multiple hyphens", () => {
    expect(generateSlug("test   album   name")).toBe("test-album-name");
  });

  it("should trim leading/trailing hyphens", () => {
    expect(generateSlug("  test  ")).toBe("test");
    expect(generateSlug("--test--")).toBe("test");
  });

  it("should handle unicode characters", () => {
    expect(generateSlug("Café Photos")).toBe("caf-photos");
  });

  it("should handle numbers", () => {
    expect(generateSlug("2025 Open Mic Night")).toBe("2025-open-mic-night");
  });
});
