/**
 * Phase 3 — Interpreter image extraction route integration tests.
 *
 * These are source-code assertion tests that verify the interpret route
 * correctly integrates image validation, vision extraction, and metadata
 * without requiring a running server or OpenAI key.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/events/interpret/route.ts"
);
const routeSource = fs.readFileSync(ROUTE_PATH, "utf-8");

describe("Interpreter image extraction (Phase 3 route)", () => {
  it("exports maxDuration = 120 for Vercel function timeout", () => {
    expect(routeSource).toContain("export const maxDuration = 120");
  });

  it("enforces request body size limit before JSON parse", () => {
    expect(routeSource).toContain("readJsonBodyWithSizeLimit");
    expect(routeSource).toContain("request.body.getReader()");
    expect(routeSource).toContain("totalBytes > maxBytes");
    expect(routeSource).toContain("Request body exceeds");
  });

  it("calls validateImageInputs on incoming body", () => {
    expect(routeSource).toContain("validateImageInputs(body.image_inputs)");
  });

  it("allows image-only draft requests without requiring typed message text", () => {
    expect(routeSource).toContain("message or image is required");
    expect(routeSource).toContain("Please draft this event from the attached image.");
    expect(routeSource.indexOf("validateImageInputs(body.image_inputs)")).toBeLessThan(
      routeSource.indexOf("message or image is required")
    );
  });

  it("returns typed 400/413 for invalid images", () => {
    expect(routeSource).toContain("imageValidation.status");
    expect(routeSource).toContain("imageValidation.error");
  });

  it("implements Phase A vision extraction with its own timeout", () => {
    expect(routeSource).toContain("extractTextFromImages");
    expect(routeSource).toContain("VISION_TIMEOUT_MS");
    expect(routeSource).toContain("modelName");
    expect(routeSource).toContain("model: modelName");
  });

  it("uses fast vision extraction before GPT-5.5 event reasoning", () => {
    expect(routeSource).toContain('const DEFAULT_VISION_EXTRACTION_MODEL = "gpt-4.1-mini"');
    expect(routeSource).toContain("const visionModel = process.env.OPENAI_EVENT_VISION_MODEL?.trim() || DEFAULT_VISION_EXTRACTION_MODEL");
    expect(routeSource).toContain("extractTextFromImages(openAiKey, validatedImages, visionModel)");
    expect(routeSource).toContain("const model = process.env.OPENAI_EVENT_INTERPRETER_MODEL?.trim() || DEFAULT_INTERPRETER_MODEL");
  });

  it("defaults the interpreter to GPT-5.5 when no env override is set", () => {
    expect(routeSource).toContain('const DEFAULT_INTERPRETER_MODEL = "gpt-5.5"');
  });

  it("defaults verifier and web-search reasoning passes to GPT-5.5", () => {
    expect(routeSource).toContain('const DEFAULT_DRAFT_VERIFIER_MODEL = "gpt-5.5"');
    expect(routeSource).toContain('const DEFAULT_WEB_SEARCH_VERIFIER_MODEL = "gpt-5.5"');
    expect(routeSource).toContain("const verifierModel = process.env.OPENAI_EVENT_DRAFT_VERIFIER_MODEL?.trim() || DEFAULT_DRAFT_VERIFIER_MODEL");
    expect(routeSource).toContain("const webSearchModel = process.env.OPENAI_EVENT_WEB_SEARCH_MODEL?.trim() || DEFAULT_WEB_SEARCH_VERIFIER_MODEL");
  });

  it("feeds extracted text into Phase B user prompt", () => {
    expect(routeSource).toContain("extractedImageText");
    expect(routeSource).toContain("extracted_image_text");
    expect(routeSource).toContain("image_extraction_note");
  });

  it("includes extraction_metadata in response when images present", () => {
    expect(routeSource).toContain("extraction_metadata: extractionMetadata");
  });

  it("includes cover_image_url in event context query", () => {
    // In the select query string
    expect(routeSource).toContain("cover_image_url");
    // In the pickCurrentEventContext fields
    const contextMatch = routeSource.match(
      /pickCurrentEventContext[\s\S]*?contextFields\s*=\s*\[[\s\S]*?\]/
    );
    expect(contextMatch).not.toBeNull();
    expect(contextMatch![0]).toContain("cover_image_url");
  });

  it("gracefully falls back when vision extraction fails", () => {
    // The extractTextFromImages function returns empty text + warning metadata
    // on upstream errors, timeouts, and empty output — never throws.
    expect(routeSource).toContain('warnings: [`Vision API returned ${response.status}`]');
    expect(routeSource).toContain('"Vision API returned empty output"');
    expect(routeSource).toContain('"Vision extraction timed out"');
    expect(routeSource).toContain('"Vision extraction failed"');
  });

  it("logs Phase A extraction results for observability", () => {
    expect(routeSource).toContain("[events/interpret] starting Phase A vision extraction");
    expect(routeSource).toContain("[events/interpret] Phase A complete");
    expect(routeSource).toContain("[events/interpret] Phase A produced no text");
  });
});
