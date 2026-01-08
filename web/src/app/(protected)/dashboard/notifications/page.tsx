import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsList from "./NotificationsList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notifications | DSC"
};

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: notifications, count } = await supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Determine next cursor for pagination
  const nextCursor = notifications && notifications.length === 50
    ? notifications[notifications.length - 1].created_at
    : null;

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)] mb-8">Notifications</h1>
        <NotificationsList
          notifications={notifications || []}
          initialCursor={nextCursor}
          initialTotal={count || 0}
        />
      </div>
    </main>
  );
}
