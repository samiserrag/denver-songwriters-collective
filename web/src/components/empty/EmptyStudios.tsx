import EmptyState from "./EmptyState";

export default function EmptyStudios() {
  return (
    <EmptyState
      icon="🎧"
      title="No studios yet"
      subtitle="We're connecting with Denver's best recording studios. Check back soon or reach out if you're a studio owner!"
      ctaText="Get Involved"
      ctaHref="/get-involved"
    />
  );
}
