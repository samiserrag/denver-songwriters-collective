import { SkeletonTable } from "@/components/skeletons";

export default function LoadingAdminStudios() {
  return <SkeletonTable columns={4} rows={10} />;
}
