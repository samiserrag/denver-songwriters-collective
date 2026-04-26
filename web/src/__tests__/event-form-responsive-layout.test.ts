import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const EVENT_FORM_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/EventForm.tsx"
);
const NEW_EVENT_PAGE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/new/page.tsx"
);

const eventFormSource = fs.readFileSync(EVENT_FORM_PATH, "utf-8");
const newEventPageSource = fs.readFileSync(NEW_EVENT_PAGE_PATH, "utf-8");

describe("classic event form responsive layout", () => {
  it("does not constrain the full create form to the narrow intro width", () => {
    expect(newEventPageSource).toContain("mx-auto w-full max-w-7xl");
    expect(newEventPageSource).toContain("<div className=\"max-w-2xl\">");
    expect(newEventPageSource).toContain("<EventForm mode=\"create\"");
  });

  it("waits for a wide desktop before using the three-column form shell", () => {
    expect(eventFormSource).toContain(
      "grid grid-cols-1 gap-5 2xl:grid-cols-[12rem_minmax(34rem,1fr)_22rem]"
    );
    expect(eventFormSource).toContain("hidden 2xl:block");
    expect(eventFormSource).toContain("2xl:sticky 2xl:top-4 2xl:self-start");
    expect(eventFormSource).not.toContain("xl:grid-cols-[12rem_minmax(0,1fr)_22rem]");
  });

  it("keeps time controls readable and gives each time its own AM/PM selector", () => {
    expect(eventFormSource).toContain("grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2");
    expect(eventFormSource).toContain("useState<\"AM\" | \"PM\">");
    expect(eventFormSource).toContain("useState<\"AM\" | \"PM\">(\"PM\")");
    expect(eventFormSource).toContain("const selectedAmpm = display ? (parsed.ampm === \"AM\" ? \"AM\" : \"PM\") : emptyAmpm");
    expect(eventFormSource).toContain("periodLabel=\"Start time AM/PM\"");
    expect(eventFormSource).toContain("periodLabel=\"End time AM/PM\"");
    expect(eventFormSource).toContain("periodLabel=\"Signup time AM/PM\"");
  });
});
