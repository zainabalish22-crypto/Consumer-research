import "server-only";

/**
 * The database. On the hosted site this is Neon Postgres (free tier), reached through
 * DATABASE_URL. On a developer's computer, when DATABASE_URL is not set, an embedded Postgres
 * (PGlite) keeps its data in the user's local application folder, so everything can be built
 * and tested with no account and no network. (Not in the project folder: a synced folder such
 * as OneDrive can damage a database that is being written.) Both speak the same SQL.
 */
type Row = Record<string, unknown>;
type Runner = (text: string, params: unknown[]) => Promise<Row[]>;

const g = globalThis as unknown as { __tessDb?: Promise<Runner> };

async function connect(): Promise<Runner> {
  const url = process.env.DATABASE_URL;
  let run: Runner;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    run = async (text, params) => (await sql.query(text, params)) as Row[];
  } else {
    if (process.env.VERCEL) throw new Error("DATABASE_URL is not set. Add the Neon connection string in the Vercel project settings.");
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = join(process.env.LOCALAPPDATA || homedir(), "tessellum-dev");
    mkdirSync(dir, { recursive: true });
    const db = new PGlite(join(dir, "pglite"));
    await db.waitReady;
    run = async (text, params) => (await db.query<Row>(text, params)).rows;
  }
  await migrate(run);
  return run;
}

/** Creates the tables on first use. Statements are safe to run again. */
async function migrate(run: Runner) {
  const statements = [
    `create table if not exists users (
      id text primary key,
      email text not null unique,
      name text not null default '',
      password_hash text not null,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )`,
    `create index if not exists sessions_user on sessions(user_id)`,
    `create table if not exists login_attempts (
      email text not null,
      at timestamptz not null default now()
    )`,
    `create index if not exists login_attempts_email on login_attempts(email, at)`,
  ];
  for (const s of statements) await run(s, []);
}

/**
 * Tagged query: values are always sent as parameters, never joined into the SQL text.
 *   const rows = await sql`select * from users where email = ${email}`;
 */
export async function sql<T extends Row = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  // A failed connection is forgotten, so the next request tries again.
  g.__tessDb ??= connect().catch((e) => {
    g.__tessDb = undefined;
    throw e;
  });
  const run = await g.__tessDb;
  const text = strings.reduce((acc, part, i) => acc + part + (i < values.length ? `$${i + 1}` : ""), "");
  return (await run(text, values)) as T[];
}
