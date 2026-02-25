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
  it("exports maxDuration = 60 for Vercel function timeout", () => {
    expect(routeSource).toContain("export const maxDuration = 60");
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

  it("uses the same configured model for Phase A and Phase B", () => {
    expect(routeSource).toContain("extractTextFromImages(openAiKey, validatedImages, model)");
    expect(routeSource).toContain("const model = process.env.OPENAI_EVENT_INTERPRETER_MODEL?.trim() || DEFAULT_INTERPRETER_MODEL");
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
