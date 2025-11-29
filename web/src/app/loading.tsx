import { SkeletonTextBlock } from "@/components/skeletons";

export default function LoadingHomePage() {
  return (
    <div className="px-6 py-20 max-w-4xl mx-auto">
      <SkeletonTextBlock lines={3} />
    </div>
  );
}
