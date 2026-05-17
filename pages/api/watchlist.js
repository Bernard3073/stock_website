import { getWatchlist, replaceWatchlist } from "../../lib/db";

function getDeviceId(req) {
  const fromHeader = typeof req.headers["x-device-id"] === "string" ? req.headers["x-device-id"] : null;
  const fromQuery = typeof req.query.deviceId === "string" ? req.query.deviceId : null;
  const value = (fromHeader || fromQuery || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) return "";
  return value;
}

export default function handler(req, res) {
  const deviceId = getDeviceId(req);
  if (!deviceId) {
    return res.status(400).json({ message: "Missing or invalid device id" });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ items: getWatchlist(deviceId) });
    }

    if (req.method === "PUT") {
      const body = req.body || {};
      const entries = Array.isArray(body.entries) ? body.entries : [];
      replaceWatchlist(deviceId, entries);
      return res.status(200).json({ items: getWatchlist(deviceId) });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Database error"
    });
  }
}
