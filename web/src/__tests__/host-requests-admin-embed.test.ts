/**
 * Host Requests Admin — Embed + Error Handling Contracts
 *
 * Ensures the admin host-requests surface:
 * - Uses PostgREST embed against profiles
 * - Surfaces query failures (no silent empty state)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(__dirname, "..");

describe("Host Requests admin query", () => {
  const pageSource = fs.readFileSync(
    path.join(SRC_DIR, "app/(protected)/dashboard/admin/host-requests/page.tsx"),
    "utf-8"
  );
  const routeSource = fs.readFileSync(
    path.join(SRC_DIR, "app/api/admin/host-requests/route.ts"),
    "utf-8"
  );

  it("embeds profiles on host requests", () => {
    expect(pageSource).toContain("user:profiles");
    expect(routeSource).toContain("user:profiles");
  });

  it("surfaces host request query errors", () => {
    expect(pageSource).toContain("Host requests failed to load");
    expect(routeSource).toContain("Host requests query failed");
  });
});
