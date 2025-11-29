import { SkeletonTable } from "@/components/skeletons";

export default function LoadingAdminPerformers() {
  return <SkeletonTable columns={4} rows={10} />;
}
