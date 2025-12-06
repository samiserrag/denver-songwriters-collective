import EmptyState from "./EmptyState";

export default function EmptyPerformers() {
  return (
    <EmptyState
      icon="🎸"
      title="No artists yet"
      subtitle="Be among the first to join The Denver Songwriters Collective community. Share your music, connect with other songwriters!"
      ctaText="Join the Community"
      ctaHref="/signup"
    />
  );
}
