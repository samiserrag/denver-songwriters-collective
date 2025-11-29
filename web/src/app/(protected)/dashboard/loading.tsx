import { SkeletonTextBlock } from "@/components/skeletons";

export default function LoadingDashboard() {
  return (
    <div className="px-6 py-20 max-w-3xl mx-auto">
      <SkeletonTextBlock lines={3} />
    </div>
  );
}
