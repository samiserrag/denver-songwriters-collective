import EmptyState from "./EmptyState";

export default function EmptySongwriters() {
  return (
    <EmptyState
      icon="🎸"
      title="No songwriters yet"
      subtitle="Be among the first to join The Colorado Songwriters Collective community. Share your music, connect with other songwriters!"
      ctaText="Join the Community"
      ctaHref="/signup"
    />
  );
}
