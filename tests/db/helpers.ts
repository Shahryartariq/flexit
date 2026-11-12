import { randomUUID } from "node:crypto";
import pg from "pg";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type Db = pg.PoolClient;

let pool: pg.Pool | undefined;

export function getPool() {
  pool ??= new pg.Pool({ connectionString: DATABASE_URL, max: 4 });
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = undefined;
}

/** Runs `fn` inside a transaction that is always rolled back. */
export async function inTransaction(fn: (db: Db) => Promise<void>) {
  const db = await getPool().connect();
  try {
    await db.query("begin");
    await fn(db);
  } finally {
    await db.query("rollback").catch(() => undefined);
    db.release();
  }
}

/** Creates an auth user the way Supabase Auth would; the trigger adds the profile. */
export async function createUser(
  db: Db,
  meta: Record<string, unknown> = {},
  email = `${randomUUID().slice(0, 8)}@example.com`,
) {
  const id = randomUUID();
  await db.query("reset role");
  await db.query(
    "insert into auth.users (id, email, aud, role, raw_user_meta_data) values ($1, $2, 'authenticated', 'authenticated', $3)",
    [id, email, JSON.stringify(meta)],
  );
  return id;
}

/** Switches the transaction to the given user (or to anon when id is null). */
export async function actAs(db: Db, id: string | null) {
  await db.query("reset role");
  if (id) {
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: id, role: "authenticated" }),
    ]);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    await db.query("set local role authenticated");
  } else {
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "anon" }),
    ]);
    await db.query("select set_config('request.jwt.claim.sub', '', true)");
    await db.query("set local role anon");
  }
}

/** Runs a statement and returns its error message, or null when it succeeded. */
export async function tryQuery(db: Db, sql: string, params: unknown[] = []) {
  await db.query("savepoint attempt");
  try {
    await db.query(sql, params);
    await db.query("release savepoint attempt");
    return null;
  } catch (error) {
    await db.query("rollback to savepoint attempt");
    return error instanceof Error ? error.message : String(error);
  }
}

export async function rowCount(db: Db, sql: string, params: unknown[] = []) {
  const result = await db.query(sql, params);
  return result.rowCount ?? 0;
}
