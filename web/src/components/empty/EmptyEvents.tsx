import EmptyState from "./EmptyState";

export default function EmptyEvents() {
  return (
    <EmptyState
      icon="🎤"
      title="No Events Found"
      subtitle="There are no upcoming events right now. Check back soon!"
      ctaText="Browse Performers"
      ctaHref="/performers"
    />
  );
}
