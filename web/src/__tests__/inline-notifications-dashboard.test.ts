/**
 * Tests: Inline notification manager on dashboard
 *
 * Verifies:
 * 1. Dashboard renders NotificationsList without compact prop
 * 2. Dashboard passes full pagination props (initialCursor, initialTotal)
 * 3. Separate notifications page no longer exists
 * 4. Sidebar nav does not link to /dashboard/notifications
 * 5. NotificationsList has no compact prop in its interface
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Inline Notifications on Dashboard", () => {
  const dashboardPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/page.tsx"
  );
  const dashboardContent = fs.readFileSync(dashboardPath, "utf-8");

  it("should render NotificationsList without compact prop", () => {
    // Must contain NotificationsList usage
    expect(dashboardContent).toContain("<NotificationsList");
    // Must NOT pass compact prop
    expect(dashboardContent).not.toMatch(/NotificationsList[\s\S]*?compact/);
  });

  it("should pass initialCursor and initialTotal for pagination", () => {
    expect(dashboardContent).toContain("initialCursor={notificationCursor}");
    expect(dashboardContent).toContain("initialTotal={notificationCount || 0}");
  });

  it("should query notifications with count and limit 50", () => {
    expect(dashboardContent).toContain('count: "exact"');
    expect(dashboardContent).toContain(".limit(50)");
  });

  it("should not link to a separate notifications page", () => {
    expect(dashboardContent).not.toContain('href="/dashboard/notifications"');
    expect(dashboardContent).not.toContain("Manage all");
  });
});

describe("Separate Notifications Page Removed", () => {
  it("should not have a standalone notifications page.tsx", () => {
    const pagePath = path.join(
      __dirname,
      "../app/(protected)/dashboard/notifications/page.tsx"
    );
    expect(fs.existsSync(pagePath)).toBe(false);
  });
});

describe("NotificationsList — No Compact Mode", () => {
  const listPath = path.join(
    __dirname,
    "../app/(protected)/dashboard/notifications/NotificationsList.tsx"
  );
  const listContent = fs.readFileSync(listPath, "utf-8");

  it("should not have compact in its props interface", () => {
    expect(listContent).not.toContain("compact");
  });

  it("should always render filter controls", () => {
    expect(listContent).toContain("NOTIFICATION_TYPES");
    expect(listContent).toContain("handleTypeFilterChange");
    expect(listContent).toContain("handleMarkAllRead");
  });

  it("should always render load more button", () => {
    expect(listContent).toContain("loadMore");
    expect(listContent).toContain("Load more");
  });
});

describe("Sidebar Nav — No Notifications Link", () => {
  const sidebarPath = path.join(
    __dirname,
    "../components/navigation/DashboardSidebar.tsx"
  );
  const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

  it("should not have a notifications nav item", () => {
    expect(sidebarContent).not.toContain("/dashboard/notifications");
  });

  it("should still have other main nav items", () => {
    expect(sidebarContent).toContain("/dashboard/my-events");
    expect(sidebarContent).toContain("/dashboard/gallery");
    expect(sidebarContent).toContain("/dashboard/profile");
    expect(sidebarContent).toContain("/dashboard/settings");
  });
});
