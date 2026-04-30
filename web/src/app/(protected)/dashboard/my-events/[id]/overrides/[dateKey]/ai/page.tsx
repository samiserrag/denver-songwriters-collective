import { notFound, redirect } from "next/navigation";
import ConversationalCreateUI from "../../../../_components/ConversationalCreateUI";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Occurrence With AI | CSC",
};

interface PageProps {
  params: Promise<{ id: string; dateKey: string }>;
}

export default async function AIOccurrenceEditPage({ params }: PageProps) {
  const { id: eventId, dateKey } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser },
    error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  const { data: event, error } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) notFound();

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) redirect("/dashboard");

  return (
    <ConversationalCreateUI
      variant="host"
      initialMode="edit_occurrence"
      initialEventId={eventId}
      initialDateKey={dateKey}
      allowExistingEventWrites={false}
      pageTitle="Edit Occurrence With AI"
      pageDescription="Ask AI to draft updates for this occurrence. Changes are not saved automatically yet."
      backHref={`/dashboard/my-events/${eventId}/overrides/${dateKey}`}
      backLabel="Back to occurrence"
    />
  );
}
