#!/usr/bin/env node
/**
 * Security Posture Smoke Check
 *
 * Quick summary of security-relevant database state.
 * Run locally to verify posture without full tripwire.
 *
 * Usage:
 *   cd web
 *   source .env.local
 *   node scripts/security/security-posture.mjs
 */

import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required. Run: source .env.local");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log("\n🔐 SUPABASE SECURITY POSTURE SUMMARY\n");
  console.log("=".repeat(50));

  // 1. RLS status
  const rls = await client.query(`
    SELECT COUNT(*) as total,
           COUNT(*) FILTER (WHERE relrowsecurity = false) as rls_off
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND n.nspname = 'public';
  `);
  const rlsOff = parseInt(rls.rows[0].rls_off);
  const rlsTotal = parseInt(rls.rows[0].total);
  console.log(`\n1. RLS Status`);
  console.log(`   Public tables: ${rlsTotal}`);
  console.log(`   RLS disabled:  ${rlsOff} ${rlsOff === 0 ? "✅" : "❌ DANGER"}`);

  // 2. SECURITY DEFINER functions exposed to anon/public
  const secdef = await client.query(`
    SELECT p.oid, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as func
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true;
  `);

  let anonCount = 0;
  let publicCount = 0;
  const exposedFuncs = [];

  for (const fn of secdef.rows) {
    const anon = await client.query(
      `SELECT has_function_privilege('anon', $1::oid, 'EXECUTE') as ok`,
      [fn.oid]
    );
    const pub = await client.query(
      `SELECT has_function_privilege('public', $1::oid, 'EXECUTE') as ok`,
      [fn.oid]
    );
    if (anon.rows[0]?.ok) {
      anonCount++;
      exposedFuncs.push(`  - ${fn.func} (anon)`);
    }
    if (pub.rows[0]?.ok) {
      publicCount++;
      if (!anon.rows[0]?.ok) exposedFuncs.push(`  - ${fn.func} (public)`);
    }
  }

  console.log(`\n2. SECURITY DEFINER Functions`);
  console.log(`   Total in public schema: ${secdef.rows.length}`);
  console.log(`   Callable by anon:       ${anonCount}`);
  console.log(`   Callable by public:     ${publicCount}`);
  if (exposedFuncs.length > 0) {
    console.log(`   Exposed functions:`);
    exposedFuncs.forEach(f => console.log(f));
  }

  // 3. postgres-owned views without security_invoker
  const views = await client.query(`
    SELECT n.nspname || '.' || c.relname as view_name,
           pg_get_userbyid(c.relowner) as owner,
           COALESCE(
             (SELECT true FROM unnest(c.reloptions) opt WHERE opt = 'security_invoker=true'),
             false
           ) as has_security_invoker
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v' AND n.nspname = 'public';
  `);

  const dangerousViews = views.rows.filter(
    v => v.owner === "postgres" && !v.has_security_invoker
  );

  console.log(`\n3. View Ownership`);
  console.log(`   Total public views:     ${views.rows.length}`);
  console.log(`   postgres-owned:         ${views.rows.filter(v => v.owner === "postgres").length}`);
  console.log(`   Missing security_invoker: ${dangerousViews.length} ${dangerousViews.length === 0 ? "✅" : "❌ DANGER"}`);
  if (dangerousViews.length > 0) {
    dangerousViews.forEach(v => console.log(`  - ${v.view_name}`));
  }

  // 4. Dangerous table privileges
  const privs = await client.query(`
    SELECT COUNT(*) as count
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  `);
  const dangerousPrivs = parseInt(privs.rows[0].count);

  console.log(`\n4. Dangerous Table Privileges`);
  console.log(`   TRUNCATE/TRIGGER/REFERENCES grants: ${dangerousPrivs} ${dangerousPrivs === 0 ? "✅" : "❌ DANGER"}`);

  // Summary
  console.log("\n" + "=".repeat(50));
  const issues = rlsOff + dangerousViews.length + dangerousPrivs;
  if (issues === 0 && anonCount <= 2 && publicCount <= 2) {
    console.log("✅ SECURITY POSTURE: GOOD");
    console.log("   (allowlisted functions are expected)");
  } else {
    console.log("❌ SECURITY POSTURE: ISSUES DETECTED");
    console.log("   Run full tripwire for details:");
    console.log("   node scripts/security/supabase-rls-tripwire.mjs");
  }
  console.log("");

  await client.end();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
