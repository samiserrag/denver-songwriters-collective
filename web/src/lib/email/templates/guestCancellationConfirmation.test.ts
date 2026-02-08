import { describe, it, expect } from "vitest";
import { getGuestCancellationConfirmationEmail } from "./guestCancellationConfirmation";

describe("getGuestCancellationConfirmationEmail", () => {
  it("renders RSVP cancellation confirmation copy", () => {
    const result = getGuestCancellationConfirmationEmail({
      guestName: "Sami",
      eventTitle: "Sloan Lake Song Circle / Jam",
      eventDate: "Sunday, February 8, 2026",
      eventTime: "12:30 PM",
      venueName: "Sloan Lake",
      venueAddress: "Denver, CO",
      eventUrl: "https://coloradosongwriterscollective.org/events/sloan-lake-song-circle-jam-2026-02-01?date=2026-02-08",
      kind: "rsvp",
    });

    expect(result.subject).toContain("Your RSVP was cancelled");
    expect(result.html).toContain("Cancellation complete.");
    expect(result.html).toContain("Sloan Lake Song Circle / Jam");
    expect(result.text).toContain("Your RSVP for Sloan Lake Song Circle / Jam has been cancelled.");
  });

  it("renders timeslot cancellation confirmation copy", () => {
    const result = getGuestCancellationConfirmationEmail({
      guestName: "Sami",
      eventTitle: "Sloan Lake Song Circle / Jam",
      eventDate: "Sunday, February 8, 2026",
      eventTime: "12:30 PM",
      kind: "timeslot",
    });

    expect(result.subject).toContain("slot claim was cancelled");
    expect(result.html).toContain("Your slot claim");
    expect(result.text).toContain("Cancellation complete.");
  });
});
