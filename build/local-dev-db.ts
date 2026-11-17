import migration0 from "../drizzle/0000_aberrant_grandmaster.sql?raw";
import migration1 from "../drizzle/0001_clammy_ricochet.sql?raw";
import migration2 from "../drizzle/0002_rich_xorn.sql?raw";

let initialization: Promise<void> | undefined;

function statements(migration: string) {
  return migration
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function hasTable(db: D1Database, table: string) {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(table)
    .first();
  return Boolean(row);
}

async function hasColumn(db: D1Database, table: string, column: string) {
  const result = await db.prepare(`PRAGMA table_info(${table})`).all();
  return result.results.some((row) => row.name === column);
}

async function applyMigration(db: D1Database, migration: string) {
  await db.batch(statements(migration).map((statement) => db.prepare(statement)));
}

async function initialize(db: D1Database) {
  if (!(await hasTable(db, "users"))) await applyMigration(db, migration0);
  if (!(await hasTable(db, "message_feedback")))
    await applyMigration(db, migration1);
  if (!(await hasColumn(db, "users", "profile_completed_at")))
    await applyMigration(db, migration2);
}

export function ensureLocalDevDatabase(db: D1Database) {
  initialization ??= initialize(db);
  return initialization;
}
