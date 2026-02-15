import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AlbumManager from "./AlbumManager";
import { readMediaEmbeds } from "@/lib/mediaEmbedsServer";

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
      youtube_url,
      spotify_url,
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

  // Check permissions: must be album owner, admin, or accepted collaborator
  const isOwner = album.created_by === userId;

  // Check if user is an accepted collaborator via gallery_album_links
  let isCollaborator = false;
  if (!isOwner && !isAdmin) {
    const { data: collabLink } = await supabase
      .from("gallery_album_links")
      .select("album_id")
      .eq("album_id", id)
      .eq("target_type", "profile")
      .eq("target_id", userId)
      .eq("link_role", "collaborator")
      .maybeSingle();
    isCollaborator = !!collabLink;
  }

  if (!isOwner && !isAdmin && !isCollaborator) {
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
            ← Back to My Albums
          </Link>
        </div>
      </main>
    );
  }

  // Fetch images, ordered media embeds, venues, events, and existing collaborator links
  const [{ data: images }, embeds, { data: venues }, { data: events }, { data: existingLinks }] = await Promise.all([
    supabase
      .from("gallery_images")
      .select(`
        id,
        image_url,
        caption,
        is_published,
        is_hidden,
        sort_order,
        created_at,
        uploaded_by
      `)
      .eq("album_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    readMediaEmbeds(supabase, { type: "gallery_album", id }),
    supabase
      .from("venues")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("events")
      .select("id, title, event_date")
      .eq("status", "published")
      .order("event_date", { ascending: false }),
    supabase
      .from("gallery_album_links")
      .select("target_type, target_id, link_role")
      .eq("album_id", id),
  ]);
  const mediaEmbedUrls = embeds.map((e) => e.url);

  // Extract collaborators from TWO sources:
  // 1. Accepted collaborator links in gallery_album_links (legacy + accepted invites)
  // 2. Pending/accepted invites in gallery_collaboration_invites (opt-in flow)
  const collaboratorLinkIds = (existingLinks ?? [])
    .filter((l) => l.target_type === "profile" && l.link_role === "collaborator")
    .map((l) => l.target_id);

  const { data: inviteRows } = await (supabase as any)
    .from("gallery_collaboration_invites")
    .select("invitee_id")
    .eq("album_id", id)
    .in("status", ["pending", "accepted"]);
  const inviteIds = (inviteRows ?? []).map((r: { invitee_id: string }) => r.invitee_id);

  // Merge and deduplicate
  const allCollaboratorIds = [...new Set([...collaboratorLinkIds, ...inviteIds])];

  // Fetch collaborator profile details for the chips
  let initialCollaborators: Array<{ id: string; name: string; avatar_url: string | null }> = [];
  if (allCollaboratorIds.length > 0) {
    const { data: collabProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", allCollaboratorIds);
    initialCollaborators = (collabProfiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      avatar_url: p.avatar_url,
    }));
  }

  // Extract existing venue and event links
  const existingVenueId = (existingLinks ?? []).find(
    (l) => l.target_type === "venue" && l.link_role === "venue"
  )?.target_id ?? null;
  const existingEventId = (existingLinks ?? []).find(
    (l) => l.target_type === "event" && l.link_role === "event"
  )?.target_id ?? null;

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/gallery"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm mb-2 inline-block"
          >
            ← Back to My Albums
          </Link>
          <h1 className="font-[var(--font-family-serif)] text-3xl text-[var(--color-text-primary)]">
            Manage Album
          </h1>
        </div>

        <AlbumManager
          album={album}
          images={images ?? []}
          isAdmin={isAdmin}
          isCollaborator={isCollaborator}
          currentUserId={userId}
          mediaEmbedUrls={mediaEmbedUrls}
          venues={venues ?? []}
          events={(events ?? []) as Array<{ id: string; title: string; event_date: string | null }>}
          initialVenueId={existingVenueId}
          initialEventId={existingEventId}
          initialCollaborators={initialCollaborators}
        />
      </div>
    </main>
  );
}
