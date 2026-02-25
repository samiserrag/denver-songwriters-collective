import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Upload a cover image to the event-images bucket and create an event_images row.
 *
 * Storage path: `{eventId}/{uuid}.{ext}`
 * On insert failure, the storage object is removed (compensating transaction).
 *
 * Extracted from EventForm.tsx to share between EventForm and interpreter lab flows.
 */
export async function uploadCoverForEvent({
  supabase,
  eventId,
  file,
  userId,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  eventId: string;
  file: File;
  userId: string;
}): Promise<string> {
  const fileExt = file.name.split(".").pop() || "jpg";
  const storagePath = `${eventId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("event-images")
    .upload(storagePath, file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("event-images").getPublicUrl(storagePath);

  const { error: insertError } = await supabase
    .from("event_images")
    .insert({
      event_id: eventId,
      image_url: publicUrl,
      storage_path: storagePath,
      uploaded_by: userId,
    });

  if (insertError) {
    await supabase.storage.from("event-images").remove([storagePath]);
    throw insertError;
  }

  return publicUrl;
}

/**
 * Soft-delete the event_images row matching a given cover URL.
 * Sets deleted_at = now() without removing the storage object.
 */
export async function softDeleteCoverImageRow(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  eventId: string,
  imageUrl: string
): Promise<void> {
  const normalizedUrl = imageUrl.split("?")[0];
  const { error } = await supabase
    .from("event_images")
    .update({ deleted_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .eq("image_url", normalizedUrl)
    .is("deleted_at", null);

  if (error) {
    console.error("Failed to soft-delete previous cover image row:", error);
  }
}
