import { SkeletonTable } from "@/components/skeletons";

export default function LoadingAppointments() {
  return (
    <div className="p-8">
      <SkeletonTable columns={4} rows={6} />
    </div>
  );
}
