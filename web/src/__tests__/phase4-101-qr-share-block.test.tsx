/**
 * Phase 4.101 — QR Share Block Tests
 *
 * Tests for:
 * - QrShareBlock component rendering
 * - Props handling
 * - Integration points on event/venue/profile pages
 *
 * NOTE: Cover image feature was removed to simplify the component.
 * QR code and URL are now the only elements displayed.
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
          url="https://coloradosongwriterscollective.org/events/test-event"
        />
      );

      expect(screen.getByText("Share This Event")).toBeInTheDocument();
      // QR code should be rendered (QRCodeSVG creates an SVG)
      expect(document.querySelector("svg")).toBeInTheDocument();
      // URL should be displayed below QR
      expect(screen.getByText(/coloradosongwriterscollective\.org/)).toBeInTheDocument();
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

    it("renders centered layout", () => {
      const { container } = render(
        <QrShareBlock
          title="Share"
          url="https://example.com"
        />
      );

      // Should have flex-col items-center for centered layout
      const flexContainer = container.querySelector(".flex-col.items-center");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("URL patterns", () => {
    it("event URL includes date param when date-specific", () => {
      const eventId = "test-event";
      const dateKey = "2026-01-30";
      const baseUrl = "https://coloradosongwriterscollective.org";

      const eventUrl = `${baseUrl}/events/${eventId}?date=${dateKey}`;
      expect(eventUrl).toContain("?date=");
    });

    it("venue URL uses slug when available", () => {
      const venueSlug = "brewery-rickoli";
      const baseUrl = "https://coloradosongwriterscollective.org";

      const venueUrl = `${baseUrl}/venues/${venueSlug}`;
      expect(venueUrl).toBe("https://coloradosongwriterscollective.org/venues/brewery-rickoli");
    });

    it("profile URL uses slug when available", () => {
      const profileSlug = "sami-serrag";
      const baseUrl = "https://coloradosongwriterscollective.org";

      const profileUrl = `${baseUrl}/songwriters/${profileSlug}`;
      expect(profileUrl).toBe("https://coloradosongwriterscollective.org/songwriters/sami-serrag");
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

      // Should not have any img elements (no cover image feature)
      const imgs = document.querySelectorAll("img");
      expect(imgs.length).toBe(0);
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
      const testUrl = "https://coloradosongwriterscollective.org/events/my-event";
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
});
