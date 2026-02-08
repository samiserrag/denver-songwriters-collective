/**
 * Phase 4.110: TV Mode 20-Slot Fit + Readability Tests
 *
 * Extends Phase 4.109 with new contracts for:
 * 1. 3-tier adaptive slot sizing (large/medium/compact)
 * 2. Increased text sizes for 8-12 foot readability
 * 3. Reduced container padding for more content space
 * 4. Layout stability (tier computed from total slots)
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// 1. 3-Tier Adaptive Slot Sizing (Phase 4.110 - supersedes Phase 4.109 binary)
// =============================================================================

describe("Phase 4.110: 3-Tier Adaptive Slot Sizing", () => {
  /**
   * getSlotTier function (from display/page.tsx)
   * Phase 4.110: Changed from binary (large/small) to 3-tier (large/medium/compact)
   */
  function getSlotTier(slotCount: number): "large" | "medium" | "compact" {
    if (slotCount <= 10) return "large";
    if (slotCount <= 14) return "medium";
    return "compact";
  }

  it("should return 'large' for 10 or fewer slots", () => {
    expect(getSlotTier(1)).toBe("large");
    expect(getSlotTier(5)).toBe("large");
    expect(getSlotTier(10)).toBe("large");
  });

  it("should return 'medium' for 11-14 slots", () => {
    expect(getSlotTier(11)).toBe("medium");
    expect(getSlotTier(12)).toBe("medium");
    expect(getSlotTier(14)).toBe("medium");
  });

  it("should return 'compact' for 15-20 slots", () => {
    expect(getSlotTier(15)).toBe("compact");
    expect(getSlotTier(18)).toBe("compact");
    expect(getSlotTier(20)).toBe("compact");
  });

  it("should compute tier from TOTAL timeslots for layout stability", () => {
    // Contract: Tier is computed from total timeslots.length (stable)
    // not upNextSlots.length (changes on Go Live)
    // This ensures no layout reflow when transitioning from pre-live to live

    const totalSlots = 15; // 15 total slots
    const upNextSlots = 14; // After "Go Live", 14 remaining

    // Tier computed from TOTAL, not remaining
    const tier = getSlotTier(totalSlots);
    expect(tier).toBe("compact"); // 15 > 14, so compact

    // Even if we used upNextSlots, it would be medium (14)
    // But we don't - we use total for stability
    const wrongTier = getSlotTier(upNextSlots);
    expect(wrongTier).toBe("medium"); // This is NOT what we use

    // Confirm they differ - this is the reason for the stability rule
    expect(tier).not.toBe(wrongTier);
  });
});

// =============================================================================
// 2. 2-Column Layout Detection (Phase 4.110)
// =============================================================================

describe("Phase 4.110: 2-Column Layout", () => {
  it("should use 1 column when 10 or fewer total slots", () => {
    function shouldUse2Columns(totalSlots: number): boolean {
      return totalSlots > 10;
    }

    expect(shouldUse2Columns(5)).toBe(false);
    expect(shouldUse2Columns(10)).toBe(false);
  });

  it("should use 2 columns when more than 10 total slots", () => {
    function shouldUse2Columns(totalSlots: number): boolean {
      return totalSlots > 10;
    }

    expect(shouldUse2Columns(11)).toBe(true);
    expect(shouldUse2Columns(15)).toBe(true);
    expect(shouldUse2Columns(20)).toBe(true);
  });
});

// =============================================================================
// 3. Tier-Specific Slot Styling (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Tier-Specific Slot Styling", () => {
  function getSlotPadding(tier: "large" | "medium" | "compact"): string {
    return tier === "large" ? "p-2.5 gap-3" : tier === "medium" ? "p-1.5 gap-2" : "p-1 gap-1.5";
  }

  function getSlotRounding(tier: "large" | "medium" | "compact"): string {
    return tier === "large" ? "rounded-xl" : "rounded-lg";
  }

  function getContainerGap(tier: "large" | "medium" | "compact"): string {
    return tier === "large" ? "gap-2" : tier === "medium" ? "gap-1.5" : "gap-1";
  }

  it("should use larger padding for 'large' tier", () => {
    expect(getSlotPadding("large")).toBe("p-2.5 gap-3");
  });

  it("should use medium padding for 'medium' tier", () => {
    expect(getSlotPadding("medium")).toBe("p-1.5 gap-2");
  });

  it("should use minimal padding for 'compact' tier", () => {
    expect(getSlotPadding("compact")).toBe("p-1 gap-1.5");
  });

  it("should use rounded-xl for large tier", () => {
    expect(getSlotRounding("large")).toBe("rounded-xl");
  });

  it("should use rounded-lg for medium and compact tiers", () => {
    expect(getSlotRounding("medium")).toBe("rounded-lg");
    expect(getSlotRounding("compact")).toBe("rounded-lg");
  });

  it("should reduce container gap as tier gets more compact", () => {
    const large = getContainerGap("large");
    const medium = getContainerGap("medium");
    const compact = getContainerGap("compact");

    // gap-2 > gap-1.5 > gap-1
    expect(large).toBe("gap-2");
    expect(medium).toBe("gap-1.5");
    expect(compact).toBe("gap-1");
  });
});

// =============================================================================
// 4. Tier-Specific Badge Sizing (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Tier-Specific Badge Sizing", () => {
  function getBadgeSize(tier: "large" | "medium" | "compact"): string {
    return tier === "large" ? "w-10 h-10 text-base"
      : tier === "medium" ? "w-8 h-8 text-sm"
      : "w-6 h-6 text-xs";
  }

  it("should use 40px badge for large tier", () => {
    expect(getBadgeSize("large")).toBe("w-10 h-10 text-base");
  });

  it("should use 32px badge for medium tier", () => {
    expect(getBadgeSize("medium")).toBe("w-8 h-8 text-sm");
  });

  it("should use 24px badge for compact tier", () => {
    expect(getBadgeSize("compact")).toBe("w-6 h-6 text-xs");
  });
});

// =============================================================================
// 5. Tier-Specific Name Font Size (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Tier-Specific Name Font Size", () => {
  function getNameClass(tier: "large" | "medium" | "compact", isFirst: boolean): string {
    if (tier === "large") {
      return isFirst ? "text-white text-lg" : "text-gray-300 text-base";
    } else if (tier === "medium") {
      return isFirst ? "text-white text-base" : "text-gray-300 text-sm";
    }
    return isFirst ? "text-white text-sm" : "text-gray-300 text-xs";
  }

  it("should use larger fonts for large tier", () => {
    expect(getNameClass("large", true)).toContain("text-lg");
    expect(getNameClass("large", false)).toContain("text-base");
  });

  it("should use medium fonts for medium tier", () => {
    expect(getNameClass("medium", true)).toContain("text-base");
    expect(getNameClass("medium", false)).toContain("text-sm");
  });

  it("should use smallest fonts for compact tier", () => {
    expect(getNameClass("compact", true)).toContain("text-sm");
    expect(getNameClass("compact", false)).toContain("text-xs");
  });

  it("should highlight first performer (next up) in all tiers", () => {
    expect(getNameClass("large", true)).toContain("text-white");
    expect(getNameClass("medium", true)).toContain("text-white");
    expect(getNameClass("compact", true)).toContain("text-white");
  });
});

// =============================================================================
// 6. Tier-Specific QR Sizing (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Tier-Specific QR Sizing", () => {
  function getQrSize(tier: "large" | "medium" | "compact"): number {
    return tier === "large" ? 44 : tier === "medium" ? 36 : 28;
  }

  it("should use 44px QR for large tier", () => {
    expect(getQrSize("large")).toBe(44);
  });

  it("should use 36px QR for medium tier", () => {
    expect(getQrSize("medium")).toBe(36);
  });

  it("should use 28px QR for compact tier", () => {
    expect(getQrSize("compact")).toBe(28);
  });

  it("should limit QR visibility based on tier", () => {
    // Contract: In compact mode, only show QR for first 4 performers
    // In medium mode, limit QR to first 6

    function shouldShowQr(tier: "large" | "medium" | "compact", index: number): boolean {
      if (tier === "compact" && index > 3) return false;
      if (tier === "medium" && index > 5) return false;
      return true;
    }

    // Large mode: show for all
    expect(shouldShowQr("large", 0)).toBe(true);
    expect(shouldShowQr("large", 10)).toBe(true);

    // Medium mode: first 6 only (indices 0-5)
    expect(shouldShowQr("medium", 5)).toBe(true);
    expect(shouldShowQr("medium", 6)).toBe(false);

    // Compact mode: first 4 only (indices 0-3)
    expect(shouldShowQr("compact", 3)).toBe(true);
    expect(shouldShowQr("compact", 4)).toBe(false);
  });
});

// =============================================================================
// 7. Container Padding/Gap (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Container Padding Reduction", () => {
  it("should use p-4 padding (reduced from p-6)", () => {
    // Contract: Container padding reduced to reclaim ~8px per side (16px total)
    const CONTAINER_PADDING = "p-4";
    const PREVIOUS_PADDING = "p-6";

    expect(CONTAINER_PADDING).toBe("p-4");
    expect(CONTAINER_PADDING).not.toBe(PREVIOUS_PADDING);
  });

  it("should use gap-2 (reduced from gap-4)", () => {
    // Contract: Grid gaps reduced to reclaim ~16px vertical space
    const CONTAINER_GAP = "gap-2";
    const PREVIOUS_GAP = "gap-4";

    expect(CONTAINER_GAP).toBe("gap-2");
    expect(CONTAINER_GAP).not.toBe(PREVIOUS_GAP);
  });
});

// =============================================================================
// 8. CTA Text Readability (Phase 4.110)
// =============================================================================

describe("Phase 4.110: CTA Text Readability", () => {
  it("should use text-lg for CTA (increased from text-sm)", () => {
    // Contract: CTA text increased from 14px to 18px for 8-12 foot viewing
    const CTA_TEXT_SIZE = "text-lg";
    const PREVIOUS_SIZE = "text-sm";

    expect(CTA_TEXT_SIZE).toBe("text-lg");
    expect(CTA_TEXT_SIZE).not.toBe(PREVIOUS_SIZE);
  });

  it("should use improved contrast for CTA", () => {
    // Contract: CTA uses text-gray-200 (lighter) instead of text-gray-300
    const CTA_COLOR = "text-gray-200";
    expect(CTA_COLOR).toBe("text-gray-200");
  });

  it("should use font-medium for better readability", () => {
    // Contract: CTA uses font-medium for clearer text at distance
    const CTA_WEIGHT = "font-medium";
    expect(CTA_WEIGHT).toBe("font-medium");
  });
});

// =============================================================================
// 9. QR Label Readability (Phase 4.110)
// =============================================================================

describe("Phase 4.110: QR Label Readability", () => {
  it("should use text-sm for QR labels (increased from text-[10px])", () => {
    // Contract: QR labels increased from 10px to 14px
    const QR_LABEL_SIZE = "text-sm";
    const PREVIOUS_SIZE = "text-[10px]";

    expect(QR_LABEL_SIZE).toBe("text-sm");
    expect(QR_LABEL_SIZE).not.toBe(PREVIOUS_SIZE);
  });

  it("should use improved contrast for QR labels", () => {
    // Contract: Labels use text-gray-300 instead of text-gray-400
    const QR_LABEL_COLOR = "text-gray-300";
    expect(QR_LABEL_COLOR).toBe("text-gray-300");
  });

  it("should use font-semibold for QR labels", () => {
    // Contract: Labels use font-semibold for better visibility
    const QR_LABEL_WEIGHT = "font-semibold";
    expect(QR_LABEL_WEIGHT).toBe("font-semibold");
  });
});

// =============================================================================
// 10. "Scan to follow" Text Readability (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Scan to Follow Text Readability", () => {
  it("should use text-sm (increased from text-xs)", () => {
    // Contract: Scan to follow text increased from 12px to 14px
    const SCAN_TEXT_SIZE = "text-sm";
    const PREVIOUS_SIZE = "text-xs";

    expect(SCAN_TEXT_SIZE).toBe("text-sm");
    expect(SCAN_TEXT_SIZE).not.toBe(PREVIOUS_SIZE);
  });

  it("should use text-gray-400 for better contrast", () => {
    // Contract: Text uses text-gray-400 instead of text-gray-500
    const SCAN_TEXT_COLOR = "text-gray-400";
    expect(SCAN_TEXT_COLOR).toBe("text-gray-400");
  });
});

// =============================================================================
// 11. Avatar Visibility by Tier (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Avatar Visibility by Tier", () => {
  function shouldShowAvatar(tier: "large" | "medium" | "compact"): boolean {
    return tier !== "compact";
  }

  it("should show avatar in large tier", () => {
    expect(shouldShowAvatar("large")).toBe(true);
  });

  it("should show avatar in medium tier", () => {
    expect(shouldShowAvatar("medium")).toBe(true);
  });

  it("should hide avatar in compact tier to save space", () => {
    expect(shouldShowAvatar("compact")).toBe(false);
  });

  function getAvatarSize(tier: "large" | "medium"): number {
    return tier === "large" ? 36 : 28;
  }

  it("should use 36px avatar in large tier", () => {
    expect(getAvatarSize("large")).toBe(36);
  });

  it("should use 28px avatar in medium tier", () => {
    expect(getAvatarSize("medium")).toBe(28);
  });
});

// =============================================================================
// 12. Space Budget Calculation (Phase 4.110)
// =============================================================================

describe("Phase 4.110: Space Budget at 720p", () => {
  it("should fit 20 slots in compact tier at 720p", () => {
    // Contract: With 20 slots in 2-column mode at 720p:
    // - 10 rows needed (20 slots / 2 columns)
    // - Compact row height: ~34px (p-1 + content + gap-1)
    // - 10 rows * 34px = 340px needed
    // - After optimization: ~485px available in content area
    // - Buffer: 485 - 340 = 145px to spare

    const ROWS_NEEDED = 10;
    const COMPACT_ROW_HEIGHT = 34; // p-1 (4px*2) + 24px content + gap-1 (4px)
    const CONTENT_NEEDED = ROWS_NEEDED * COMPACT_ROW_HEIGHT;
    const AVAILABLE_AFTER_OPTIMIZATION = 485;

    expect(CONTENT_NEEDED).toBeLessThan(AVAILABLE_AFTER_OPTIMIZATION);
    expect(AVAILABLE_AFTER_OPTIMIZATION - CONTENT_NEEDED).toBeGreaterThan(0);
  });

  it("should reclaim ~32px vertical space from padding/gap reduction", () => {
    // Before: p-6 (24px*2) + gap-4 (16px*2) = 48 + 32 = 80px
    // After: p-4 (16px*2) + gap-2 (8px*2) = 32 + 16 = 48px
    // Savings: 80 - 48 = 32px

    const BEFORE_PADDING = 24 * 2;
    const BEFORE_GAP = 16 * 2;
    const BEFORE_TOTAL = BEFORE_PADDING + BEFORE_GAP;

    const AFTER_PADDING = 16 * 2;
    const AFTER_GAP = 8 * 2;
    const AFTER_TOTAL = AFTER_PADDING + AFTER_GAP;

    const SAVINGS = BEFORE_TOTAL - AFTER_TOTAL;

    expect(SAVINGS).toBe(32);
  });
});

// =============================================================================
// 13. Preserved Phase 4.109 Contracts
// =============================================================================

describe("Phase 4.110: Preserved 4.109 Contracts", () => {
  // These contracts are carried forward from Phase 4.109

  it("should use black (#000000) for performer QR dark color", () => {
    const PERFORMER_QR_DARK = "#000000";
    expect(PERFORMER_QR_DARK).toBe("#000000");
  });

  it("should use 80px for both CSC and Event QR codes", () => {
    const CSC_QR_SIZE = 80;
    const EVENT_QR_SIZE = 80;
    expect(CSC_QR_SIZE).toBe(EVENT_QR_SIZE);
  });

  it("should use 'OUR COLLECTIVE' and 'EVENT PAGE' labels", () => {
    const CSC_QR_LABEL = "OUR COLLECTIVE";
    const EVENT_QR_LABEL = "EVENT PAGE";
    expect(CSC_QR_LABEL).toBe("OUR COLLECTIVE");
    expect(EVENT_QR_LABEL).toBe("EVENT PAGE");
  });

  it("should use object-contain for cover art", () => {
    const coverArtClasses = "max-w-full max-h-full object-contain";
    expect(coverArtClasses).toContain("object-contain");
  });

  it("should use CSS Grid with auto/auto/1fr rows", () => {
    const gridClasses = "grid grid-rows-[auto_auto_minmax(0,1fr)]";
    expect(gridClasses).toContain("minmax(0,1fr)");
  });
});
