import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTE_PATH = path.resolve(__dirname, "../app/api/events/interpret/route.ts");
const routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");

describe("interpret prompt date rules", () => {
  it("instructs the LLM that current_date is not a past date", () => {
    expect(routeSource).toContain("current_date itself is NOT a past date");
  });

  it("uses STRICTLY before phrasing for past-date check", () => {
    expect(routeSource).toContain("STRICTLY before current_date");
  });

  it("forbids advancing past the current year without explicit source year", () => {
    expect(routeSource).toContain("Do not advance a flyer's month/day past the current year");
  });
});
