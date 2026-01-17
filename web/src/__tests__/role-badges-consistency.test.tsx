import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  RoleBadges,
  getRoleBadges,
  getPrimaryRoleLabel,
  getPrimaryBadgeStyle,
} from "@/components/members/RoleBadges";

describe("getRoleBadges", () => {
  it("returns only Songwriter badge when songwriter-only", () => {
    const badges = getRoleBadges({ isSongwriter: true });

    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("songwriter");
    expect(badges[0].label).toBe("Songwriter");
  });

  it("returns only Happenings Host badge when host-only", () => {
    const badges = getRoleBadges({ isHost: true });

    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("host");
    expect(badges[0].label).toBe("Happenings Host");
  });

  it("returns only Fan badge when fan-only", () => {
    const badges = getRoleBadges({ isFan: true });

    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("fan");
    expect(badges[0].label).toBe("Fan");
  });

  it("returns badges in correct order for multi-role user", () => {
    // User with all roles
    const badges = getRoleBadges({
      isSongwriter: true,
      isHost: true,
      isVenueManager: true,
      isFan: true,
    });

    expect(badges).toHaveLength(4);
    // Order must be: Songwriter → Happenings Host → Venue Manager → Fan
    expect(badges[0].key).toBe("songwriter");
    expect(badges[1].key).toBe("host");
    expect(badges[2].key).toBe("venue-manager");
    expect(badges[3].key).toBe("fan");
  });

  it("includes Venue Manager badge when isVenueManager is true", () => {
    const badges = getRoleBadges({ isVenueManager: true });

    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("venue-manager");
    expect(badges[0].label).toBe("Venue Manager");
  });

  it("does not include Venue Manager badge when isVenueManager is false", () => {
    const badges = getRoleBadges({
      isSongwriter: true,
      isVenueManager: false,
    });

    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("songwriter");
    expect(badges.find((b) => b.key === "venue-manager")).toBeUndefined();
  });

  it("handles legacy role field for backward compatibility", () => {
    // Legacy "performer" role should be treated as songwriter
    const performerBadges = getRoleBadges({ role: "performer" });
    expect(performerBadges).toHaveLength(1);
    expect(performerBadges[0].key).toBe("songwriter");

    // Legacy "host" role
    const hostBadges = getRoleBadges({ role: "host" });
    expect(hostBadges).toHaveLength(1);
    expect(hostBadges[0].key).toBe("host");

    // Legacy "fan" role
    const fanBadges = getRoleBadges({ role: "fan" });
    expect(fanBadges).toHaveLength(1);
    expect(fanBadges[0].key).toBe("fan");
  });

  it("returns empty array when no flags are set", () => {
    const badges = getRoleBadges({});
    expect(badges).toHaveLength(0);
  });
});

describe("getPrimaryRoleLabel", () => {
  it("returns combined label for songwriter + host", () => {
    expect(getPrimaryRoleLabel({ isSongwriter: true, isHost: true })).toBe(
      "Songwriter & Host"
    );
  });

  it("returns Songwriter for songwriter-only", () => {
    expect(getPrimaryRoleLabel({ isSongwriter: true })).toBe("Songwriter");
  });

  it("returns Happenings Host for host-only", () => {
    expect(getPrimaryRoleLabel({ isHost: true })).toBe("Happenings Host");
  });

  it("returns Venue Manager for venue-manager-only", () => {
    expect(getPrimaryRoleLabel({ isVenueManager: true })).toBe("Venue Manager");
  });

  it("returns Fan for fan-only", () => {
    expect(getPrimaryRoleLabel({ isFan: true })).toBe("Fan");
  });

  it("returns Member when no flags set", () => {
    expect(getPrimaryRoleLabel({})).toBe("Member");
  });
});

describe("getPrimaryBadgeStyle", () => {
  it("returns accent style for songwriter", () => {
    const style = getPrimaryBadgeStyle({ isSongwriter: true });
    expect(style).toContain("color-accent-primary");
  });

  it("returns emerald style for host-only", () => {
    const style = getPrimaryBadgeStyle({ isHost: true });
    expect(style).toContain("emerald");
  });

  it("returns purple style for venue-manager-only", () => {
    const style = getPrimaryBadgeStyle({ isVenueManager: true });
    expect(style).toContain("purple");
  });

  it("returns blue style for fan-only", () => {
    const style = getPrimaryBadgeStyle({ isFan: true });
    expect(style).toContain("blue");
  });
});

describe("RoleBadges component", () => {
  it("renders all badges in row mode", () => {
    render(
      <RoleBadges
        flags={{ isSongwriter: true, isHost: true, isVenueManager: true }}
        mode="row"
      />
    );

    expect(screen.getByText("Songwriter")).toBeInTheDocument();
    expect(screen.getByText("Happenings Host")).toBeInTheDocument();
    expect(screen.getByText("Venue Manager")).toBeInTheDocument();
  });

  it("renders single combined badge in single mode", () => {
    render(
      <RoleBadges
        flags={{ isSongwriter: true, isHost: true }}
        mode="single"
      />
    );

    expect(screen.getByText("Songwriter & Host")).toBeInTheDocument();
    // Should NOT show separate badges
    expect(screen.queryByText("Songwriter")).not.toBeInTheDocument();
    expect(screen.queryByText("Happenings Host")).not.toBeInTheDocument();
  });

  it("renders nothing when no flags are set in row mode", () => {
    const { container } = render(<RoleBadges flags={{}} mode="row" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Member badge in single mode when no flags set", () => {
    render(<RoleBadges flags={{}} mode="single" />);
    expect(screen.getByText("Member")).toBeInTheDocument();
  });
});
