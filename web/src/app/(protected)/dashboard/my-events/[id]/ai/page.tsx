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
    .select("id, slug, title, event_type, cover_image_url, is_published")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) notFound();

  const canManage = await canManageEvent(supabase, sessionUser.id, eventId);
  if (!canManage) redirect("/dashboard");

  const eventTypes = Array.isArray(event.event_type)
    ? event.event_type.filter((entry: unknown): entry is string => typeof entry === "string")
    : typeof event.event_type === "string"
      ? [event.event_type]
      : [];

  return (
    <ConversationalCreateUI
      variant="host"
      initialMode="edit_series"
      initialEventId={eventId}
      allowExistingEventWrites={false}
      allowExistingEventCoverUpload
      existingEventSnapshot={{
        eventId: event.id as string,
        slug: typeof event.slug === "string" ? event.slug : null,
        title: typeof event.title === "string" ? event.title : null,
        eventType: eventTypes,
        coverImageUrl:
          typeof event.cover_image_url === "string" ? event.cover_image_url : null,
        isPublished: event.is_published === true,
      }}
      pageTitle="Edit Happening With AI"
      pageDescription="Ask AI to draft updates for this happening. Cover swaps from your uploaded images apply immediately; other field changes still require manual confirmation."
      backHref={`/dashboard/my-events/${eventId}`}
      backLabel="Back to happening"
    />
  );
}
