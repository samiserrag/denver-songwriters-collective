import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SITE_SOCIAL_LINKS, sanitizeSiteSocialLinks } from "@/lib/site-social-links";

export const dynamic = "force-dynamic";

/**
 * GET /api/site-settings
 * Public endpoint - returns the global site theme/font settings
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // Note: site_settings table may not be in database.types.ts until migration is run
    const { data, error } = await (supabase as any)
      .from("site_settings")
      .select("theme_preset, font_preset, social_links")
      .eq("id", "global")
      .single();

    if (error) {
      // If table doesn't exist yet or no row, return defaults
      if (error.code === "PGRST116" || error.code === "42P01") {
        return NextResponse.json({
          themePreset: "",
          fontPreset: "",
          socialLinks: DEFAULT_SITE_SOCIAL_LINKS,
        });
      }
      console.error("Error fetching site settings:", error);
      return NextResponse.json({
        themePreset: "",
        fontPreset: "",
        socialLinks: DEFAULT_SITE_SOCIAL_LINKS,
      });
    }

    const socialLinks = sanitizeSiteSocialLinks(data?.social_links);

    return NextResponse.json({
      themePreset: data?.theme_preset ?? "",
      fontPreset: data?.font_preset ?? "",
      socialLinks: socialLinks.length > 0 ? socialLinks : DEFAULT_SITE_SOCIAL_LINKS,
    });
  } catch (error) {
    console.error("Error in site-settings GET:", error);
    return NextResponse.json({
      themePreset: "",
      fontPreset: "",
      socialLinks: DEFAULT_SITE_SOCIAL_LINKS,
    });
  }
}
