import { notFound, redirect } from "next/navigation";
import ConversationalCreateUI from "../../_components/ConversationalCreateUI";
import { canManageEvent } from "@/lib/events/eventManageAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Happening With AI | CSC",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AIEditEventPage({ params }: PageProps) {
  const { id: eventId } = await params;
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
      initialMode="edit_series"
      initialEventId={eventId}
      allowExistingEventWrites={false}
      pageTitle="Edit Happening With AI"
      pageDescription="Ask AI to draft updates for this happening. Changes are not saved automatically yet."
      backHref={`/dashboard/my-events/${eventId}`}
      backLabel="Back to happening"
    />
  );
}
