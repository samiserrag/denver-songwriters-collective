import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Occurrence Overrides | Admin",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Admin overrides page — redirects to canonical host overrides page.
 *
 * The canonical occurrence editor lives at /dashboard/my-events/[id]/overrides
 * and already supports admins (via checkAdminRole in the API route + page auth).
 * This redirect ensures a single source of truth for occurrence editing.
 */
export default async function AdminOverridesRedirectPage({ params }: PageProps) {
  const { id: eventId } = await params;
  redirect(`/dashboard/my-events/${eventId}/overrides`);
}
