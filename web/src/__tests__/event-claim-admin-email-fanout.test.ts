import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf-8");
const routeSource = read("app/api/events/[id]/claim/route.ts");

describe("Event claim admin email fanout", () => {
  it("resolves admin recipients from profiles with admin role", () => {
    expect(routeSource).toContain("async function resolveAdminRecipients(");
    expect(routeSource).toContain('.from("profiles")');
    expect(routeSource).toContain('.eq("role", "admin")');
  });

  it("sends host claim notification via preference-aware admin sender", () => {
    expect(routeSource).toContain("sendAdminEmailWithPreferences(");
    expect(routeSource).toContain('"adminEventClaimNotification"');
    expect(routeSource).toContain("Promise.allSettled");
  });

  it("retains ADMIN_EMAIL fallback delivery on failure", () => {
    expect(routeSource).toContain("using fallback");
    expect(routeSource).toContain("to: ADMIN_EMAIL");
    expect(routeSource).toContain("Fallback admin claim email failed");
  });
});

