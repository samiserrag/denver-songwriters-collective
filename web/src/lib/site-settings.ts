import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import {
  DEFAULT_SITE_SOCIAL_LINKS,
  type SiteSocialLink,
  sanitizeSiteSocialLinks,
} from "@/lib/site-social-links";

export interface SiteSettings {
  themePreset: string;
  fontPreset: string;
  socialLinks: SiteSocialLink[];
}

/**
 * Fetch site settings from database (server-side)
 * Returns default empty strings if settings don't exist
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  // Disable caching - site settings should always be fresh after admin saves
  noStore();

  try {
    const supabase = await createSupabaseServerClient();

    // Note: site_settings table may not be in database.types.ts until migration is run
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("theme_preset, font_preset, social_links")
      .eq("id", "global")
      .single();

    if (error || !data) {
      return {
        themePreset: "",
        fontPreset: "",
        socialLinks: DEFAULT_SITE_SOCIAL_LINKS,
      };
    }

    const socialLinks = sanitizeSiteSocialLinks(data.social_links);

    return {
      themePreset: data.theme_preset ?? "",
      fontPreset: data.font_preset ?? "",
      socialLinks: socialLinks.length > 0 ? socialLinks : DEFAULT_SITE_SOCIAL_LINKS,
    };
  } catch {
    return {
      themePreset: "",
      fontPreset: "",
      socialLinks: DEFAULT_SITE_SOCIAL_LINKS,
    };
  }
}
