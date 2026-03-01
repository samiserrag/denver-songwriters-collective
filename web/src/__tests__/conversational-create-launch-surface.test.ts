/**
 * Phase 8E — Conversational create launch surface tests.
 *
 * Source-code assertion tests verifying:
 * 1. ConversationalCreateUI component has variant prop and dual export.
 * 2. Host variant does NOT show lab/debug copy.
 * 3. Host variant enables writes without LAB_WRITES_ENABLED.
 * 4. Host variant forces create mode in payload construction.
 * 5. Conversational route page has flag guard + redirect.
 * 6. Launcher page has flag-gated chooser.
 * 7. Lab page uses variant="lab" wrapper.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/_components/ConversationalCreateUI.tsx"
);
const componentSource = fs.readFileSync(COMPONENT_PATH, "utf-8");

const CONVERSATIONAL_PAGE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/new/conversational/page.tsx"
);
const conversationalPageSource = fs.readFileSync(CONVERSATIONAL_PAGE_PATH, "utf-8");

const LAUNCHER_PAGE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/new/page.tsx"
);
const launcherSource = fs.readFileSync(LAUNCHER_PAGE_PATH, "utf-8");

const LAB_PAGE_PATH = path.resolve(
  __dirname,
  "../app/(protected)/dashboard/my-events/interpreter-lab/page.tsx"
);
const labPageSource = fs.readFileSync(LAB_PAGE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// A) ConversationalCreateUI component — variant prop + exports
// ---------------------------------------------------------------------------
describe("Phase 8E — ConversationalCreateUI variant prop", () => {
  it("exports ConversationalCreateVariant type", () => {
    expect(componentSource).toContain('export type ConversationalCreateVariant = "lab" | "host"');
  });

  it("has named export for ConversationalCreateUI", () => {
    expect(componentSource).toContain("export function ConversationalCreateUI(");
  });

  it("has default export for ConversationalCreateUI", () => {
    expect(componentSource).toContain("export default ConversationalCreateUI");
  });

  it("accepts variant prop with default 'lab'", () => {
    expect(componentSource).toContain('variant = "lab"');
  });

  it("computes isHostVariant from variant", () => {
    expect(componentSource).toContain('const isHostVariant = variant === "host"');
  });
});

// ---------------------------------------------------------------------------
// B) Host variant does NOT show lab/debug copy
// ---------------------------------------------------------------------------
describe("Phase 8E — host variant removes lab copy", () => {
  it("conditionally hides Interpreter Lab title behind !isHostVariant", () => {
    // Lab title only appears inside the non-host branch
    expect(componentSource).toContain("Interpreter Lab");
    // But the host branch has "Create Happening"
    expect(componentSource).toContain("Create Happening");
  });

  it("conditionally hides Hidden test surface text behind !isHostVariant", () => {
    expect(componentSource).toContain("Hidden test surface");
    // The isHostVariant ternary controls which header renders
    expect(componentSource).toContain("isHostVariant ?");
  });

  it("hides debug panel in host variant", () => {
    expect(componentSource).toContain("!isHostVariant && (");
    expect(componentSource).toContain("Debug: Raw API Response");
  });

  it("hides mode selector in host variant", () => {
    // Mode selector wrapped in !isHostVariant
    const modeSelectPattern = /!isHostVariant &&[\s\S]*?<select/;
    expect(componentSource).toMatch(modeSelectPattern);
  });

  it("shows host-friendly placeholder for textarea", () => {
    expect(componentSource).toContain("Open mic night at Dazzle Jazz");
  });

  it("provides classic form fallback link in host variant", () => {
    expect(componentSource).toContain("Use classic form instead");
    expect(componentSource).toContain("/dashboard/my-events/new?classic=true");
  });
});

// ---------------------------------------------------------------------------
// C) Host variant enables writes without LAB_WRITES_ENABLED
// ---------------------------------------------------------------------------
describe("Phase 8E — host variant write decoupling", () => {
  it("computes writesEnabled from variant OR lab flag", () => {
    expect(componentSource).toContain("const writesEnabled = isHostVariant || LAB_WRITES_ENABLED");
  });

  it("uses writesEnabled for canShowCoverControls", () => {
    expect(componentSource).toContain("writesEnabled &&");
    // Verify it's not using LAB_WRITES_ENABLED directly for cover controls
    const coverControlsBlock = componentSource.match(
      /canShowCoverControls\s*=\s*\n?\s*([\s\S]*?);/
    );
    expect(coverControlsBlock).not.toBeNull();
    expect(coverControlsBlock![1]).toContain("writesEnabled");
  });

  it("uses writesEnabled for canShowCreateAction", () => {
    const createActionBlock = componentSource.match(
      /canShowCreateAction\s*=\s*\n?\s*([\s\S]*?);/
    );
    expect(createActionBlock).not.toBeNull();
    expect(createActionBlock![1]).toContain("writesEnabled");
  });
});

// ---------------------------------------------------------------------------
// D) Host variant forces create mode in payload construction
// ---------------------------------------------------------------------------
describe("Phase 8E — host variant forces create mode", () => {
  it("computes effectiveMode from variant", () => {
    expect(componentSource).toContain(
      'const effectiveMode: InterpretMode = isHostVariant ? "create" : mode'
    );
  });

  it("uses effectiveMode in payload mode field", () => {
    expect(componentSource).toContain("mode: effectiveMode,");
  });

  it("uses effectiveMode for eventId gating", () => {
    expect(componentSource).toContain('effectiveMode !== "create" && eventId.trim()');
  });

  it("uses effectiveMode for dateKey gating", () => {
    expect(componentSource).toContain('effectiveMode === "edit_occurrence" && dateKey.trim()');
  });

  it("uses effectiveMode for locked_draft gating", () => {
    expect(componentSource).toContain(
      'effectiveMode === "create" && lastInterpretResponse?.draft_payload'
    );
  });

  it("uses effectiveMode for create action gating", () => {
    expect(componentSource).toContain('effectiveMode === "create" &&');
  });
});

// ---------------------------------------------------------------------------
// E) Conversational route page — flag guard + redirect
// ---------------------------------------------------------------------------
describe("Phase 8E — conversational route page", () => {
  it("checks NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY flag", () => {
    expect(conversationalPageSource).toContain(
      "NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY"
    );
  });

  it("redirects to classic form when flag is off", () => {
    expect(conversationalPageSource).toContain("!CONVERSATIONAL_CREATE_ENABLED");
    expect(conversationalPageSource).toContain(
      'redirect("/dashboard/my-events/new?classic=true")'
    );
  });

  it("renders ConversationalCreateUI with variant host", () => {
    expect(conversationalPageSource).toContain('variant="host"');
    expect(conversationalPageSource).toContain("ConversationalCreateUI");
  });

  it("sets page metadata title", () => {
    expect(conversationalPageSource).toContain("Create Happening | CSC");
  });
});

// ---------------------------------------------------------------------------
// F) Launcher page — flag-gated chooser
// ---------------------------------------------------------------------------
describe("Phase 8E — launcher page chooser", () => {
  it("reads NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY flag", () => {
    expect(launcherSource).toContain(
      "NEXT_PUBLIC_ENABLE_CONVERSATIONAL_CREATE_ENTRY"
    );
  });

  it("reads classic query param from searchParams", () => {
    expect(launcherSource).toContain('params.classic === "true"');
  });

  it("computes showChooser from flag and forceClassic", () => {
    expect(launcherSource).toContain(
      "const showChooser = CONVERSATIONAL_CREATE_ENABLED && !forceClassic"
    );
  });

  it("renders Create with AI chooser card when flag on", () => {
    expect(launcherSource).toContain("Create with AI");
    expect(launcherSource).toContain("/dashboard/my-events/new/conversational");
  });

  it("renders Use classic form chooser card", () => {
    expect(launcherSource).toContain("Use classic form");
    expect(launcherSource).toContain("/dashboard/my-events/new?classic=true");
  });

  it("always renders EventForm regardless of flag state", () => {
    expect(launcherSource).toContain('<EventForm mode="create"');
  });

  it("chooser is conditional on showChooser", () => {
    expect(launcherSource).toContain("{showChooser && (");
  });
});

// ---------------------------------------------------------------------------
// G) Lab page — wrapper with variant="lab"
// ---------------------------------------------------------------------------
describe("Phase 8E — lab page wrapper", () => {
  it("imports ConversationalCreateUI", () => {
    expect(labPageSource).toContain("ConversationalCreateUI");
  });

  it("renders with variant lab", () => {
    expect(labPageSource).toContain('variant="lab"');
  });

  it("is a thin wrapper (under 10 lines)", () => {
    const lines = labPageSource.trim().split("\n").length;
    expect(lines).toBeLessThanOrEqual(10);
  });
});
