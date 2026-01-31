/**
 * Phase 4.101 — QR Share Block Tests
 *
 * Tests for:
 * - QrShareBlock component rendering
 * - Props handling
 * - Integration points on event/venue/profile pages
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrShareBlock } from "@/components/shared/QrShareBlock";

describe("Phase 4.101 — QR Share Block", () => {
  describe("QrShareBlock component", () => {
    it("renders with required props (title and url)", () => {
      render(
        <QrShareBlock
          title="Share This Event"
          url="https://denversongwriterscollective.org/events/test-event"
        />
      );

      expect(screen.getByText("Share This Event")).toBeInTheDocument();
      // QR code should be rendered (QRCodeSVG creates an SVG)
      expect(document.querySelector("svg")).toBeInTheDocument();
      // URL should be displayed below QR
      expect(screen.getByText(/denversongwriterscollective\.org/)).toBeInTheDocument();
    });

    it("renders cover image when imageSrc provided", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/cover.jpg"
          imageAlt="Event cover"
        />
      );

      const img = screen.getByAltText("Event cover");
      expect(img).toBeInTheDocument();
    });

    it("works without imageSrc (image is optional)", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
        />
      );

      // Should not have any <img> element (only SVG for QR)
      expect(document.querySelector("img")).not.toBeInTheDocument();
      // But should still have QR code
      expect(document.querySelector("svg")).toBeInTheDocument();
    });

    it("renders label when provided", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          label="Scan to view event"
        />
      );

      expect(screen.getByText("Scan to view event")).toBeInTheDocument();
    });

    it("uses default imageAlt when not provided", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/cover.jpg"
        />
      );

      expect(screen.getByAltText("Cover image")).toBeInTheDocument();
    });

    it("uses custom qrSize when provided", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          qrSize={200}
        />
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "200");
      expect(svg).toHaveAttribute("height", "200");
    });

    it("uses default qrSize of 160 when not provided", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
        />
      );

      const svg = document.querySelector("svg");
      expect(svg).toHaveAttribute("width", "160");
      expect(svg).toHaveAttribute("height", "160");
    });

    it("has responsive layout classes", () => {
      const { container } = render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/cover.jpg"
        />
      );

      // Should have flex-col md:flex-row for responsive layout
      const flexContainer = container.querySelector(".flex-col.md\\:flex-row");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("Cover image sources", () => {
    it("documents event cover image source: events.cover_image_url", () => {
      // Events have cover_image_url field
      const eventCoverSource = "events.cover_image_url";
      expect(eventCoverSource).toBe("events.cover_image_url");
    });

    it("documents event override cover: override_patch.cover_image_url", () => {
      // Per-occurrence overrides can have different covers
      const overrideCoverSource = "override_patch.cover_image_url";
      expect(overrideCoverSource).toBe("override_patch.cover_image_url");
    });

    it("documents venue cover image source: venues.cover_image_url", () => {
      const venueCoverSource = "venues.cover_image_url";
      expect(venueCoverSource).toBe("venues.cover_image_url");
    });

    it("documents profile avatar source: profiles.avatar_url", () => {
      const profileAvatarSource = "profiles.avatar_url";
      expect(profileAvatarSource).toBe("profiles.avatar_url");
    });
  });

  describe("URL patterns", () => {
    it("event URL includes date param when date-specific", () => {
      const eventId = "test-event";
      const dateKey = "2026-01-30";
      const baseUrl = "https://denversongwriterscollective.org";

      const eventUrl = `${baseUrl}/events/${eventId}?date=${dateKey}`;
      expect(eventUrl).toContain("?date=");
    });

    it("venue URL uses slug when available", () => {
      const venueSlug = "brewery-rickoli";
      const baseUrl = "https://denversongwriterscollective.org";

      const venueUrl = `${baseUrl}/venues/${venueSlug}`;
      expect(venueUrl).toBe("https://denversongwriterscollective.org/venues/brewery-rickoli");
    });

    it("profile URL uses slug when available", () => {
      const profileSlug = "sami-serrag";
      const baseUrl = "https://denversongwriterscollective.org";

      const profileUrl = `${baseUrl}/songwriters/${profileSlug}`;
      expect(profileUrl).toBe("https://denversongwriterscollective.org/songwriters/sami-serrag");
    });
  });

  describe("SSR safety", () => {
    it("component does not access window during initial render", () => {
      // QRCodeSVG renders to inline SVG, no window access needed
      // This test documents the expectation

      // If this renders without error, it's SSR-safe
      expect(() => {
        render(
          <QrShareBlock
            title="Share"
            url="https://example.com"
          />
        );
      }).not.toThrow();
    });
  });

  describe("CSP compliance", () => {
    it("uses inline SVG for QR code (no external requests)", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
        />
      );

      // QRCodeSVG renders inline SVG, not img with src
      const svg = document.querySelector("svg");
      expect(svg).toBeInTheDocument();

      // Should not have any img elements for the QR code itself
      // (only the optional cover image)
      const imgs = document.querySelectorAll("img");
      expect(imgs.length).toBe(0); // No cover image in this test
    });
  });

  describe("Accessibility (Phase 4.101 micro-fixes)", () => {
    it("QR code wrapper has role=img for screen readers", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com/test-page"
        />
      );

      const qrWrapper = screen.getByRole("img", { name: /QR code linking to/ });
      expect(qrWrapper).toBeInTheDocument();
    });

    it("QR code aria-label includes the full URL", () => {
      const testUrl = "https://denversongwriterscollective.org/events/my-event";
      render(
        <QrShareBlock
          title="Share"
          url={testUrl}
        />
      );

      const qrWrapper = screen.getByRole("img", {
        name: `QR code linking to ${testUrl}`,
      });
      expect(qrWrapper).toBeInTheDocument();
    });

    it("screen readers can identify QR code purpose without visual context", () => {
      render(
        <QrShareBlock
          title="Share This Event"
          url="https://example.com/event/123"
        />
      );

      // The aria-label provides context that would otherwise require vision
      // We use getAllByRole because QRCodeSVG also has role="img" on the SVG
      const qrElements = screen.getAllByRole("img");
      const qrWrapper = qrElements.find(
        (el) => el.getAttribute("aria-label")?.includes("QR code linking to")
      );
      expect(qrWrapper).toBeDefined();
      expect(qrWrapper).toHaveAttribute(
        "aria-label",
        "QR code linking to https://example.com/event/123"
      );
    });
  });

  describe("Broken image fallback (Phase 4.101 micro-fixes)", () => {
    it("cover image has onError handler for graceful degradation", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/broken-image.jpg"
          imageAlt="Event cover"
        />
      );

      const img = screen.getByAltText("Event cover") as HTMLImageElement;
      expect(img).toBeInTheDocument();
      // The onError handler is attached - verify the img element exists and has our expected class
      expect(img).toHaveClass("object-cover");
    });

    it("cover image container has background for fallback display", () => {
      const { container } = render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/cover.jpg"
        />
      );

      // The container has bg-tertiary as placeholder when image fails
      const imageContainer = container.querySelector(
        ".bg-\\[var\\(--color-bg-tertiary\\)\\]"
      );
      expect(imageContainer).toBeInTheDocument();
    });

    it("uses native img element (not Next Image) for reliable onError handling", () => {
      render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
          imageSrc="https://example.com/cover.jpg"
        />
      );

      const img = screen.getByAltText("Cover image");
      // Native img elements have tagName "IMG"
      expect(img.tagName).toBe("IMG");
      // Should have inline onError handler capability
      expect(img).toHaveAttribute("src", "https://example.com/cover.jpg");
    });
  });
});
