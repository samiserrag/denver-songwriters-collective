import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

// Note: Use semicolon (;) as delimiter for function allowlists since function signatures contain commas
const allowAnon = new Set(
  (process.env.TRIPWIRE_ALLOW_ANON_FUNCTIONS || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
);

const allowPublic = new Set(
  (process.env.TRIPWIRE_ALLOW_PUBLIC_FUNCTIONS || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
);

// Views owned by postgres that are intentionally allowed (e.g., read-only public data)
// Use semicolon (;) as delimiter
const allowPostgresOwnedViews = new Set(
  (process.env.TRIPWIRE_ALLOW_POSTGRES_OWNED_VIEWS || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
);

// Whether to fail (vs warn) on dangerous table privileges
const failOnDangerousTablePrivs = process.env.TRIPWIRE_FAIL_ON_DANGEROUS_TABLE_PRIVS === "1";

// Dangerous privileges that anon/authenticated should never have
const DANGEROUS_PRIVS = ["TRUNCATE", "TRIGGER", "REFERENCES"];

function fmtFn(row) {
  return `${row.schema}.${row.name}(${row.args})`;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const failures = [];

  const rls = await client.query(`
    select
      n.nspname as schema,
      c.relname as table,
      c.relrowsecurity as rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and n.nspname = 'public'
    order by 1,2;
  `);

  const rlsOff = rls.rows.filter(r => r.rls_enabled === false);
  if (rlsOff.length) {
    failures.push({
      title: "RLS disabled on public tables",
      items: rlsOff.map(r => `${r.schema}.${r.table}`)
    });
  }

  const secdef = await client.query(`
    select
      n.nspname as schema,
      p.proname as name,
      pg_get_function_identity_arguments(p.oid) as args,
      p.oid as oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
    order by 1,2,3;
  `);

  const anonExecBad = [];
  const publicExecBad = [];

  for (const fn of secdef.rows) {
    const f = fmtFn(fn);

    // Use OID directly to avoid issues with custom type names in signatures
    const anon = await client.query(
      `select has_function_privilege('anon', $1::oid, 'EXECUTE') as ok`,
      [fn.oid]
    );
    const pub = await client.query(
      `select has_function_privilege('public', $1::oid, 'EXECUTE') as ok`,
      [fn.oid]
    );

    if (anon.rows[0]?.ok && !allowAnon.has(f)) anonExecBad.push(f);
    if (pub.rows[0]?.ok && !allowPublic.has(f)) publicExecBad.push(f);
  }

  if (anonExecBad.length) {
    failures.push({
      title: "SECURITY DEFINER functions executable by anon (not allowlisted)",
      items: anonExecBad
    });
  }

  if (publicExecBad.length) {
    failures.push({
      title: "SECURITY DEFINER functions executable by public (not allowlisted)",
      items: publicExecBad
    });
  }

  // ========================================
  // Check 3: Views owned by postgres without SECURITY INVOKER
  // ========================================
  const views = await client.query(`
    select
      n.nspname as schema,
      c.relname as view_name,
      pg_get_userbyid(c.relowner) as owner
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v'
      and n.nspname = 'public'
    order by 1,2;
  `);

  const postgresOwnedViewsBad = [];
  for (const v of views.rows) {
    const fqn = `${v.schema}.${v.view_name}`;
    if (v.owner === "postgres" && !allowPostgresOwnedViews.has(fqn)) {
      postgresOwnedViewsBad.push(fqn);
    }
  }

  if (postgresOwnedViewsBad.length) {
    failures.push({
      title: "Views owned by postgres (not allowlisted) - potential privilege escalation vector",
      items: postgresOwnedViewsBad
    });
  }

  // ========================================
  // Check 4: Dangerous table privileges (TRUNCATE/TRIGGER/REFERENCES) on public tables
  // ========================================
  const warnings = [];

  const tablePrivs = await client.query(`
    select
      table_schema,
      table_name,
      grantee,
      privilege_type
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
    order by 1,2,3,4;
  `);

  if (tablePrivs.rows.length > 0) {
    const privItems = tablePrivs.rows.map(
      r => `${r.table_schema}.${r.table_name} - ${r.grantee} has ${r.privilege_type}`
    );

    if (failOnDangerousTablePrivs) {
      failures.push({
        title: "Dangerous table privileges detected (TRUNCATE/TRIGGER/REFERENCES)",
        items: privItems
      });
    } else {
      warnings.push({
        title: "WARNING: Dangerous table privileges detected (TRUNCATE/TRIGGER/REFERENCES) - set TRIPWIRE_FAIL_ON_DANGEROUS_TABLE_PRIVS=1 to fail",
        items: privItems
      });
    }
  }

  await client.end();

  // Print warnings (non-fatal)
  if (warnings.length) {
    for (const w of warnings) {
      console.warn(`\n${w.title}`);
      for (const item of w.items) console.warn(`- ${item}`);
    }
  }

  if (failures.length) {
    console.error("\nSUPABASE RLS TRIPWIRE FAILED");
    for (const f of failures) {
      console.error(`\n${f.title}`);
      for (const item of f.items) console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log("\nSUPABASE RLS TRIPWIRE PASSED");
}

main().catch(err => {
  console.error("Tripwire error:", err);
  process.exit(2);
});
