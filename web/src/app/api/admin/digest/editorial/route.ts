/**
 * Admin Digest Editorial API
 *
 * GET    /api/admin/digest/editorial?week_key=&digest_type= — Fetch editorial
 * PUT    /api/admin/digest/editorial — Upsert editorial content
 * DELETE /api/admin/digest/editorial?week_key=&digest_type= — Delete editorial
 *
 * Admin-only. Uses service role client to read/write digest_editorial.
 *
 * Phase: GTM-3
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  getEditorial,
  upsertEditorial,
  deleteEditorial,
} from "@/lib/digest/digestEditorial";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const weekKey = request.nextUrl.searchParams.get("week_key");
  const digestType =
    request.nextUrl.searchParams.get("digest_type") || "weekly_happenings";

  if (!weekKey) {
    return NextResponse.json(
      { error: "Missing week_key parameter" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const editorial = await getEditorial(serviceClient, weekKey, digestType);

  return NextResponse.json({ editorial });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { weekKey, digestType = "weekly_happenings", ...editorialData } = body;

  if (!weekKey) {
    return NextResponse.json(
      { error: "Missing weekKey" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const success = await upsertEditorial(
    serviceClient,
    weekKey,
    digestType,
    editorialData,
    user.id
  );

  if (!success) {
    return NextResponse.json(
      { error: "Failed to save editorial" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const weekKey = request.nextUrl.searchParams.get("week_key");
  const digestType =
    request.nextUrl.searchParams.get("digest_type") || "weekly_happenings";

  if (!weekKey) {
    return NextResponse.json(
      { error: "Missing week_key parameter" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const success = await deleteEditorial(serviceClient, weekKey, digestType);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete editorial" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
