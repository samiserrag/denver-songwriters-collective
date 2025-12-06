import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/event-update-suggestions", () => {
  it("rejects when required fields are missing", async () => {
    const req = new Request("http://localhost/api/event-update-suggestions", {
      method: "POST",
      body: JSON.stringify({ new_value: "Test only" }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("required");
  });
});
