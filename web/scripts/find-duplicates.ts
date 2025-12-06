import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Event {
  id: string;
  title: string;
  venue_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  signup_time: string | null;
  description: string | null;
  status: string | null;
  category: string | null;
  recurrence_rule: string | null;
  venue_id: string | null;
  slug: string | null;
  created_at: string | null;
  updated_at: string | null;
}

async function findDuplicates() {
  console.log("Fetching all open mic events...\n");

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("event_type", "open_mic")
    .order("venue_name", { ascending: true });

  if (error) {
    console.error("Error fetching events:", error);
    return;
  }

  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }

  console.log(`Found ${events.length} total open mic events.\n`);

  // Group by venue_name + day_of_week
  const groups: Record<string, Event[]> = {};

  for (const event of events) {
    const venueName = (event.venue_name || "").trim().toLowerCase();
    const day = (event.day_of_week || "").trim().toLowerCase();

    if (!venueName || !day) continue;

    const key = `${venueName}|${day}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event as Event);
  }

  // Also check for similar titles (case-insensitive)
  const titleGroups: Record<string, Event[]> = {};
  for (const event of events) {
    const title = (event.title || "").trim().toLowerCase();
    if (!title) continue;

    if (!titleGroups[title]) {
      titleGroups[title] = [];
    }
    titleGroups[title].push(event as Event);
  }

  const titleDuplicates = Object.entries(titleGroups).filter(([_, events]) => events.length > 1);
  if (titleDuplicates.length > 0) {
    console.log(`\n⚠️  Found ${titleDuplicates.length} groups with IDENTICAL TITLES:\n`);
    for (const [title, events] of titleDuplicates) {
      console.log(`  "${title}" appears ${events.length} times:`);
      for (const e of events) {
        console.log(`    - ${e.venue_name} (${e.day_of_week}) [${e.status}] ID: ${e.id.slice(0, 8)}...`);
      }
    }
    console.log("\n");
  }

  // Find groups with more than one event (potential duplicates)
  const duplicateGroups = Object.entries(groups).filter(([_, events]) => events.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("No duplicate events found!");
    return;
  }

  console.log(`Found ${duplicateGroups.length} potential duplicate groups:\n`);
  console.log("=".repeat(80));

  for (const [key, events] of duplicateGroups) {
    const [venue, day] = key.split("|");
    console.log(`\n📍 VENUE: ${venue.toUpperCase()}`);
    console.log(`📅 DAY: ${day.charAt(0).toUpperCase() + day.slice(1)}`);
    console.log("-".repeat(60));

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      console.log(`\n  [${i + 1}] ID: ${e.id}`);
      console.log(`      Title: ${e.title}`);
      console.log(`      Slug: ${e.slug || "(none)"}`);
      console.log(`      Status: ${e.status || "(none)"}`);
      console.log(`      Start: ${e.start_time || "TBD"} | End: ${e.end_time || "TBD"} | Signup: ${e.signup_time || "TBD"}`);
      console.log(`      Category: ${e.category || "(none)"}`);
      console.log(`      Recurrence: ${e.recurrence_rule || "(none)"}`);
      console.log(`      Venue ID: ${e.venue_id || "(none)"}`);
      console.log(`      Description: ${e.description ? e.description.substring(0, 100) + "..." : "(none)"}`);
      console.log(`      Created: ${e.created_at}`);
      console.log(`      Updated: ${e.updated_at}`);
    }

    // Recommendation
    console.log("\n  💡 RECOMMENDATION:");
    const activeEvents = events.filter(e => e.status === "active");
    const withDescription = events.filter(e => e.description && e.description.length > 10);
    const withSlug = events.filter(e => e.slug);

    if (activeEvents.length === 1) {
      console.log(`      Keep event [${events.indexOf(activeEvents[0]) + 1}] (only active one)`);
    } else if (withDescription.length === 1) {
      console.log(`      Keep event [${events.indexOf(withDescription[0]) + 1}] (has description)`);
    } else if (withSlug.length === 1) {
      console.log(`      Keep event [${events.indexOf(withSlug[0]) + 1}] (has slug)`);
    } else {
      // Compare completeness
      const scores = events.map((e, i) => {
        let score = 0;
        if (e.status === "active") score += 10;
        if (e.description) score += 5;
        if (e.slug) score += 3;
        if (e.signup_time) score += 2;
        if (e.end_time) score += 1;
        if (e.category) score += 1;
        if (e.venue_id) score += 2;
        return { index: i + 1, score, event: e };
      });
      scores.sort((a, b) => b.score - a.score);
      console.log(`      Keep event [${scores[0].index}] (most complete - score: ${scores[0].score})`);
      console.log(`      Merge data from other events before deleting`);
    }

    console.log("\n" + "=".repeat(80));
  }

  // Summary
  console.log("\n\n📊 SUMMARY");
  console.log("-".repeat(40));
  console.log(`Total duplicate groups: ${duplicateGroups.length}`);
  const totalDuplicateEvents = duplicateGroups.reduce((sum, [_, events]) => sum + events.length, 0);
  console.log(`Total events in duplicate groups: ${totalDuplicateEvents}`);
  console.log(`Events to potentially remove: ${totalDuplicateEvents - duplicateGroups.length}`);
}

findDuplicates().catch(console.error);
