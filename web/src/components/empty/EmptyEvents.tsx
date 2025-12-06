import EmptyState from "./EmptyState";

export default function EmptyEvents() {
  return (
    <EmptyState
      icon="🎵"
      title="No events found"
      subtitle="We're always adding new events. Know of a songwriter event we're missing? Let us know!"
      ctaText="Submit an Event"
      ctaHref="/submit-open-mic"
    />
  );
}
