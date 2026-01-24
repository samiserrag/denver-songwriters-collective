import { redirect } from "next/navigation";

/**
 * Legacy admin event edit page — redirects to canonical EventForm.
 *
 * The canonical per-event editor is /dashboard/my-events/[id] which supports
 * all roles (admin, host, owner) and all features (occurrence overrides,
 * series controls, full field set). This redirect prevents admin users from
 * accidentally using the legacy EventEditForm.
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEventPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/dashboard/my-events/${id}`);
}
