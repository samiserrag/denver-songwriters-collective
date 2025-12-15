import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SiteSettings {
  themePreset: string;
  fontPreset: string;
}

/**
 * Fetch site settings from database (server-side)
 * Returns default empty strings if settings don't exist
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = await createSupabaseServerClient();

    // Note: site_settings table may not be in database.types.ts until migration is run
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("theme_preset, font_preset")
      .eq("id", "global")
      .single();

    if (error || !data) {
      return { themePreset: "", fontPreset: "" };
    }

    return {
      themePreset: data.theme_preset ?? "",
      fontPreset: data.font_preset ?? "",
    };
  } catch {
    return { themePreset: "", fontPreset: "" };
  }
}
