import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_SRC = join(__dirname, "..");
const REPO_ROOT = join(WEB_SRC, "..", "..");

const EVENT_PAGE_PATH = join(WEB_SRC, "app/events/[id]/page.tsx");
const EMBED_ROUTE_PATH = join(WEB_SRC, "app/embed/events/[id]/route.ts");
const OG_ROUTE_PATH = join(WEB_SRC, "app/og/event/[id]/route.tsx");
const MATRIX_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l2-bola-route-resource-matrix.md"
);
const MANIFEST_PATH = join(
  REPO_ROOT,
  "docs/investigation/track2-2l3-service-role-admin-client-manifest.md"
);

const eventPageSource = readFileSync(EVENT_PAGE_PATH, "utf-8");
const embedRouteSource = readFileSync(EMBED_ROUTE_PATH, "utf-8");
const ogRouteSource = readFileSync(OG_ROUTE_PATH, "utf-8");
const matrixSource = readFileSync(MATRIX_PATH, "utf-8");
const manifestSource = readFileSync(MANIFEST_PATH, "utf-8");

function section(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  expect(start, `Missing start marker ${startNeedle}`).toBeGreaterThanOrEqual(0);

  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(end, `Missing end marker ${endNeedle}`).toBeGreaterThan(start);

  return source.slice(start, end);
}

function expectBefore(source: string, before: string, after: string): void {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  expect(beforeIndex, `Missing before marker ${before}`).toBeGreaterThanOrEqual(0);
  expect(afterIndex, `Missing after marker ${after}`).toBeGreaterThanOrEqual(0);
  expect(beforeIndex, `${before} should appear before ${after}`).toBeLessThan(
    afterIndex
  );
}

const metadataSection = section(
  eventPageSource,
  "export async function generateMetadata",
  "function formatTime"
);
const oldSlugFallbackSection = section(
  eventPageSource,
  "// Old slug fallback: resolve redirect history and forward to current slug.",
  "if (error || !event)"
);
const publicBodyGateSection = section(
  eventPageSource,
  "if (error || !event)",
  "// Compute derived states"
);
const embedReadSection = section(
  embedRouteSource,
  "const { data: event, error }",
  "const body ="
);
const embedBodySection = section(
  embedRouteSource,
  "const body =",
  "return renderHtml"
);

describe("Track 2 2L.11 public event read BOLA negative cluster", () => {
  it("keeps draft and invite-only events out of public metadata", () => {
    expect(metadataSection).toContain(
      "title, description, event_type, venue_name, slug, visibility, is_published, updated_at"
    );
    expect(metadataSection).toContain(
      '!event || !event.is_published || event.visibility !== "public"'
    );
    expectBefore(metadataSection, "!event.is_published", "const title =");
    expectBefore(metadataSection, 'event.visibility !== "public"', "const title =");
    expect(metadataSection).toContain(
      "Happening Not Found | The Colorado Songwriters Collective"
    );
    expect(metadataSection).not.toMatch(/return\s*\{[^}]*invite.only/i);
    expect(metadataSection).not.toContain("private event");
  });

  it("keeps old slug redirect lookup content-free and re-checks the target before redirect", () => {
    const serviceLookupSection = section(
      oldSlugFallbackSection,
      "const serviceClient = createServiceRoleClient();",
      "if (slugRedirect?.event_id)"
    );

    expect(serviceLookupSection).toContain('.from("event_slug_redirects")');
    const serviceSelect = serviceLookupSection.match(/\.select\("([^"]+)"\)/)?.[1];
    expect(serviceSelect).toBe("event_id");

    expect(oldSlugFallbackSection).toContain(".select(eventSelectQuery)");
    expect(oldSlugFallbackSection).toContain(".eq(\"id\", slugRedirect.event_id)");
    expect(oldSlugFallbackSection).toContain("redirectedEvent.is_published");
    expect(oldSlugFallbackSection).toContain('redirectedEvent.visibility === "public"');
    expectBefore(oldSlugFallbackSection, "redirectedEvent.is_published", "redirect(");
    expectBefore(oldSlugFallbackSection, 'redirectedEvent.visibility === "public"', "redirect(");
  });

  it("keeps detail-page draft and invite-only gates before public body rendering", () => {
    expect(publicBodyGateSection).toContain("if (!event.is_published)");
    expect(publicBodyGateSection).toContain('visibility === "invite_only"');
    expect(publicBodyGateSection).toContain("checkInviteeAccess(");
    expect(publicBodyGateSection).toContain("notFound();");
    expectBefore(eventPageSource, "if (!event.is_published)", "return (");
    expectBefore(eventPageSource, 'visibility === "invite_only"', "return (");
  });

  it("keeps OG and embed anonymous surfaces limited to published public events", () => {
    expect(ogRouteSource).toMatch(
      /\.from\("events"\)[\s\S]*\.eq\("is_published", true\)[\s\S]*\.eq\("visibility", "public"\)/
    );
    expect(ogRouteSource).toContain('title: "Happening"');
    expect(ogRouteSource).not.toContain("createServiceRoleClient");

    expect(embedReadSection).toContain("!embedEvent.is_published");
    expect(embedReadSection).toContain('event.visibility !== "public"');
    expect(embedReadSection).toContain("Event not found");
    expectBefore(embedReadSection, "!embedEvent.is_published", "const venue =");
    expectBefore(embedReadSection, 'event.visibility !== "public"', "const venue =");
  });

  it("does not emit private/internal event fields in public embed or ad hoc JSON-LD output", () => {
    for (const internalField of [
      "host_id",
      "verified_by",
      "source",
      "venue_id",
      "event_attendee_invites",
      "event_hosts",
    ]) {
      expect(embedBodySection).not.toContain(internalField);
    }

    expect(eventPageSource).not.toContain("application/ld+json");
    expect(eventPageSource).not.toContain("schema.org/Event");
    expect(eventPageSource).not.toContain("dangerouslySetInnerHTML");
  });

  it("records this negative-test cluster in the 2L matrix and service-role manifest", () => {
    const testPath =
      "web/src/__tests__/track2-2l11-public-event-read-negative.test.ts";

    expect(matrixSource).toContain("T2-BOLA-PUBLIC-EVENT-READ");
    expect(manifestSource).toContain("T2-SR-PUBLIC-EVENT-SLUG-REDIRECT");
    expect(matrixSource).toContain(testPath);
    expect(manifestSource).toContain(testPath);
    expect(matrixSource).toContain("metadata draft denial");
    expect(manifestSource).toContain("content-free redirect lookup");
  });
});
