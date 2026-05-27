import Database from 'better-sqlite3'
import path from 'node:path'

export type Db = Database.Database

let _db: Db | null = null
let _dbPath: string | null = null

export function closeDb() {
  if (_db) {
    _db.close()
    _db = null
  }
  _dbPath = null
}

/** Use in tests to run against an isolated in-memory database. */
export function initTestDb(dbPath = ':memory:') {
  closeDb()
  _dbPath = dbPath
  return getDb()
}

export function getDb() {
  if (_db) return _db
  const dbPath = _dbPath ?? path.join(process.cwd(), 'data.sqlite')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  migrate(db)
  _db = db
  return db
}

function migrate(db: Db) {
  db.exec(`
    create table if not exists staff (
      id integer primary key autoincrement,
      name text not null,
      created_at text not null default (datetime('now'))
    );

    create table if not exists weekly_windows (
      id integer primary key autoincrement,
      staff_id integer not null references staff(id) on delete cascade,
      day_of_week integer not null,
      start_min integer not null,
      end_min integer not null
    );

    create table if not exists overrides (
      id integer primary key autoincrement,
      staff_id integer not null references staff(id) on delete cascade,
      date text not null,
      type text not null
    );

    create table if not exists override_windows (
      id integer primary key autoincrement,
      override_id integer not null references overrides(id) on delete cascade,
      start_min integer not null,
      end_min integer not null
    );

    create unique index if not exists idx_overrides_staff_date on overrides(staff_id, date);
    create index if not exists idx_weekly_staff_dow on weekly_windows(staff_id, day_of_week);
    create index if not exists idx_override_windows_override on override_windows(override_id);
  `)
}

