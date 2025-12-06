import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as readline from "readline";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Event {
  id: string;
  title: string;
  venue_name: string | null;
  venue_id: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  signup_time: string | null;
  description: string | null;
  notes: string | null;
  status: string | null;
  category: string | null;
  recurrence_rule: string | null;
  slug: string | null;
  venue_address: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Known duplicates to merge (from our analysis)
const DUPLICATES_TO_MERGE = [
  {
    title: "Alley Open Mic",
    keeper: "9ea38538", // Alley (Tuesday) [needs_verification]
    remove: "a698cb60", // The Alley (null) [needs_verification]
  },
  {
    title: "Bootstrap Brewing Open Mic",
    keeper: "b24faace", // Bootstrap Brewing Company (Monday) [active]
    remove: "93000322", // Bootstrap Brewing (Monday) [active]
  },
  {
    title: "Cactus Jack's Open Mic",
    keeper: "3d81abe6", // Cactus Jack's Saloon (Thursday) [active]
    remove: "7aabac54", // Cactus Jack's (Thursday) [needs_verification]
  },
  {
    title: "Corner Beet Open Mic",
    keeper: "68a73233", // The Corner Beet (Monday) [active]
    remove: "7646959f", // Corner Beet (Monday) [needs_verification]
  },
  {
    title: "Goosetown Tavern Open Mic",
    keeper: "7408c379", // Goosetown Tavern (Tuesday) [active]
    remove: "fcb2780e", // Goosetown Tavern (null) [needs_verification]
  },
  {
    title: "Hooked on Colfax Open Mic",
    keeper: "2ad91432", // Hooked on Colfax (Monday) [needs_verification]
    remove: "cfb12b02", // Hooked on Colfax (null) [needs_verification]
  },
  {
    title: "Lyons Rock Garden Open Mic",
    keeper: "af5b0d8b", // The Rock Garden at A-Lodge Lyons (Monday)
    remove: "0e3c1c1a", // Lyons Rock Garden (Monday)
  },
  {
    title: "Velvet Banjo Open Mic",
    keeper: "d95d78e8", // The Velvet Elk Lounge (Wednesday) [active]
    remove: "1a6e82a2", // Velvet Banjo (Wednesday) [needs_verification]
  },
  {
    title: "Woodcellar Open Mic",
    keeper: "39327935", // The Woodcellar (Thursday) [active]
    remove: "cf99cd34", // Woodcellar (Thursday) [needs_verification]
  },
  {
    title: "Western Sky Open Mic",
    keeper: "23076248", // Western Sky Bar & Taproom (Sunday) [active]
    remove: "26c1d81b", // Western Sky (Sunday) [needs_verification]
  },
];

// Cache for all events
let allEventsCache: Event[] | null = null;

async function getAllEvents(): Promise<Event[]> {
  if (allEventsCache) return allEventsCache;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("event_type", "open_mic");

  if (error) {
    console.error("Error fetching events:", error.message);
    return [];
  }

  allEventsCache = data as Event[];
  return allEventsCache;
}

async function getEventById(partialId: string): Promise<Event | null> {
  const events = await getAllEvents();
  const event = events.find(e => e.id.startsWith(partialId));

  if (!event) {
    console.error(`Event not found with ID starting with: ${partialId}`);
    return null;
  }

  return event;
}

function mergeFields(keeper: Event, toRemove: Event): Partial<Event> {
  const updates: Partial<Event> = {};

  // For each field, use the "better" value (non-null, longer, etc.)
  const fieldsToMerge: (keyof Event)[] = [
    "description",
    "notes",
    "category",
    "venue_id",
    "venue_address",
    "signup_time",
    "end_time",
    "recurrence_rule",
    "slug",
  ];

  for (const field of fieldsToMerge) {
    const keeperVal = keeper[field];
    const removeVal = toRemove[field];

    // If keeper is null/empty but toRemove has a value, use it
    if ((!keeperVal || keeperVal === "") && removeVal && removeVal !== "") {
      updates[field] = removeVal as any;
    }
    // If both have values and toRemove is longer (for text fields), consider using it
    else if (
      typeof keeperVal === "string" &&
      typeof removeVal === "string" &&
      removeVal.length > keeperVal.length
    ) {
      // Only for description and notes - prefer longer content
      if (field === "description" || field === "notes") {
        updates[field] = removeVal as any;
      }
    }
  }

  // Special handling for day_of_week - prefer non-null
  if (!keeper.day_of_week && toRemove.day_of_week) {
    updates.day_of_week = toRemove.day_of_week;
  }

  // Special handling for status - prefer 'active'
  if (keeper.status !== "active" && toRemove.status === "active") {
    updates.status = "active";
  }

  return updates;
}

async function analyzeDuplicates() {
  console.log("=".repeat(80));
  console.log("DUPLICATE EVENT ANALYSIS & MERGE PLAN");
  console.log("=".repeat(80));
  console.log("\n");

  for (const dup of DUPLICATES_TO_MERGE) {
    console.log(`📌 ${dup.title}`);
    console.log("-".repeat(60));

    const keeper = await getEventById(dup.keeper);
    const toRemove = await getEventById(dup.remove);

    if (!keeper || !toRemove) {
      console.log("  ⚠️  Could not fetch one or both events. Skipping.\n");
      continue;
    }

    console.log(`\n  KEEPER (${keeper.id.slice(0, 8)}...):`);
    console.log(`    Venue: ${keeper.venue_name}`);
    console.log(`    Day: ${keeper.day_of_week || "(none)"}`);
    console.log(`    Status: ${keeper.status}`);
    console.log(`    Start: ${keeper.start_time || "TBD"}`);
    console.log(`    End: ${keeper.end_time || "TBD"}`);
    console.log(`    Signup: ${keeper.signup_time || "TBD"}`);
    console.log(`    Description: ${keeper.description ? keeper.description.slice(0, 80) + "..." : "(none)"}`);
    console.log(`    Slug: ${keeper.slug || "(none)"}`);
    console.log(`    Venue ID: ${keeper.venue_id || "(none)"}`);

    console.log(`\n  TO REMOVE (${toRemove.id.slice(0, 8)}...):`);
    console.log(`    Venue: ${toRemove.venue_name}`);
    console.log(`    Day: ${toRemove.day_of_week || "(none)"}`);
    console.log(`    Status: ${toRemove.status}`);
    console.log(`    Start: ${toRemove.start_time || "TBD"}`);
    console.log(`    End: ${toRemove.end_time || "TBD"}`);
    console.log(`    Signup: ${toRemove.signup_time || "TBD"}`);
    console.log(`    Description: ${toRemove.description ? toRemove.description.slice(0, 80) + "..." : "(none)"}`);
    console.log(`    Slug: ${toRemove.slug || "(none)"}`);
    console.log(`    Venue ID: ${toRemove.venue_id || "(none)"}`);

    const updates = mergeFields(keeper, toRemove);
    if (Object.keys(updates).length > 0) {
      console.log(`\n  📝 FIELDS TO MERGE INTO KEEPER:`);
      for (const [key, value] of Object.entries(updates)) {
        const displayValue = typeof value === "string" && value.length > 60
          ? value.slice(0, 60) + "..."
          : value;
        console.log(`    ${key}: ${displayValue}`);
      }
    } else {
      console.log(`\n  ✓ No fields need merging - keeper has all data`);
    }

    console.log("\n" + "=".repeat(80) + "\n");
  }
}

async function executeMerge(dryRun = true) {
  console.log(dryRun ? "\n🔍 DRY RUN MODE - No changes will be made\n" : "\n⚡ EXECUTING MERGE...\n");

  let mergedCount = 0;
  let deletedCount = 0;

  for (const dup of DUPLICATES_TO_MERGE) {
    const keeper = await getEventById(dup.keeper);
    const toRemove = await getEventById(dup.remove);

    if (!keeper || !toRemove) {
      console.log(`⚠️  Skipping ${dup.title} - could not fetch events`);
      continue;
    }

    const updates = mergeFields(keeper, toRemove);

    if (Object.keys(updates).length > 0) {
      console.log(`📝 Merging fields into ${keeper.venue_name}...`);
      if (!dryRun) {
        const { error } = await supabase
          .from("events")
          .update(updates)
          .eq("id", keeper.id);

        if (error) {
          console.log(`  ❌ Error updating: ${error.message}`);
          continue;
        }
        console.log(`  ✓ Updated ${Object.keys(updates).length} fields`);
      } else {
        console.log(`  Would update: ${Object.keys(updates).join(", ")}`);
      }
      mergedCount++;
    }

    console.log(`🗑️  Deleting duplicate ${toRemove.venue_name}...`);
    if (!dryRun) {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", toRemove.id);

      if (error) {
        console.log(`  ❌ Error deleting: ${error.message}`);
        continue;
      }
      console.log(`  ✓ Deleted`);
    } else {
      console.log(`  Would delete ID: ${toRemove.id}`);
    }
    deletedCount++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Events with merged fields: ${mergedCount}`);
  console.log(`  Events ${dryRun ? "to delete" : "deleted"}: ${deletedCount}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--execute")) {
    console.log("⚠️  WARNING: This will modify the database!");
    console.log("Press Ctrl+C to cancel...\n");
    await new Promise(resolve => setTimeout(resolve, 3000));
    await executeMerge(false);
  } else if (args.includes("--dry-run")) {
    await executeMerge(true);
  } else {
    await analyzeDuplicates();
    console.log("\nTo see what would be changed, run: npx tsx scripts/merge-duplicates.ts --dry-run");
    console.log("To execute the merge, run: npx tsx scripts/merge-duplicates.ts --execute");
  }
}

main().catch(console.error);
