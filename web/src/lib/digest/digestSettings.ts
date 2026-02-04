/**
 * Digest Settings — Admin-Controlled Automation Toggle
 *
 * Helpers for reading and updating the `digest_settings` table.
 * Used by:
 * - Cron handlers (check if automation is enabled)
 * - Admin control panel (toggle automation on/off)
 *
 * Phase: GTM-2
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DigestType } from "./digestSendLog";

export interface DigestSettings {
  id: string;
  digest_type: DigestType;
  is_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Get the current settings for a digest type.
 *
 * Returns null if the row doesn't exist (shouldn't happen after migration).
 * Callers should treat null as "disabled" (fail-closed).
 */
export async function getDigestSettings(
  supabase: SupabaseClient,
  digestType: DigestType
): Promise<DigestSettings | null> {
  const { data, error } = await supabase
    .from("digest_settings" as string)
    .select("*")
    .eq("digest_type", digestType)
    .maybeSingle();

  if (error) {
    console.error(
      `[DigestSettings] Error fetching settings for ${digestType}:`,
      error
    );
    return null;
  }

  return data as DigestSettings | null;
}

/**
 * Get settings for all digest types.
 */
export async function getAllDigestSettings(
  supabase: SupabaseClient
): Promise<DigestSettings[]> {
  const { data, error } = await supabase
    .from("digest_settings" as string)
    .select("*")
    .order("digest_type");

  if (error) {
    console.error("[DigestSettings] Error fetching all settings:", error);
    return [];
  }

  return (data as DigestSettings[]) ?? [];
}

/**
 * Update automation toggle for a digest type.
 *
 * Records which admin made the change and when.
 */
export async function updateDigestSettings(
  supabase: SupabaseClient,
  digestType: DigestType,
  isEnabled: boolean,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("digest_settings" as string)
    .update({
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("digest_type", digestType);

  if (error) {
    console.error(
      `[DigestSettings] Error updating ${digestType}:`,
      error
    );
    return false;
  }

  return true;
}

/**
 * Check if a digest is enabled, considering the control hierarchy:
 *
 * 1. Env var kill switch OFF → disabled (emergency override, highest priority)
 * 2. DB toggle OFF → disabled (primary admin control)
 * 3. Both ON → enabled
 *
 * This function checks ONLY the DB toggle. Env var checks happen
 * in the cron handler before this is called.
 */
export async function isDigestEnabled(
  supabase: SupabaseClient,
  digestType: DigestType
): Promise<boolean> {
  const settings = await getDigestSettings(supabase, digestType);
  // Fail-closed: if settings missing, treat as disabled
  return settings?.is_enabled ?? false;
}
