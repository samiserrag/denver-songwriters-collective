/**
 * Phase 1.2b: MapPinPopup Contract Tests
 *
 * Tests for the pure MapPinPopup component extracted from MapView.
 * Verifies popup rendering contracts without Leaflet DOM dependencies.
 *
 * Contracts Tested:
 * 1. Venue name links to /venues/{slug} when venueSlug exists
 * 2. Venue name renders as plain text when venueSlug is null
 * 3. Each event links to its href (includes ?date= param)
 * 4. Shows max 5 events, then "+X more happening(s)" overflow
 * 5. Events container has scroll styling for overflow
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MapPinPopup } from "@/components/happenings/MapPinPopup";
import type { MapPinData, MapPinEvent } from "@/lib/map";

/**
 * Factory for creating test MapPinEvent objects
 */
function createTestEvent(overrides: Partial<MapPinEvent> = {}): MapPinEvent {
  return {
    eventId: "event-1",
    eventSlug: "test-event",
    title: "Test Event",
    eventType: "open_mic",
    dateKey: "2026-01-30",
    displayDate: "Thu, Jan 30",
    startTime: "7:00 PM",
    href: "/events/test-event?date=2026-01-30",
    isCancelled: false,
    isRescheduled: false,
    ...overrides,
  };
}

/**
 * Factory for creating test MapPinData objects
 */
function createTestPin(overrides: Partial<MapPinData> = {}): MapPinData {
  return {
    venueId: "venue-1",
    latitude: 39.7392,
    longitude: -104.9903,
    venueName: "Test Venue",
    venueSlug: "test-venue",
    events: [createTestEvent()],
    ...overrides,
  };
}

describe("MapPinPopup", () => {
  describe("Contract 1: Venue link when slug exists", () => {
    it("renders venue name as link to /venues/{slug} when venueSlug is provided", () => {
      const pin = createTestPin({ venueSlug: "brewery-rickoli" });
      render(<MapPinPopup pin={pin} />);

      const venueLink = screen.getByRole("link", { name: pin.venueName });
      expect(venueLink).toBeInTheDocument();
      expect(venueLink).toHaveAttribute("href", "/venues/brewery-rickoli");
    });

    it("venue link has correct styling classes", () => {
      const pin = createTestPin({ venueSlug: "my-venue" });
      render(<MapPinPopup pin={pin} />);

      const venueLink = screen.getByRole("link", { name: pin.venueName });
      expect(venueLink).toHaveClass("font-semibold", "text-blue-600", "hover:underline");
    });
  });

  describe("Contract 2: Venue text when slug is null", () => {
    it("renders venue name as plain text when venueSlug is null", () => {
      const pin = createTestPin({ venueSlug: null, venueName: "Custom Location" });
      render(<MapPinPopup pin={pin} />);

      // Should NOT be a link
      const venueLink = screen.queryByRole("link", { name: "Custom Location" });
      expect(venueLink).not.toBeInTheDocument();

      // Should be plain text span
      const venueText = screen.getByText("Custom Location");
      expect(venueText.tagName).toBe("SPAN");
      expect(venueText).toHaveClass("font-semibold", "text-gray-900");
    });
  });

  describe("Contract 3: Event links include href with date param", () => {
    it("each event title links to its href", () => {
      const events = [
        createTestEvent({ eventId: "e1", title: "Open Mic Night", href: "/events/open-mic?date=2026-01-30" }),
        createTestEvent({ eventId: "e2", title: "Song Circle", href: "/events/song-circle?date=2026-02-01" }),
      ];
      const pin = createTestPin({ events });
      render(<MapPinPopup pin={pin} />);

      const link1 = screen.getByRole("link", { name: "Open Mic Night" });
      expect(link1).toHaveAttribute("href", "/events/open-mic?date=2026-01-30");

      const link2 = screen.getByRole("link", { name: "Song Circle" });
      expect(link2).toHaveAttribute("href", "/events/song-circle?date=2026-02-01");
    });

    it("event links have correct styling classes", () => {
      const pin = createTestPin();
      render(<MapPinPopup pin={pin} />);

      const eventLink = screen.getByRole("link", { name: pin.events[0].title });
      expect(eventLink).toHaveClass("text-blue-600", "hover:underline", "font-medium", "block");
    });
  });

  describe("Contract 4: 5-event limit with '+X more' overflow", () => {
    it("shows all events when 5 or fewer", () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        createTestEvent({
          eventId: `e${i}`,
          title: `Event ${i + 1}`,
          dateKey: `2026-01-${(i + 1).toString().padStart(2, "0")}`,
        })
      );
      const pin = createTestPin({ events });
      render(<MapPinPopup pin={pin} />);

      // All 5 should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Event ${i}`)).toBeInTheDocument();
      }

      // No overflow text
      expect(screen.queryByText(/more happening/)).not.toBeInTheDocument();
    });

    it("shows '+1 more happening' when 6 events", () => {
      const events = Array.from({ length: 6 }, (_, i) =>
        createTestEvent({
          eventId: `e${i}`,
          title: `Event ${i + 1}`,
          dateKey: `2026-01-${(i + 1).toString().padStart(2, "0")}`,
        })
      );
      const pin = createTestPin({ events });
      render(<MapPinPopup pin={pin} />);

      // First 5 visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Event ${i}`)).toBeInTheDocument();
      }

      // 6th hidden
      expect(screen.queryByText("Event 6")).not.toBeInTheDocument();

      // Overflow text (singular)
      expect(screen.getByText("+1 more happening")).toBeInTheDocument();
    });

    it("shows '+5 more happenings' when 10 events (plural)", () => {
      const events = Array.from({ length: 10 }, (_, i) =>
        createTestEvent({
          eventId: `e${i}`,
          title: `Event ${i + 1}`,
          dateKey: `2026-01-${(i + 1).toString().padStart(2, "0")}`,
        })
      );
      const pin = createTestPin({ events });
      render(<MapPinPopup pin={pin} />);

      // Overflow text (plural)
      expect(screen.getByText("+5 more happenings")).toBeInTheDocument();
    });
  });

  describe("Contract 5: Scroll container styling", () => {
    it("events container has scroll classes", () => {
      const events = Array.from({ length: 3 }, (_, i) =>
        createTestEvent({ eventId: `e${i}`, title: `Event ${i + 1}` })
      );
      const pin = createTestPin({ events });
      const { container } = render(<MapPinPopup pin={pin} />);

      // Find the events container (div after venue header)
      const eventsContainer = container.querySelector(".space-y-2.max-h-\\[200px\\].overflow-y-auto");
      expect(eventsContainer).toBeInTheDocument();
    });
  });

  describe("Happening count display", () => {
    it("shows '1 happening' for single event (singular)", () => {
      const pin = createTestPin({ events: [createTestEvent()] });
      render(<MapPinPopup pin={pin} />);

      expect(screen.getByText("1 happening")).toBeInTheDocument();
    });

    it("shows '3 happenings' for multiple events (plural)", () => {
      const events = Array.from({ length: 3 }, (_, i) =>
        createTestEvent({ eventId: `e${i}`, title: `Event ${i + 1}` })
      );
      const pin = createTestPin({ events });
      render(<MapPinPopup pin={pin} />);

      expect(screen.getByText("3 happenings")).toBeInTheDocument();
    });
  });

  describe("Event status indicators", () => {
    it("shows CANCELLED indicator for cancelled events", () => {
      const pin = createTestPin({
        events: [createTestEvent({ isCancelled: true })],
      });
      render(<MapPinPopup pin={pin} />);

      const cancelledBadge = screen.getByText("CANCELLED");
      expect(cancelledBadge).toBeInTheDocument();
      expect(cancelledBadge).toHaveClass("text-red-600", "font-medium");
    });

    it("shows RESCHEDULED indicator for rescheduled events", () => {
      const pin = createTestPin({
        events: [createTestEvent({ isRescheduled: true })],
      });
      render(<MapPinPopup pin={pin} />);

      const rescheduledBadge = screen.getByText("RESCHEDULED");
      expect(rescheduledBadge).toBeInTheDocument();
      expect(rescheduledBadge).toHaveClass("text-amber-600", "font-medium");
    });

    it("cancelled takes precedence over rescheduled", () => {
      const pin = createTestPin({
        events: [createTestEvent({ isCancelled: true, isRescheduled: true })],
      });
      render(<MapPinPopup pin={pin} />);

      // Cancelled should show
      expect(screen.getByText("CANCELLED")).toBeInTheDocument();

      // Rescheduled should NOT show (cancelled takes precedence)
      expect(screen.queryByText("RESCHEDULED")).not.toBeInTheDocument();
    });
  });

  describe("Event display details", () => {
    it("shows event date", () => {
      const pin = createTestPin({
        events: [createTestEvent({ displayDate: "Thu, Jan 30" })],
      });
      render(<MapPinPopup pin={pin} />);

      expect(screen.getByText("Thu, Jan 30")).toBeInTheDocument();
    });

    it("shows event time when provided", () => {
      const pin = createTestPin({
        events: [createTestEvent({ startTime: "7:00 PM" })],
      });
      render(<MapPinPopup pin={pin} />);

      expect(screen.getByText("7:00 PM")).toBeInTheDocument();
    });

    it("hides time section when startTime is null", () => {
      const pin = createTestPin({
        events: [createTestEvent({ startTime: null })],
      });
      render(<MapPinPopup pin={pin} />);

      // Time separator shouldn't appear
      const container = screen.getByText("Thu, Jan 30").parentElement;
      expect(container?.textContent).not.toContain("·");
    });
  });
});
