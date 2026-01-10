import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_COMMENT_LENGTH = 500;

// Map of valid table names to their foreign key and user ID columns
const TABLE_CONFIG: Record<string, { userIdColumn: string }> = {
  blog_comments: { userIdColumn: "author_id" },
  gallery_photo_comments: { userIdColumn: "user_id" },
  gallery_album_comments: { userIdColumn: "user_id" },
  profile_comments: { userIdColumn: "author_id" },
  event_comments: { userIdColumn: "user_id" },
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/comments/[id]
 *
 * Edit a comment's content. Only the comment author can edit their comment.
 * Sets edited_at timestamp when content is modified.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tableName, content } = body;

    // Validate table name
    if (!tableName || !TABLE_CONFIG[tableName]) {
      return NextResponse.json(
        { error: "Invalid table name" },
        { status: 400 }
      );
    }

    // Validate content
    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < 1) {
      return NextResponse.json(
        { error: "Comment cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      return NextResponse.json(
        { error: `Comment too long (max ${MAX_COMMENT_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin";

    const { userIdColumn } = TABLE_CONFIG[tableName];

    // Fetch the comment to verify ownership
    const { data: comment, error: fetchError } = await (supabase as any)
      .from(tableName)
      .select(`id, ${userIdColumn}, content, is_deleted, guest_email`)
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if comment is deleted
    if (comment.is_deleted) {
      return NextResponse.json(
        { error: "Cannot edit a deleted comment" },
        { status: 400 }
      );
    }

    // Verify ownership: author or admin can edit
    const authorId = comment[userIdColumn];
    const isAuthor = authorId === user.id;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      );
    }

    // Guest comments cannot be edited (no way to re-authenticate)
    if (comment.guest_email && !authorId) {
      return NextResponse.json(
        { error: "Guest comments cannot be edited" },
        { status: 403 }
      );
    }

    // If content hasn't changed, don't update edited_at
    if (comment.content === trimmedContent) {
      return NextResponse.json({
        success: true,
        comment: {
          id: comment.id,
          content: comment.content,
          edited_at: null,
        },
      });
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await (supabase as any)
      .from(tableName)
      .update({
        content: trimmedContent,
        edited_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, content, edited_at")
      .single();

    if (updateError) {
      console.error("Error updating comment:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Edit comment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
