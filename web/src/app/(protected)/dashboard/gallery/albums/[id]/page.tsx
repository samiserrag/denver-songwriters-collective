import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AlbumManager from "./AlbumManager";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: album } = await supabase
    .from("gallery_albums")
    .select("name")
    .eq("id", id)
    .single();

  return {
    title: album ? `Manage ${album.name} | CSC` : "Album Not Found | CSC",
  };
}

export default async function AlbumManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: sessionUser }, error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) redirect("/login");

  const userId = sessionUser.id;

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch the album
  const { data: album } = await supabase
    .from("gallery_albums")
    .select(`
      id,
      name,
      slug,
      description,
      cover_image_url,
      is_published,
      is_hidden,
      created_by,
      created_at
    `)
    .eq("id", id)
    .single();

  if (!album) {
    notFound();
  }

  // Check permissions: must be album owner or admin
  const isOwner = album.created_by === userId;
  if (!isOwner && !isAdmin) {
    return (
      <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            You don&apos;t have permission to manage this album.
          </p>
          <Link
            href="/dashboard/gallery"
            className="text-[var(--color-text-accent)] hover:underline mt-4 inline-block"
          >
            ← Back to My Photos
          </Link>
        </div>
      </main>
    );
  }

  // Fetch images in this album
  const { data: images } = await supabase
    .from("gallery_images")
    .select(`
      id,
      image_url,
      caption,
      is_published,
      is_hidden,
      sort_order,
      created_at
    `)
    .eq("album_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/gallery"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to My Photos
          </Link>
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)]">
            Manage Album
          </h1>
        </div>

        <AlbumManager
          album={album}
          images={images ?? []}
          isAdmin={isAdmin}
        />
      </div>
    </main>
  );
}
