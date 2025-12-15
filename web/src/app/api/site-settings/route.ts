import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      .select("theme_preset, font_preset")
      .eq("id", "global")
      .single();

    if (error) {
      // If table doesn't exist yet or no row, return defaults
      if (error.code === "PGRST116" || error.code === "42P01") {
        return NextResponse.json({ themePreset: "", fontPreset: "" });
      }
      console.error("Error fetching site settings:", error);
      return NextResponse.json({ themePreset: "", fontPreset: "" });
    }

    return NextResponse.json({
      themePreset: data?.theme_preset ?? "",
      fontPreset: data?.font_preset ?? "",
    });
  } catch (error) {
    console.error("Error in site-settings GET:", error);
    return NextResponse.json({ themePreset: "", fontPreset: "" });
  }
}
