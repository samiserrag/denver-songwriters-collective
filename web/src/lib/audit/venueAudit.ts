/**
 * Venue Audit Logger - ABC10a
 *
 * Logs venue edit actions for admin audit trail and revert capability.
 * Server-side only - uses service role to bypass RLS.
 *
 * Pattern follows opsAudit.ts and moderationAudit.ts
 */

import { createClient } from "@supabase/supabase-js";

export type VenueAuditAction = "venue_edit" | "venue_edit_reverted";

export interface VenueAuditContext {
  venueId: string;
  venueName?: string;
  /** Fields that were changed */
  updatedFields: string[];
  /** Values before the edit */
  previousValues: Record<string, unknown>;
  /** Values after the edit */
  newValues: Record<string, unknown>;
  /** Role of actor: manager, admin, or host (Phase 0.6: event hosts can edit venues) */
  actorRole: "manager" | "admin" | "host";
  /** Optional reason (e.g., for reverts) */
  reason?: string;
  /** For reverts: the log_id being reverted */
  revertedLogId?: string;
}

/**
 * Log a venue edit action to the app_logs table.
 * Uses service role to ensure logs are always written.
 */
export async function logVenueEdit(
  action: VenueAuditAction,
  actorId: string,
  context: VenueAuditContext
): Promise<string | null> {
  // Server-side only
  if (typeof window !== "undefined") {
    console.warn("[VenueAudit] Should only be called server-side");
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[VenueAudit] Missing Supabase environment variables");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("app_logs")
      .insert({
        level: "info",
        message: `Venue: ${action}`,
        context: {
          action,
          actorId,
          actorRole: context.actorRole,
          venueId: context.venueId,
          venueName: context.venueName,
          updatedFields: context.updatedFields,
          previousValues: context.previousValues,
          newValues: context.newValues,
          reason: context.reason,
          revertedLogId: context.revertedLogId,
        },
        user_id: actorId,
        source: "venue_audit",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[VenueAudit] Failed to log action:", error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    // Don't throw - just log to console
    console.error("[VenueAudit] Failed to log action:", err);
    return null;
  }
}

/**
 * Convenience methods for venue audit actions.
 */
export const venueAudit = {
  /**
   * Log a venue edit action.
   */
  venueEdited: (actorId: string, context: VenueAuditContext) =>
    logVenueEdit("venue_edit", actorId, context),

  /**
   * Log a venue edit revert action.
   */
  venueEditReverted: (actorId: string, context: VenueAuditContext) =>
    logVenueEdit("venue_edit_reverted", actorId, context),
};

export default venueAudit;
