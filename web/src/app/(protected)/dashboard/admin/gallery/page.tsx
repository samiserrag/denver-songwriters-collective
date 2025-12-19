import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import GalleryAdminTabs from "./GalleryAdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminGalleryPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return (
      <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Admin privileges required.</p>
      </div>
    );
  }

  // Fetch all images with related data
  const { data: images } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_approved,
      is_featured,
      created_at,
      album_id,
      uploader:profiles!gallery_images_uploaded_by_fkey(id, full_name),
      event:events(id, title),
      venue:venues(id, name)
    `)
    .order("created_at", { ascending: false });

  // Fetch all albums
  const { data: albums } = await supabase
    .from("gallery_albums")
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      is_published,
      created_at
    `)
    .order("created_at", { ascending: false });

  // Fetch venues for dropdowns
  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .order("name");

  // Fetch events for dropdowns
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .order("title");

  const pendingCount = images?.filter((img) => !img.is_approved).length ?? 0;

  return (
    <div className="min-h-screen w-full px-6 py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-[var(--color-text-accent)] mb-2">Gallery Management</h1>
          <p className="text-[var(--color-text-secondary)]">
            Manage photos and albums.
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                {pendingCount} pending approval
              </span>
            )}
          </p>
        </div>
      </div>

      <GalleryAdminTabs
        images={images ?? []}
        albums={albums ?? []}
        venues={venues ?? []}
        events={events ?? []}
        userId={user.id}
      />
    </div>
  );
}
