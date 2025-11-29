import EmptyState from "./EmptyState";

export default function EmptyAppointments() {
  return (
    <EmptyState
      icon="📅"
      title="No Appointments"
      subtitle="You haven't booked any studio sessions yet."
      ctaText="Browse Studios"
      ctaHref="/studios"
    />
  );
}
