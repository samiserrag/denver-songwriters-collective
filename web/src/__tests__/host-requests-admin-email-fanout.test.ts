import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf-8");
const source = read("app/api/host-requests/route.ts");

describe("Host request admin email fanout", () => {
  it("resolves admin recipients from admin profiles", () => {
    expect(source).toContain("async function resolveAdminRecipients(");
    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.eq("role", "admin")');
  });

  it("sends notifications to all admin recipients", () => {
    expect(source).toContain("sendAdminEmailWithPreferences(");
    expect(source).toContain("Promise.allSettled");
    expect(source).toContain("adminEventClaimNotification");
  });

  it("keeps ADMIN_EMAIL fallback when fanout path fails", () => {
    expect(source).toContain("using fallback");
    expect(source).toContain("to: ADMIN_EMAIL");
    expect(source).toContain("Fallback host request email failed");
  });
});

