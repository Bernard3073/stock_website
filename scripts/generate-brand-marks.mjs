// Regenerates public/brand-marks/*.svg and lib/brand-marks.js from simple-icons.
//
// Run with: npm run build-brand-marks
//
// Marks are written as individual SVG files rather than inlined into a JS
// module: at ~40KB gzipped the full set is far too much to ship in the page
// bundle for decoration, and as static files the browser fetches only the
// handful actually on screen and caches them. Self-hosting them means a
// ticker's real logo does not depend on a third-party image host staying up.
// simple-icons is a devDependency; nothing at runtime imports it.
//
// Every entry below is an explicit ticker -> slug pairing. Do not switch this
// to fuzzy matching: an earlier heuristic silently gave Union Pacific (UNP)
// the UPS logo because "up" + "s" happened to resolve.
//
// simple-icons ships its icons under CC0-1.0. The trademarks remain with their
// owners; the marks are used here only to identify the company behind a ticker.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as simpleIcons from "simple-icons";

const SLUG_BY_SYMBOL = {
  AAPL: "apple", ABBV: "abbvie", ABNB: "airbnb", ADP: "adp", AMD: "amd",
  ARM: "arm", AVGO: "broadcom", AXP: "americanexpress", BA: "boeing",
  BABA: "alibabadotcom", BAC: "bankofamerica", BKNG: "bookingdotcom",
  CAT: "caterpillar", COIN: "coinbase", CSCO: "cisco", DAL: "delta",
  DASH: "doordash", DDOG: "datadog", DE: "johndeere", DELL: "dell", EA: "ea",
  EBAY: "ebay", F: "ford", FDX: "fedex", GE: "generalelectric",
  GM: "generalmotors", GOOG: "google", GOOGL: "google", GS: "goldmansachs",
  HOOD: "robinhood", INTC: "intel", INTU: "intuit", KO: "cocacola",
  LYFT: "lyft", MA: "mastercard", MAR: "marriott", MCD: "mcdonalds",
  MDB: "mongodb", META: "meta", MMM: "3m", NET: "cloudflare", NFLX: "netflix",
  NKE: "nike", NVDA: "nvidia", PANW: "paloaltonetworks", PINS: "pinterest",
  PLTR: "palantir", PYPL: "paypal", QCOM: "qualcomm", RBLX: "roblox",
  RDDT: "reddit", SBUX: "starbucks", SE: "shopee", SHOP: "shopify",
  SMCI: "supermicro", SNAP: "snapchat", SNOW: "snowflake", SPOT: "spotify",
  SYK: "stryker", T: "atandt", TEAM: "atlassian", TGT: "target",
  TSLA: "tesla", TTWO: "taketwointeractivesoftware", UBER: "uber", V: "visa",
  VZ: "verizon", WFC: "wellsfargo", ZM: "zoom"
};

const OUT_DIR = new URL("../public/brand-marks/", import.meta.url);

const bySlug = new Map(
  Object.values(simpleIcons)
    .filter((icon) => icon && typeof icon === "object" && icon.slug)
    .map((icon) => [icon.slug, icon])
);

// The white chip a mark sits on would swallow a near-white logo, so those get
// darkened just enough to stay visible.
function readableHex(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  if (luminance <= 0.82) return hex;

  const scale = 0.82 / luminance;
  return [r, g, b]
    .map((channel) => Math.round(channel * scale).toString(16).padStart(2, "0"))
    .join("");
}

function escapeAttribute(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const symbols = [];
const missing = [];
const darkened = [];

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

for (const [symbol, slug] of Object.entries(SLUG_BY_SYMBOL).sort()) {
  const icon = bySlug.get(slug);

  if (!icon) {
    missing.push(symbol + " -> " + slug);
    continue;
  }

  const hex = readableHex(icon.hex);
  if (hex !== icon.hex) darkened.push(symbol + " " + icon.hex + " -> " + hex);

  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="' +
    escapeAttribute(icon.title) +
    '"><path fill="#' +
    hex +
    '" d="' +
    icon.path +
    '"/></svg>\n';

  writeFileSync(new URL(symbol + ".svg", OUT_DIR), svg);
  symbols.push(symbol);
}

if (missing.length > 0) {
  console.error("Unknown simple-icons slugs:\n  " + missing.join("\n  "));
  process.exit(1);
}

const file = [
  "// GENERATED FILE - do not edit by hand.",
  "// Regenerate with: npm run build-brand-marks  (see scripts/generate-brand-marks.mjs)",
  "//",
  "// Tickers with a real brand mark stored at /brand-marks/<SYMBOL>.svg. Only the",
  "// symbol list lives in the bundle; the marks themselves are fetched as static",
  "// files, so adding a mark costs nothing at page load.",
  "//",
  "// Marks come from simple-icons (CC0-1.0). Trademarks remain with their owners;",
  "// they identify the company behind a ticker.",
  "",
  "export const BRAND_MARK_SYMBOLS = new Set([",
  symbols.map((symbol) => "  " + JSON.stringify(symbol)).join(",\n"),
  "]);",
  "",
  "export function getBrandMarkUrl(symbol) {",
  '  if (typeof symbol !== "string") return null;',
  "  const normalized = symbol.trim().toUpperCase();",
  '  return BRAND_MARK_SYMBOLS.has(normalized) ? "/brand-marks/" + normalized + ".svg" : null;',
  "}",
  ""
].join("\n");

writeFileSync(new URL("../lib/brand-marks.js", import.meta.url), file);

console.log("Wrote " + symbols.length + " marks to public/brand-marks/ and lib/brand-marks.js.");
if (darkened.length > 0) {
  console.log("Darkened for contrast: " + darkened.join(", "));
}
