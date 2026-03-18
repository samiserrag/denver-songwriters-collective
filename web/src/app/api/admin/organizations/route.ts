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

// GET all organizations
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceClient = createServiceRoleClient();
    const { data, error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .select("*")
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Organizations GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("Organizations GET crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create organization
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isAdmin = await checkAdminRole(supabase, user.id);
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const slug = normalizeString(body.slug);
    const name = normalizeString(body.name);
    const websiteUrl = normalizeString(body.website_url);
    const shortBlurb = normalizeString(body.short_blurb);
    const whyItMatters = normalizeString(body.why_it_matters);

    if (!slug || !name || !websiteUrl || !shortBlurb || !whyItMatters) {
      return NextResponse.json(
        { error: "Missing required fields: slug, name, website_url, short_blurb, why_it_matters" },
        { status: 400 }
      );
    }

    const payload = {
      slug,
      name,
      website_url: websiteUrl,
      city: normalizeString(body.city),
      organization_type: normalizeString(body.organization_type),
      short_blurb: shortBlurb,
      why_it_matters: whyItMatters,
      tags: normalizeStringArray(body.tags),
      featured: body.featured === true,
      is_active: body.is_active !== false,
      visibility: normalizeVisibility(body.visibility),
      logo_image_url: normalizeString(body.logo_image_url),
      cover_image_url: normalizeString(body.cover_image_url),
      gallery_image_urls: normalizeStringArray(body.gallery_image_urls),
      fun_note: normalizeString(body.fun_note),
      sort_order: parseSortOrder(body.sort_order),
      created_by: user.id,
    };

    const serviceClient = createServiceRoleClient();
    const { data, error } = await (serviceClient as any)
      .from(TABLE_NAME)
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("Organizations POST error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Organizations POST crash:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
