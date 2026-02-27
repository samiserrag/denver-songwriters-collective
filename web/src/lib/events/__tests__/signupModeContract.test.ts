import { describe, expect, it } from "vitest";
import { normalizeSignupMode, isValidSignupMode } from "@/lib/events/signupModeContract";

describe("signupModeContract", () => {
  it("accepts DB-valid signup modes", () => {
    expect(normalizeSignupMode("walk_in")).toBe("walk_in");
    expect(normalizeSignupMode("in_person")).toBe("in_person");
    expect(normalizeSignupMode("online")).toBe("online");
    expect(normalizeSignupMode("both")).toBe("both");
  });

  it("maps interpreter aliases to null for internal RSVP semantics", () => {
    expect(normalizeSignupMode("rsvp")).toBeNull();
    expect(normalizeSignupMode("platform")).toBeNull();
    expect(normalizeSignupMode("not specified")).toBeNull();
  });

  it("maps in-person aliases to in_person", () => {
    expect(normalizeSignupMode("in person")).toBe("in_person");
    expect(normalizeSignupMode("signup at venue")).toBe("in_person");
  });

  it("rejects unknown values to null instead of passing invalid enum values", () => {
    expect(normalizeSignupMode("foobar")).toBeNull();
    expect(normalizeSignupMode("")).toBeNull();
    expect(normalizeSignupMode(null)).toBeNull();
  });

  it("validates only allowed enum values", () => {
    expect(isValidSignupMode("walk_in")).toBe(true);
    expect(isValidSignupMode("rsvp")).toBe(false);
    expect(isValidSignupMode("platform")).toBe(false);
  });
});
