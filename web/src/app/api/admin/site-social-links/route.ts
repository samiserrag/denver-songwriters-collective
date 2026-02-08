import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { sanitizeSiteSocialLinks } from "@/lib/site-social-links";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/site-social-links
 * Admin-only endpoint to update global site social links.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const socialLinks = sanitizeSiteSocialLinks(body?.socialLinks);

    const serviceClient = createServiceRoleClient();
    const { error } = await (serviceClient as any)
      .from("site_settings")
      .update({
        social_links: socialLinks,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", "global");

    if (error) {
      console.error("Error updating site social links:", error);
      return NextResponse.json({ error: "Failed to update site social links" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      socialLinks,
    });
  } catch (error) {
    console.error("Error in admin site-social-links POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
