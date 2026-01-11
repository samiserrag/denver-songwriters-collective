/**
 * Ops Audit Logger
 *
 * Logs ops console actions for admin audit trail.
 * Server-side only - uses service role to bypass RLS.
 *
 * Pattern follows moderationAudit.ts
 */

import { createClient } from "@supabase/supabase-js";

type OpsAction =
  | "venues_csv_export"
  | "venues_csv_preview"
  | "venues_csv_apply";

interface OpsAuditContext {
  rowCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  notFoundIds?: string[];
  [key: string]: unknown;
}

/**
 * Log an ops action to the app_logs table.
 * Uses service role to ensure logs are always written.
 */
export async function logOpsAction(
  action: OpsAction,
  actorId: string,
  context: OpsAuditContext = {}
): Promise<void> {
  // Server-side only
  if (typeof window !== "undefined") {
    console.warn("[OpsAudit] Should only be called server-side");
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[OpsAudit] Missing Supabase environment variables");
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.from("app_logs").insert({
      level: "info",
      message: `Ops: ${action}`,
      context: {
        action,
        actorId,
        ...context,
      },
      user_id: actorId,
      source: "ops_audit",
    });
  } catch (err) {
    // Don't throw - just log to console
    console.error("[OpsAudit] Failed to log action:", err);
  }
}

/**
 * Convenience methods for specific ops actions.
 */
export const opsAudit = {
  venuesCsvExport: (actorId: string, ctx: OpsAuditContext = {}) =>
    logOpsAction("venues_csv_export", actorId, ctx),

  venuesCsvPreview: (actorId: string, ctx: OpsAuditContext = {}) =>
    logOpsAction("venues_csv_preview", actorId, ctx),

  venuesCsvApply: (actorId: string, ctx: OpsAuditContext = {}) =>
    logOpsAction("venues_csv_apply", actorId, ctx),
};

export default opsAudit;
