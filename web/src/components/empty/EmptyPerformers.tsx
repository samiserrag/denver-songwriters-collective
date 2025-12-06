import EmptyState from "./EmptyState";

export default function EmptyPerformers() {
  return (
    <EmptyState
      icon="✨"
      title="No Performers Yet"
      subtitle="Be the first to join The Denver Songwriters Collective community."
      ctaText="Sign Up"
      ctaHref="/signup"
    />
  );
}
