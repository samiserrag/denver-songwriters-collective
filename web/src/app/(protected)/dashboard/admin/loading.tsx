import { SkeletonTextBlock } from "@/components/skeletons";

export default function LoadingAdminDashboard() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <SkeletonTextBlock lines={3} />
    </div>
  );
}
