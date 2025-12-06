import EmptyState from "./EmptyState";

export default function EmptyAppointments() {
  return (
    <EmptyState
      icon="📅"
      title="No appointments yet"
      subtitle="Ready to record? Browse our partner studios and book your first session."
      ctaText="Browse Studios"
      ctaHref="/studios"
    />
  );
}
