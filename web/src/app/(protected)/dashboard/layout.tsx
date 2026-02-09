import { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "./_components/DashboardLayoutClient";

export const dynamic = "force-dynamic";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user: sessionUser }, error: sessionUserError } = await supabase.auth.getUser();

  if (sessionUserError || !sessionUser) {
    redirect("/login");
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", sessionUser.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <DashboardLayoutClient isAdmin={isAdmin}>
      {children}
    </DashboardLayoutClient>
  );
}
