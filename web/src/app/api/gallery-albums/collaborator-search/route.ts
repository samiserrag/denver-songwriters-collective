import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/gallery-albums/collaborator-search
 *
 * Search profiles by display_name for the collaborator multi-select.
 * Requires authenticated user. Returns up to 10 matches.
 *
 * Body: { search_name: string }
 * Response: { matches: Array<{ id: string; name: string; avatar_url: string | null }> }
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: sessionUser },
    error: sessionUserError,
  } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const searchName =
    typeof body.search_name === "string" ? body.search_name.trim() : "";

  if (!searchName || searchName.length < 2) {
    return NextResponse.json(
      { error: "Search query must be at least 2 characters." },
      { status: 400 }
    );
  }

  // Search profiles by full_name (case-insensitive partial match)
  // Same pattern as cohost search in /api/my-events/[id]/cohosts
  const searchTerm = `%${searchName}%`;
  const { data: profiles, error: searchError } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .ilike("full_name", searchTerm)
    .limit(10);

  if (searchError) {
    console.error("Collaborator search error:", searchError);
    return NextResponse.json(
      { error: "Failed to search members. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    matches: (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name,
      avatar_url: p.avatar_url,
    })),
  });
}
