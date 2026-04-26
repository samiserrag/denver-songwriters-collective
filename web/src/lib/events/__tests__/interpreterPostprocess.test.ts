import { describe, expect, it } from "vitest";
import {
  applyTimeSemantics,
  applyVenueTypeTitleDefault,
} from "@/lib/events/interpreterPostprocess";

describe("interpreter postprocess utilities", () => {
  it("separates sign-up time from public performance start time", () => {
    const draft: Record<string, unknown> = {
      start_time: "18:00:00",
      end_time: null,
    };

    applyTimeSemantics(
      draft,
      "6:00PM - SIGN UP\n6:30PM-9:00PM PERFORMANCES"
    );

    expect(draft.signup_time).toBe("18:00:00");
    expect(draft.start_time).toBe("18:30:00");
    expect(draft.end_time).toBe("21:00:00");
  });

  it("defaults generic open mic titles to Venue - Open Mic", () => {
    const draft: Record<string, unknown> = {
      title: "Open Mic",
      event_type: ["open_mic"],
      venue_name: "Fellow Traveler",
    };

    applyVenueTypeTitleDefault(draft);

    expect(draft.title).toBe("Fellow Traveler - Open Mic");
  });

  it("normalizes venue-plus-generic open mic titles", () => {
    const draft: Record<string, unknown> = {
      title: "The Ethos Open Mic Night",
      event_type: ["open_mic", "poetry", "comedy"],
      custom_location_name: "Ethos",
    };

    applyVenueTypeTitleDefault(draft);

    expect(draft.title).toBe("Ethos - Open Mic");
  });

  it("preserves distinct named events", () => {
    const draft: Record<string, unknown> = {
      title: "Jam&Slam",
      event_type: ["open_mic", "poetry"],
      venue_name: "Hooked on Colfax",
    };

    applyVenueTypeTitleDefault(draft);

    expect(draft.title).toBe("Jam&Slam");
  });
});
