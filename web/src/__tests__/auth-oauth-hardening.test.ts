import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const GOOGLE_AUTH_PATH = path.resolve(__dirname, "../lib/auth/google.ts");
const MIGRATION_PATH = path.resolve(
  __dirname,
  "../../../supabase/migrations/20260307164500_harden_handle_new_user_oauth.sql"
);

describe("OAuth hardening", () => {
  it("forces Google account chooser during OAuth login", () => {
    const source = fs.readFileSync(GOOGLE_AUTH_PATH, "utf-8");
    expect(source).toContain("queryParams");
    expect(source).toContain('prompt: "select_account"');
  });

  it("hardens handle_new_user trigger against orphan profile email collisions", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toContain("EXCEPTION WHEN unique_violation");
    expect(sql).toContain("existing_profile_has_auth");
    expect(sql).toContain("UPDATE public.profiles");
    expect(sql).toContain("SET email = NULL");
    expect(sql).toContain("INSERT INTO public.notification_preferences");
  });
});
