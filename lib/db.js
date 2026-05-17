import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist_entries (
      device_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      note TEXT DEFAULT '',
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (device_id, symbol)
    );
    CREATE INDEX IF NOT EXISTS idx_watchlist_device ON watchlist_entries (device_id);
  `);

  dbInstance = db;
  return db;
}

export function getWatchlist(deviceId) {
  if (!deviceId) return [];
  const rows = getDb()
    .prepare(
      "SELECT symbol, note, added_at, updated_at FROM watchlist_entries WHERE device_id = ? ORDER BY added_at DESC"
    )
    .all(deviceId);

  return rows.map((row) => ({
    symbol: row.symbol,
    note: row.note || "",
    addedAt: row.added_at,
    updatedAt: row.updated_at
  }));
}

export function replaceWatchlist(deviceId, entries) {
  if (!deviceId) throw new Error("deviceId required");
  const db = getDb();
  const deleteAll = db.prepare("DELETE FROM watchlist_entries WHERE device_id = ?");
  const insert = db.prepare(`
    INSERT INTO watchlist_entries (device_id, symbol, note, added_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items) => {
    deleteAll.run(deviceId);
    const now = new Date().toISOString();
    for (const item of items) {
      const symbol = typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
      if (!symbol) continue;
      insert.run(
        deviceId,
        symbol,
        typeof item.note === "string" ? item.note : "",
        item.addedAt || now,
        now
      );
    }
  });

  tx(Array.isArray(entries) ? entries : []);
}

export function upsertWatchlistEntry(deviceId, symbol, note = "") {
  if (!deviceId || !symbol) throw new Error("deviceId and symbol required");
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO watchlist_entries (device_id, symbol, note, added_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (device_id, symbol) DO UPDATE SET
         note = excluded.note,
         updated_at = excluded.updated_at`
    )
    .run(deviceId, symbol.trim().toUpperCase(), note || "", now, now);
}

export function removeWatchlistEntry(deviceId, symbol) {
  if (!deviceId || !symbol) return;
  getDb()
    .prepare("DELETE FROM watchlist_entries WHERE device_id = ? AND symbol = ?")
    .run(deviceId, symbol.trim().toUpperCase());
}
