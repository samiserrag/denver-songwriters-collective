import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/site-settings
 * Admin-only endpoint to update global site theme/font settings
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { themePreset, fontPreset } = body;

    // Validate input (allow empty strings for defaults)
    if (typeof themePreset !== "string" || typeof fontPreset !== "string") {
      return NextResponse.json(
        { error: "Invalid input - themePreset and fontPreset must be strings" },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for admin operations
    // Note: site_settings table may not be in database.types.ts until migration is run
    // Using type assertion since this is a new table
    const serviceClient = createServiceRoleClient();

    const { error } = await (serviceClient as any)
      .from("site_settings")
      .update({
        theme_preset: themePreset,
        font_preset: fontPreset,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", "global");

    if (error) {
      console.error("Error updating site settings:", error);
      return NextResponse.json(
        { error: "Failed to update site settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      themePreset,
      fontPreset,
    });
  } catch (error) {
    console.error("Error in admin site-settings POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
