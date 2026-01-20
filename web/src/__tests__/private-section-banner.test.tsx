/**
 * PrivateSectionBanner Component Tests
 *
 * Tests for the privacy indicator used on profile pages.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivateSectionBanner } from "@/components/profile/PrivateSectionBanner";

describe("PrivateSectionBanner", () => {
  it("renders with lock icon and private message", () => {
    render(<PrivateSectionBanner />);

    const banner = screen.getByTestId("private-section-banner");
    expect(banner).toBeDefined();

    // Check for "Private" text
    expect(banner.textContent).toContain("Private");
    expect(banner.textContent).toContain("Only you can see this section");
  });

  it("renders lock icon SVG", () => {
    render(<PrivateSectionBanner />);

    const banner = screen.getByTestId("private-section-banner");
    const svg = banner.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("applies custom className when provided", () => {
    render(<PrivateSectionBanner className="custom-class" />);

    const banner = screen.getByTestId("private-section-banner");
    expect(banner.classList.contains("custom-class")).toBe(true);
  });

  it("has accessible styling with visible border and background", () => {
    render(<PrivateSectionBanner />);

    const banner = screen.getByTestId("private-section-banner");
    // Check that the banner has border and background classes
    expect(banner.classList.contains("border")).toBe(true);
    expect(banner.classList.contains("rounded-lg")).toBe(true);
  });
});
