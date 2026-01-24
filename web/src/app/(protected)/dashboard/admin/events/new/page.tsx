import { redirect } from "next/navigation";

/**
 * Legacy admin event create page — redirects to canonical create form.
 *
 * The canonical create form is /dashboard/my-events/new which supports
 * all roles and features. This redirect prevents bookmark/history drift.
 */
export default function NewEventPage() {
  redirect("/dashboard/my-events/new");
}
