/**
 * Admin Digest Settings API
 *
 * GET  /api/admin/digest/settings — Fetch all digest settings
 * PATCH /api/admin/digest/settings — Update a digest type's enabled state
 *
 * Admin-only. Uses service role client to read/write digest_settings.
 *
 * Phase: GTM-2
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRoleClient";
import { checkAdminRole } from "@/lib/auth/adminAuth";
import {
  getAllDigestSettings,
  updateDigestSettings,
} from "@/lib/digest/digestSettings";
import type { DigestType } from "@/lib/digest/digestSendLog";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const serviceClient = createServiceRoleClient();
  const settings = await getAllDigestSettings(serviceClient);

  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
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
  const { digestType, isEnabled } = body as {
    digestType: DigestType;
    isEnabled: boolean;
  };

  if (!digestType || typeof isEnabled !== "boolean") {
    return NextResponse.json(
      { error: "Missing digestType or isEnabled" },
      { status: 400 }
    );
  }

  const validTypes: DigestType[] = ["weekly_open_mics", "weekly_happenings"];
  if (!validTypes.includes(digestType)) {
    return NextResponse.json(
      { error: "Invalid digestType" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const success = await updateDigestSettings(
    serviceClient,
    digestType,
    isEnabled,
    user.id
  );

  if (!success) {
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
