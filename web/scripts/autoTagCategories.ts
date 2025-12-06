import { createClient } from "@supabase/supabase-js";

// MUST use service_role for UPDATE due to RLS
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(url, serviceRole);

(async () => {
  const { data: events } = await supabase
    .from("events")
    .select("id, notes, description, category")
    .is("category", null);

  if (!events?.length) {
    console.log("No uncategorized events.");
    return;
  }

  for (const ev of events) {
    const text = `${ev.notes ?? ""} ${ev.description ?? ""}`.toLowerCase();
    let tag: string | null = null;

    if (text.includes("comedy")) tag = "comedy";
    else if (text.includes("poetry")) tag = "poetry";
    else if (text.includes("all acts")) tag = "all-acts";
    else tag = null; // Leave NULL

    if (tag) {
      await supabase.from("events")
        .update({ category: tag })
        .eq("id", ev.id);
    }
  }

  console.log("Auto-tagging completed.");
})();
