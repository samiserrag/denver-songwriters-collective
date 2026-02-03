import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}

const allowAnon = new Set(
  (process.env.TRIPWIRE_ALLOW_ANON_FUNCTIONS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

const allowPublic = new Set(
  (process.env.TRIPWIRE_ALLOW_PUBLIC_FUNCTIONS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

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

    const anon = await client.query(
      `select has_function_privilege('anon', $1::regprocedure, 'EXECUTE') as ok`,
      [f]
    );
    const pub = await client.query(
      `select has_function_privilege('public', $1::regprocedure, 'EXECUTE') as ok`,
      [f]
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

  await client.end();

  if (failures.length) {
    console.error("SUPABASE RLS TRIPWIRE FAILED");
    for (const f of failures) {
      console.error(`\n${f.title}`);
      for (const item of f.items) console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log("SUPABASE RLS TRIPWIRE PASSED");
}

main().catch(err => {
  console.error("Tripwire error:", err);
  process.exit(2);
});
