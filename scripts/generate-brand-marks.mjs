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
// Two sources are consulted, in order:
//
//   simple-icons          the current release, preferred.
//   simple-icons-legacy   simple-icons v11, pinned. Later releases dropped a
//                         long list of brands (Microsoft, Amazon, Adobe,
//                         Oracle, IBM, Walmart and more), and v11 is the last
//                         one that still carries them.
//
// A ticker is only mapped to a mark that is that company's OWN corporate logo.
// A subsidiary or product logo is not close enough — Match Group is not Tinder
// and VF Corp is not Vans — so those pairings are deliberately absent, as are
// tickers that no longer trade after an acquisition.
//
// simple-icons ships its icons under CC0-1.0. The trademarks remain with their
// owners; the marks are used here only to identify the company behind a ticker.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as currentIcons from "simple-icons";
import * as legacyIcons from "simple-icons-legacy";

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
  RDDT: "reddit", SBUX: "starbucks", SHOP: "shopify",
  SMCI: "supermicro", SNAP: "snapchat", SNOW: "snowflake", SPOT: "spotify",
  SYK: "stryker", T: "atandt", TEAM: "atlassian", TGT: "target",
  TSLA: "tesla", TTWO: "taketwointeractivesoftware", UBER: "uber", V: "visa",
  VZ: "verizon", WFC: "wellsfargo", ZM: "zoom",

  // Brands the current simple-icons release dropped, resolved from v11.
  AAL: "americanairlines", ACN: "accenture", ADBE: "adobe", ADSK: "autodesk",
  AKAM: "akamai", AMZN: "amazon", ANSS: "ansys", ASAN: "asana", BOX: "box",
  CRM: "salesforce", DBX: "dropbox", DOCU: "docusign", ESTC: "elastic",
  ETSY: "etsy", EXPE: "expedia", FSLY: "fastly", FTNT: "fortinet",
  GDDY: "godaddy", GTLB: "gitlab", HLT: "hilton", HMC: "honda", HPQ: "hp",
  HUBS: "hubspot", IBM: "ibm", LCID: "lucid", LOGI: "logitech",
  LUV: "southwestairlines", MSFT: "microsoft", NTAP: "netapp", NXPI: "nxp",
  OKTA: "okta", ORCL: "oracle", PD: "pagerduty", PTON: "peloton",
  ROKU: "roku", SAP: "sap", SHEL: "shell", SQSP: "squarespace",
  STX: "seagate", TM: "toyota", TMUS: "tmobile", TWLO: "twilio",
  U: "unity", UAA: "underarmour", UAL: "unitedairlines", UPS: "ups",
  WDC: "westerndigital", WIX: "wix", WMT: "walmart", YELP: "yelp",
  Z: "zillow", ZG: "zillow"
};

// A few marks are multi-colour, and both icon sets flatten them to a single
// path. Where the real logo is simple enough to state exactly, it is written
// out here instead of being approximated in one colour. Only add a mark here
// if its geometry is unambiguous; anything that needs eyeballing belongs in a
// licensed asset, not in this file.
const EXACT_MARKS = {
  // Four squares, red/green/blue/yellow clockwise from top left.
  MSFT: {
    title: "Microsoft",
    body:
      '<rect x="1" y="1" width="10" height="10" fill="#F25022"/>' +
      '<rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>' +
      '<rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>' +
      '<rect x="13" y="13" width="10" height="10" fill="#FFB900"/>'
  }
};

const OUT_DIR = new URL("../public/brand-marks/", import.meta.url);

function indexBySlug(pack) {
  return new Map(
    Object.values(pack)
      .filter((icon) => icon && typeof icon === "object" && icon.slug)
      .map((icon) => [icon.slug, icon])
  );
}

const current = indexBySlug(currentIcons);
const legacy = indexBySlug(legacyIcons);

function resolve(slug) {
  if (current.has(slug)) return { icon: current.get(slug), source: "current" };
  if (legacy.has(slug)) return { icon: legacy.get(slug), source: "legacy" };
  return null;
}

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
const fromSource = { current: 0, legacy: 0, exact: 0 };

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

function wrapSvg(title, body) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="' +
    escapeAttribute(title) +
    '">' +
    body +
    "</svg>\n"
  );
}

const allSymbols = new Set([
  ...Object.keys(SLUG_BY_SYMBOL),
  ...Object.keys(EXACT_MARKS)
]);

for (const symbol of [...allSymbols].sort()) {
  const exact = EXACT_MARKS[symbol];

  if (exact) {
    writeFileSync(new URL(symbol + ".svg", OUT_DIR), wrapSvg(exact.title, exact.body));
    symbols.push(symbol);
    fromSource.exact += 1;
    continue;
  }

  const slug = SLUG_BY_SYMBOL[symbol];
  const resolved = resolve(slug);

  if (!resolved) {
    missing.push(symbol + " -> " + slug);
    continue;
  }

  const icon = resolved.icon;
  fromSource[resolved.source] += 1;

  const hex = readableHex(icon.hex);
  if (hex !== icon.hex) darkened.push(symbol + " " + icon.hex + " -> " + hex);

  const body = '<path fill="#' + hex + '" d="' + icon.path + '"/>';

  writeFileSync(new URL(symbol + ".svg", OUT_DIR), wrapSvg(icon.title, body));
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
  "// Marks come from simple-icons and simple-icons v11 (both CC0-1.0).",
  "// Trademarks remain with their owners; they identify the company behind a",
  "// ticker.",
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

console.log(
  "Wrote " + symbols.length + " marks to public/brand-marks/ and lib/brand-marks.js " +
  "(" + fromSource.current + " current, " + fromSource.legacy + " legacy, " +
  fromSource.exact + " exact)."
);
if (darkened.length > 0) {
  console.log("Darkened for contrast: " + darkened.join(", "));
}
