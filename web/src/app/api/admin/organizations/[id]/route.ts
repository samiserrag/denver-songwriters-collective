import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import type { OrganizationVisibility } from "@/lib/organizations";

const TABLE_NAME = "organizations";

function normalizeVisibility(value: unknown): OrganizationVisibility {
  if (value === "private" || value === "unlisted" || value === "public") return value;
  return "unlisted";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSortOrder(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  return { user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const serviceClient = createServiceRoleClient();
    const { data, error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Organizations item GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Organizations item GET crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.slug !== undefined) updates.slug = normalizeString(body.slug);
    if (body.name !== undefined) updates.name = normalizeString(body.name);
    if (body.website_url !== undefined) updates.website_url = normalizeString(body.website_url);
    if (body.city !== undefined) updates.city = normalizeString(body.city);
    if (body.organization_type !== undefined) updates.organization_type = normalizeString(body.organization_type);
    if (body.short_blurb !== undefined) updates.short_blurb = normalizeString(body.short_blurb);
    if (body.why_it_matters !== undefined) updates.why_it_matters = normalizeString(body.why_it_matters);
    if (body.tags !== undefined) updates.tags = normalizeStringArray(body.tags);
    if (body.featured !== undefined) updates.featured = body.featured === true;
    if (body.is_active !== undefined) updates.is_active = body.is_active === true;
    if (body.visibility !== undefined) updates.visibility = normalizeVisibility(body.visibility);
    if (body.logo_image_url !== undefined) updates.logo_image_url = normalizeString(body.logo_image_url);
    if (body.cover_image_url !== undefined) updates.cover_image_url = normalizeString(body.cover_image_url);
    if (body.gallery_image_urls !== undefined) updates.gallery_image_urls = normalizeStringArray(body.gallery_image_urls);
    if (body.fun_note !== undefined) updates.fun_note = normalizeString(body.fun_note);
    if (body.sort_order !== undefined) updates.sort_order = parseSortOrder(body.sort_order);

    const serviceClient = createServiceRoleClient();
    const { data, error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Organizations PATCH error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Organizations PATCH crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const serviceClient = createServiceRoleClient();
    const { error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Organizations DELETE error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Organizations DELETE crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
