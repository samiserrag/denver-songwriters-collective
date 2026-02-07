/**
 * Profile Photos UI Behavior Tests
 *
 * Tests for Slice 5: Member Profile Image Gallery
 *
 * Component: ProfilePhotosSection
 * - Upload new photos
 * - View photo grid
 * - Select photo as avatar
 * - Delete photos
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Mock the supabase client
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({ data: { publicUrl: "https://test.com/image.jpg" } }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    from: () => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "test-id",
              user_id: "user-123",
              image_url: "https://test.com/image.jpg",
              storage_path: "profile-gallery/user-123/test.jpg",
              created_at: new Date().toISOString(),
              deleted_at: null,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Import the component after mocks
import { ProfilePhotosSection } from "@/components/profile/ProfilePhotosSection";

describe("ProfilePhotosSection Component", () => {
  const defaultProps = {
    userId: "user-123",
    currentAvatarUrl: null,
    initialImages: [],
    onAvatarChange: vi.fn(),
  };

  describe("Empty state", () => {
    it("should render empty state when no images", () => {
      render(<ProfilePhotosSection {...defaultProps} />);

      expect(screen.getByText("Profile Photos")).toBeInTheDocument();
      expect(screen.getByText(/No photos yet/)).toBeInTheDocument();
      expect(screen.getByText(/Upload your first photo/)).toBeInTheDocument();
    });

    it("should render upload area", () => {
      render(<ProfilePhotosSection {...defaultProps} />);

      expect(screen.getByText("Add Photo")).toBeInTheDocument();
    });
  });

  describe("With images", () => {
    const imagesProps = {
      ...defaultProps,
      initialImages: [
        {
          id: "img-1",
          user_id: "user-123",
          image_url: "https://test.com/image1.jpg",
          storage_path: "profile-gallery/user-123/image1.jpg",
          created_at: "2026-01-15T00:00:00Z",
          deleted_at: null,
        },
        {
          id: "img-2",
          user_id: "user-123",
          image_url: "https://test.com/image2.jpg",
          storage_path: "profile-gallery/user-123/image2.jpg",
          created_at: "2026-01-16T00:00:00Z",
          deleted_at: null,
        },
      ],
    };

    it("should render image grid with all images", () => {
      render(<ProfilePhotosSection {...imagesProps} />);

      const images = screen.getAllByRole("img", { name: /Profile photo/i });
      expect(images).toHaveLength(2);
    });

    it("should not show empty state when images exist", () => {
      render(<ProfilePhotosSection {...imagesProps} />);

      expect(screen.queryByText(/No photos yet/)).not.toBeInTheDocument();
    });
  });

  describe("Current avatar indication", () => {
    it("should show 'Current' badge on the active avatar", () => {
      const props = {
        ...defaultProps,
        currentAvatarUrl: "https://test.com/image1.jpg",
        initialImages: [
          {
            id: "img-1",
            user_id: "user-123",
            image_url: "https://test.com/image1.jpg",
            storage_path: "profile-gallery/user-123/image1.jpg",
            created_at: "2026-01-15T00:00:00Z",
            deleted_at: null,
          },
        ],
      };

      render(<ProfilePhotosSection {...props} />);

      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("should match URLs without cache busters", () => {
      const props = {
        ...defaultProps,
        currentAvatarUrl: "https://test.com/image1.jpg?t=123",
        initialImages: [
          {
            id: "img-1",
            user_id: "user-123",
            image_url: "https://test.com/image1.jpg?t=456",
            storage_path: "profile-gallery/user-123/image1.jpg",
            created_at: "2026-01-15T00:00:00Z",
            deleted_at: null,
          },
        ],
      };

      render(<ProfilePhotosSection {...props} />);

      // Should still show "Current" because base URLs match
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("should not show 'Current' badge when avatar doesn't match", () => {
      const props = {
        ...defaultProps,
        currentAvatarUrl: "https://test.com/other.jpg",
        initialImages: [
          {
            id: "img-1",
            user_id: "user-123",
            image_url: "https://test.com/image1.jpg",
            storage_path: "profile-gallery/user-123/image1.jpg",
            created_at: "2026-01-15T00:00:00Z",
            deleted_at: null,
          },
        ],
      };

      render(<ProfilePhotosSection {...props} />);

      expect(screen.queryByText("Current")).not.toBeInTheDocument();
    });
  });

  describe("Soft delete filtering", () => {
    it("should not render soft-deleted images", () => {
      const props = {
        ...defaultProps,
        initialImages: [
          {
            id: "img-1",
            user_id: "user-123",
            image_url: "https://test.com/image1.jpg",
            storage_path: "profile-gallery/user-123/image1.jpg",
            created_at: "2026-01-15T00:00:00Z",
            deleted_at: null,
          },
          {
            id: "img-2",
            user_id: "user-123",
            image_url: "https://test.com/deleted.jpg",
            storage_path: "profile-gallery/user-123/deleted.jpg",
            created_at: "2026-01-14T00:00:00Z",
            deleted_at: "2026-01-17T00:00:00Z", // Soft deleted
          },
        ],
      };

      render(<ProfilePhotosSection {...props} />);

      const images = screen.getAllByRole("img", { name: /Profile photo/i });
      expect(images).toHaveLength(1);
    });
  });
});

describe("ProfilePhotosSection Upload Flow", () => {
  it("should have descriptive helper text", () => {
    render(
      <ProfilePhotosSection
        userId="user-123"
        currentAvatarUrl={null}
        initialImages={[]}
        onAvatarChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Click or drag to upload/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Max 10 MB/)).toBeInTheDocument();
  });
});

describe("ProfilePhotosSection Hover Actions", () => {
  const propsWithImages = {
    userId: "user-123",
    currentAvatarUrl: null,
    initialImages: [
      {
        id: "img-1",
        user_id: "user-123",
        image_url: "https://test.com/image1.jpg",
        storage_path: "profile-gallery/user-123/image1.jpg",
        created_at: "2026-01-15T00:00:00Z",
        deleted_at: null,
      },
    ],
    onAvatarChange: vi.fn(),
  };

  it("should have delete button for each image", () => {
    render(<ProfilePhotosSection {...propsWithImages} />);

    // Delete buttons are in hover overlay, but exist in DOM
    const deleteButton = screen.getByTitle("Delete photo");
    expect(deleteButton).toBeInTheDocument();
  });

  it("should have set as avatar button for non-current images", () => {
    render(<ProfilePhotosSection {...propsWithImages} />);

    const setAvatarButton = screen.getByTitle("Set as profile photo");
    expect(setAvatarButton).toBeInTheDocument();
  });

  it("should not have set as avatar button for current avatar", () => {
    const props = {
      ...propsWithImages,
      currentAvatarUrl: "https://test.com/image1.jpg",
    };

    render(<ProfilePhotosSection {...props} />);

    // Should not have "Set as profile photo" button for current avatar
    expect(screen.queryByTitle("Set as profile photo")).not.toBeInTheDocument();
  });
});

describe("ProfilePhotosSection Section Header", () => {
  it("should have correct section title", () => {
    render(
      <ProfilePhotosSection
        userId="user-123"
        currentAvatarUrl={null}
        initialImages={[]}
        onAvatarChange={vi.fn()}
      />
    );

    expect(screen.getByText("Profile Photos")).toBeInTheDocument();
  });

  it("should have descriptive subtitle", () => {
    render(
      <ProfilePhotosSection
        userId="user-123"
        currentAvatarUrl={null}
        initialImages={[]}
        onAvatarChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Upload multiple photos and choose which one to display/)
    ).toBeInTheDocument();
  });

  it("should have correct section id for anchor linking", () => {
    const { container } = render(
      <ProfilePhotosSection
        userId="user-123"
        currentAvatarUrl={null}
        initialImages={[]}
        onAvatarChange={vi.fn()}
      />
    );

    const section = container.querySelector("#photos-section");
    expect(section).toBeInTheDocument();
  });
});

describe("ProfilePhotosSection Responsive Grid", () => {
  it("should render images in a grid layout", () => {
    const props = {
      userId: "user-123",
      currentAvatarUrl: null,
      initialImages: [
        {
          id: "img-1",
          user_id: "user-123",
          image_url: "https://test.com/image1.jpg",
          storage_path: "profile-gallery/user-123/image1.jpg",
          created_at: "2026-01-15T00:00:00Z",
          deleted_at: null,
        },
        {
          id: "img-2",
          user_id: "user-123",
          image_url: "https://test.com/image2.jpg",
          storage_path: "profile-gallery/user-123/image2.jpg",
          created_at: "2026-01-16T00:00:00Z",
          deleted_at: null,
        },
        {
          id: "img-3",
          user_id: "user-123",
          image_url: "https://test.com/image3.jpg",
          storage_path: "profile-gallery/user-123/image3.jpg",
          created_at: "2026-01-17T00:00:00Z",
          deleted_at: null,
        },
      ],
      onAvatarChange: vi.fn(),
    };

    const { container } = render(<ProfilePhotosSection {...props} />);

    // Check grid container has appropriate classes
    const grid = container.querySelector(".grid");
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass("grid-cols-3"); // Mobile: 3 columns
  });
});
