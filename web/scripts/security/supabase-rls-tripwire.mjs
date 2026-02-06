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
const DANGEROUS_PRIVS_SQL = DANGEROUS_PRIVS.map(priv => `'${priv}'`).join(", ");

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
  // A view with security_invoker=true runs queries as the calling user (safe).
  // A view owned by postgres WITHOUT security_invoker runs as postgres (dangerous).
  // We fail on postgres-owned views that lack security_invoker, unless allowlisted.
  const views = await client.query(`
    select
      n.nspname as schema,
      c.relname as view_name,
      pg_get_userbyid(c.relowner) as owner,
      -- Check reloptions for security_invoker=true (PostgreSQL 15+)
      coalesce(
        (select true from unnest(c.reloptions) opt where opt = 'security_invoker=true'),
        false
      ) as has_security_invoker
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'v'
      and n.nspname = 'public'
    order by 1,2;
  `);

  const postgresOwnedViewsBad = [];
  for (const v of views.rows) {
    const fqn = `${v.schema}.${v.view_name}`;
    // Safe if: not postgres-owned, OR has security_invoker=true, OR explicitly allowlisted
    const isPostgresOwned = v.owner === "postgres";
    const hasSecurityInvoker = v.has_security_invoker === true;
    const isAllowlisted = allowPostgresOwnedViews.has(fqn);

    if (isPostgresOwned && !hasSecurityInvoker && !isAllowlisted) {
      postgresOwnedViewsBad.push(`${fqn} (owner: postgres, security_invoker: false)`);
    }
  }

  if (postgresOwnedViewsBad.length) {
    failures.push({
      title: "Views owned by postgres without security_invoker=true (not allowlisted) - privilege escalation risk",
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
      and privilege_type in (${DANGEROUS_PRIVS_SQL})
    order by 1,2,3,4;
  `);

  if (tablePrivs.rows.length > 0) {
    const privItems = tablePrivs.rows.map(
      r => `${r.table_schema}.${r.table_name} - ${r.grantee} has ${r.privilege_type}`
    );

    if (failOnDangerousTablePrivs) {
      failures.push({
        title: `Dangerous table privileges detected (${DANGEROUS_PRIVS.join("/")})`,
        items: privItems
      });
    } else {
      warnings.push({
        title: `WARNING: Dangerous table privileges detected (${DANGEROUS_PRIVS.join("/")}) - set TRIPWIRE_FAIL_ON_DANGEROUS_TABLE_PRIVS=1 to fail`,
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
