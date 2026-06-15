import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.WATCHLIST_DB_PATH || path.join(DATA_DIR, "market-current.db");

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Drop the legacy device_id-keyed watchlist if it exists from a previous
  // version. The migration prompt confirmed we discard old anonymous data.
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watchlist_entries'")
      .all();
    if (tables.length > 0) {
      const cols = db.prepare("PRAGMA table_info(watchlist_entries)").all();
      const hasDeviceId = cols.some((c) => c.name === "device_id");
      const hasUserId = cols.some((c) => c.name === "user_id");
      if (hasDeviceId && !hasUserId) {
        db.exec(`DROP TABLE watchlist_entries;`);
      }
    }
  } catch {
    // table didn't exist — fine, CREATE TABLE below will make it
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      password_hash TEXT,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist_entries (
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      note TEXT DEFAULT '',
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, symbol),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_entries (user_id);
  `);

  dbInstance = db;
  return db;
}

// ---------- Users ----------

export function findUserByEmail(email) {
  if (!email) return null;
  return (
    getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.trim().toLowerCase()) || null
  );
}

export function findUserById(id) {
  if (!id) return null;
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) || null;
}

export function createUser({ email, name, image, passwordHash, provider }) {
  if (!email || !provider) throw new Error("email and provider required");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO users (id, email, name, image, password_hash, provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, email.trim().toLowerCase(), name || null, image || null, passwordHash || null, provider, now);
  return findUserById(id);
}

export function findOrCreateOAuthUser({ email, name, image, provider }) {
  const existing = findUserByEmail(email);
  if (existing) {
    // Backfill name/image if they were missing
    if ((!existing.name && name) || (!existing.image && image)) {
      getDb()
        .prepare("UPDATE users SET name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?")
        .run(name || null, image || null, existing.id);
      return findUserById(existing.id);
    }
    return existing;
  }
  return createUser({ email, name, image, provider, passwordHash: null });
}

// ---------- Watchlist ----------

export function getWatchlist(userId) {
  if (!userId) return [];
  const rows = getDb()
    .prepare(
      "SELECT symbol, note, added_at, updated_at FROM watchlist_entries WHERE user_id = ? ORDER BY added_at DESC"
    )
    .all(userId);

  return rows.map((row) => ({
    symbol: row.symbol,
    note: row.note || "",
    addedAt: row.added_at,
    updatedAt: row.updated_at
  }));
}

export function replaceWatchlist(userId, entries) {
  if (!userId) throw new Error("userId required");
  const db = getDb();
  const deleteAll = db.prepare("DELETE FROM watchlist_entries WHERE user_id = ?");
  const insert = db.prepare(`
    INSERT INTO watchlist_entries (user_id, symbol, note, added_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items) => {
    deleteAll.run(userId);
    const now = new Date().toISOString();
    for (const item of items) {
      const symbol = typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
      if (!symbol) continue;
      insert.run(
        userId,
        symbol,
        typeof item.note === "string" ? item.note : "",
        item.addedAt || now,
        now
      );
    }
  });

  tx(Array.isArray(entries) ? entries : []);
}
