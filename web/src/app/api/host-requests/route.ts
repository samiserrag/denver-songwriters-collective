import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST - Create host request
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message } = await request.json();

  // Check if already an approved host
  const { data: existingHost } = await supabase
    .from("approved_hosts")
    .select()
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingHost) {
    return NextResponse.json(
      { error: "Already an approved host" },
      { status: 400 }
    );
  }

  // Check for pending request
  const { data: pendingRequest } = await supabase
    .from("host_requests")
    .select()
    .eq("user_id", session.user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingRequest) {
    return NextResponse.json(
      { error: "Request already pending" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("host_requests")
    .insert({
      user_id: session.user.id,
      message,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// GET - Get user's host request status
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if approved host
  const { data: hostStatus } = await supabase
    .from("approved_hosts")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (hostStatus) {
    return NextResponse.json({ isHost: true, status: hostStatus.status });
  }

  // Check for request
  const { data: hostRequest } = await supabase
    .from("host_requests")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    isHost: false,
    request: hostRequest || null,
  });
}
