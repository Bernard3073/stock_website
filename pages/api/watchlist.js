import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth-options";
import { getWatchlist, replaceWatchlist } from "../../lib/db";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "You must be signed in to use the watchlist." });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ items: getWatchlist(userId) });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const entries = Array.isArray(body.entries) ? body.entries : [];
      replaceWatchlist(userId, entries);
      return res.status(200).json({ items: getWatchlist(userId) });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Database error"
    });
  }
}
