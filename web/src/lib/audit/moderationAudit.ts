/**
 * Moderation Audit Logger
 *
 * Logs moderation actions for admin audit trail.
 * Server-side only - uses service role to bypass RLS.
 */

import { createClient } from "@supabase/supabase-js";

type ModerationAction =
  | "album_hidden"
  | "album_unhidden"
  | "album_published"
  | "album_unpublished"
  | "image_hidden"
  | "image_unhidden"
  | "comments_bulk_hidden"
  | "comments_bulk_unhidden"
  | "comment_deleted";

interface AuditContext {
  albumId?: string;
  albumName?: string;
  imageId?: string;
  commentCount?: number;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Log a moderation action to the app_logs table.
 * Uses service role to ensure logs are always written.
 */
export async function logModerationAction(
  action: ModerationAction,
  actorId: string,
  targetOwnerId: string | null,
  context: AuditContext = {}
): Promise<void> {
  // Server-side only
  if (typeof window !== "undefined") {
    console.warn("[ModerationAudit] Should only be called server-side");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[ModerationAudit] Missing Supabase environment variables");
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.from("app_logs").insert({
      level: "info",
      message: `Moderation: ${action}`,
      context: {
        action,
        actorId,
        targetOwnerId,
        ...context,
      },
      user_id: actorId,
      source: "moderation_audit",
    });
  } catch (err) {
    // Don't throw - just log to console
    console.error("[ModerationAudit] Failed to log action:", err);
  }
}

export const moderationAudit = {
  albumHidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("album_hidden", actorId, ownerId, ctx),

  albumUnhidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("album_unhidden", actorId, ownerId, ctx),

  albumPublished: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("album_published", actorId, ownerId, ctx),

  albumUnpublished: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("album_unpublished", actorId, ownerId, ctx),

  imageHidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("image_hidden", actorId, ownerId, ctx),

  imageUnhidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("image_unhidden", actorId, ownerId, ctx),

  commentsBulkHidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("comments_bulk_hidden", actorId, ownerId, ctx),

  commentsBulkUnhidden: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("comments_bulk_unhidden", actorId, ownerId, ctx),

  commentDeleted: (actorId: string, ownerId: string | null, ctx: AuditContext) =>
    logModerationAction("comment_deleted", actorId, ownerId, ctx),
};

export default moderationAudit;
