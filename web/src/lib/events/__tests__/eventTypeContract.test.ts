import { describe, expect, it } from "vitest";
import { getInvalidEventTypes, normalizeIncomingEventTypes } from "@/lib/events/eventTypeContract";

describe("eventTypeContract", () => {
  it("normalizes meeting variants to meetup", () => {
    const normalized = normalizeIncomingEventTypes(["meeting", "meet up", "Meetings", "meetup"]);
    expect(normalized).toEqual(["meetup"]);
  });

  it("normalizes spacing and hyphen variants to canonical snake_case", () => {
    const normalized = normalizeIncomingEventTypes(["open mic", "jam-session", "Song Circle"]);
    expect(normalized).toEqual(["open_mic", "jam_session", "song_circle"]);
  });

  it("maps common conversational aliases used by AI/user text", () => {
    const normalized = normalizeIncomingEventTypes([
      "open mike",
      "concert",
      "live music",
      "stand-up",
      "poetry night",
      "kindred group",
    ]);

    expect(normalized).toEqual(["open_mic", "gig", "comedy", "poetry", "other"]);
  });

  it("returns invalid normalized values when outside valid enum", () => {
    const invalid = getInvalidEventTypes(["meeting", "open mic", "bad type"]);
    expect(invalid).toEqual(["bad_type"]);
  });
});
