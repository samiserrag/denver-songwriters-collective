import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_TYPE_CONFIG, type EventType } from "@/types/events";

const repoRoot = path.resolve(__dirname, "../../..");
const pageSource = readFileSync(
  path.resolve(__dirname, "../app/events/[id]/page.tsx"),
  "utf-8"
);

function sourceBetween(start: string, end: string): string {
  const startIndex = pageSource.indexOf(start);
  const endIndex = pageSource.indexOf(end, startIndex);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return pageSource.slice(startIndex, endIndex);
}

function readGitOutput(args: string[]): string {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function getBranchChangedFiles(): string[] {
  const statusOutput = readGitOutput(["status", "--short", "--untracked-files=all"]);
  const workingTreeFiles = statusOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim());

  if (workingTreeFiles.length > 0) {
    return workingTreeFiles;
  }

  try {
    const mergeBase = readGitOutput(["merge-base", "origin/main", "HEAD"]);
    const diffOutput = readGitOutput(["diff", "--name-only", mergeBase, "HEAD"]);
    return diffOutput.split(/\r?\n/).filter(Boolean);
  } catch {
    const diffOutput = readGitOutput(["diff", "--name-only", "HEAD"]);
    return diffOutput.split(/\r?\n/).filter(Boolean);
  }
}

describe("event detail type badges", () => {
  it("renders prominent event type icons and labels from EVENT_TYPE_CONFIG", () => {
    const badgeBlock = sourceBetween(
      'data-testid="event-type-badges"',
      "{showStatusBadges &&"
    );
    const sampleTypes: EventType[] = ["open_mic", "song_circle", "workshop"];

    for (const eventType of sampleTypes) {
      expect(EVENT_TYPE_CONFIG[eventType].icon.length).toBeGreaterThan(0);
      expect(EVENT_TYPE_CONFIG[eventType].label.length).toBeGreaterThan(0);
    }

    expect(badgeBlock).toContain("eventTypes.map((eventType) =>");
    expect(badgeBlock).toContain("const typeConfig = EVENT_TYPE_CONFIG[eventType];");
    expect(badgeBlock).toContain("const tone = EVENT_TYPE_BADGE_TONES[eventType];");
    expect(badgeBlock).toContain("{typeConfig.icon}");
    expect(badgeBlock).toContain("{typeConfig.label}");
    expect(badgeBlock).toContain("min-h-24");
    expect(badgeBlock).toContain("md:min-h-28");
    expect(badgeBlock).toContain("h-16 w-16");
    expect(badgeBlock).toContain("text-4xl");
    expect(badgeBlock).toContain("md:text-5xl");
    expect(badgeBlock).toContain("text-2xl font-extrabold");
    expect(badgeBlock).toContain("md:text-3xl");
  });

  it("uses a distinct saturated color treatment for each event type", () => {
    const toneBlock = sourceBetween(
      "const EVENT_TYPE_BADGE_TONES",
      "const siteUrl"
    );

    for (const eventType of Object.keys(EVENT_TYPE_CONFIG)) {
      expect(toneBlock).toContain(`${eventType}: {`);
    }

    expect(toneBlock).toContain("bg-orange-500");
    expect(toneBlock).toContain("bg-teal-500");
    expect(toneBlock).toContain("bg-violet-500");
    expect(toneBlock).toContain("bg-sky-500");
    expect(toneBlock).toContain("bg-fuchsia-500");
  });

  it("supports multiple event types instead of collapsing display to only the primary type", () => {
    const helperBlock = sourceBetween(
      "function getVisibleEventTypes",
      "const siteUrl"
    );

    expect(helperBlock).toContain("const seenTypes = new Set<EventType>();");
    expect(helperBlock).toContain("visibleTypes.push(rawType);");
    expect(pageSource).toContain("const eventTypes = getVisibleEventTypes(event.event_type);");
    expect(pageSource).toContain("eventTypes.map((eventType) =>");
    expect(pageSource).toContain("getPrimaryEventType(eventTypes)");
    expect(pageSource).not.toContain("<span>{config.icon}</span> {config.label}");
  });

  it("places the event type display under the poster and before the title", () => {
    const posterIndex = pageSource.indexOf("<PosterMedia");
    const typeBadgeIndex = pageSource.indexOf('data-testid="event-type-badges"');
    const titleIndex = pageSource.indexOf("<h1");
    const eventDetailsIndex = pageSource.indexOf("Compact info row: Date | Time | Venue | Spots");

    expect(posterIndex).toBeGreaterThanOrEqual(0);
    expect(typeBadgeIndex).toBeGreaterThan(posterIndex);
    expect(typeBadgeIndex).toBeLessThan(titleIndex);
    expect(typeBadgeIndex).toBeLessThan(eventDetailsIndex);
  });

  it("keeps Track 1, interpreter, migration, and telemetry files out of this PR", () => {
    const changedFiles = getBranchChangedFiles();
    const forbiddenPatterns = [
      /^docs\/investigation\/track1-claims\.md$/,
      /^web\/src\/app\/\(protected\)\/dashboard\/my-events\/_components\/ConversationalCreateUI\.tsx$/,
      /^web\/src\/app\/api\/events\/interpret\//,
      /^web\/src\/lib\/events\/aiPromptContract\.ts$/,
      /^web\/src\/lib\/events\/interpretEventContract\.ts$/,
      /^web\/src\/lib\/events\/interpreterPostprocess\.ts$/,
      /^web\/src\/lib\/telemetry\//,
      /^supabase\/migrations\//,
    ];

    expect(changedFiles.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)))).toEqual([]);
  });
});
