import { createClient } from "@libsql/client";
import crypto from "crypto";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Add it (and TURSO_AUTH_TOKEN if remote) to .env.local locally and to your host's environment variables in production."
  );
}

const client = createClient({ url, authToken });

let initPromise = null;

async function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          image TEXT,
          password_hash TEXT,
          provider TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS watchlist_entries (
          user_id TEXT NOT NULL,
          symbol TEXT NOT NULL,
          note TEXT DEFAULT '',
          added_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, symbol)
        )
      `);
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist_entries (user_id)
      `);
    })().catch((err) => {
      // Reset so a retry can succeed if the first call hit a transient error
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

// ---------- Users ----------

export async function findUserByEmail(email) {
  if (!email) return null;
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email.trim().toLowerCase()]
  });
  return result.rows[0] || null;
}

export async function findUserById(id) {
  if (!id) return null;
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [id]
  });
  return result.rows[0] || null;
}

export async function createUser({ email, name, image, passwordHash, provider }) {
  if (!email || !provider) throw new Error("email and provider required");
  await ensureInit();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await client.execute({
    sql: `INSERT INTO users (id, email, name, image, password_hash, provider, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, email.trim().toLowerCase(), name || null, image || null, passwordHash || null, provider, now]
  });
  return findUserById(id);
}

export async function findOrCreateOAuthUser({ email, name, image, provider }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    if ((!existing.name && name) || (!existing.image && image)) {
      await client.execute({
        sql: "UPDATE users SET name = COALESCE(?, name), image = COALESCE(?, image) WHERE id = ?",
        args: [name || null, image || null, existing.id]
      });
      return findUserById(existing.id);
    }
    return existing;
  }
  return createUser({ email, name, image, provider, passwordHash: null });
}

// ---------- Watchlist ----------

export async function getWatchlist(userId) {
  if (!userId) return [];
  await ensureInit();
  const result = await client.execute({
    sql: "SELECT symbol, note, added_at, updated_at FROM watchlist_entries WHERE user_id = ? ORDER BY added_at DESC",
    args: [userId]
  });
  return result.rows.map((row) => ({
    symbol: row.symbol,
    note: row.note || "",
    addedAt: row.added_at,
    updatedAt: row.updated_at
  }));
}

export async function replaceWatchlist(userId, entries) {
  if (!userId) throw new Error("userId required");
  await ensureInit();

  const statements = [
    {
      sql: "DELETE FROM watchlist_entries WHERE user_id = ?",
      args: [userId]
    }
  ];

  const now = new Date().toISOString();
  for (const item of Array.isArray(entries) ? entries : []) {
    const symbol = typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "";
    if (!symbol) continue;
    statements.push({
      sql: `INSERT INTO watchlist_entries (user_id, symbol, note, added_at, updated_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        userId,
        symbol,
        typeof item.note === "string" ? item.note : "",
        item.addedAt || now,
        now
      ]
    });
  }

  // `batch("write")` runs every statement in a single transaction; either all
  // succeed or none of them do.
  await client.batch(statements, "write");
}
