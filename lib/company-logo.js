import { getBrandMarkUrl } from "./brand-marks.js";

// Resolves a company's brand mark for a ticker.
//
// The goal is the real logo — the McDonald's arches for MCD, not an "MC" tile.
// Candidates are tried in order and each one falls through to the next when the
// image fails to load:
//
//   1. A brand mark we host ourselves at /brand-marks/<SYMBOL>.svg. Vector, no
//      network dependency, and verified at build time, so this is the only
//      source we can actually promise. Covers ~120 widely held tickers; run
//      `npm run build-brand-marks` after editing that list.
//   2. logo.dev, keyed by ticker — only when NEXT_PUBLIC_LOGO_DEV_TOKEN is set.
//      Off by default. This is the one source that covers the whole market,
//      including the large caps no free icon set carries (Disney, PepsiCo,
//      JPMorgan, Costco, Exxon, Pfizer and the like), so setting a publishable
//      token is what closes the remaining gap.
//   3. Parqet's public logo assets, keyed by ticker. Proper brand marks, and it
//      needs no domain, so it works for tickers we have no profile for.
//   4. The site's apple-touch-icon via DuckDuckGo, keyed by domain. Modern
//      brands ship a 180px version of their mark here.
//   5. Google's favicon service at 128px, keyed by domain. Lowest fidelity but
//      the most reliable, so it goes last.
//
// Only when every source fails do we draw a monogram, which keeps ETFs,
// indices, and thinly covered tickers looking deliberate instead of broken.
//
// The domain comes from the Yahoo asset profile when we have it, and otherwise
// from the curated map below so common tickers get a mark on first paint.

const DOMAIN_BY_SYMBOL = {
  AAPL: "apple.com",
  ABBV: "abbvie.com",
  ABNB: "airbnb.com",
  ADBE: "adobe.com",
  ADP: "adp.com",
  AMAT: "appliedmaterials.com",
  AMD: "amd.com",
  AMGN: "amgen.com",
  AMZN: "amazon.com",
  APP: "applovin.com",
  ARM: "arm.com",
  ASML: "asml.com",
  AVGO: "broadcom.com",
  AXP: "americanexpress.com",
  BA: "boeing.com",
  BABA: "alibabagroup.com",
  BAC: "bankofamerica.com",
  BKNG: "bookingholdings.com",
  BMY: "bms.com",
  "BRK-B": "berkshirehathaway.com",
  BX: "blackstone.com",
  C: "citigroup.com",
  CAT: "caterpillar.com",
  CAVA: "cava.com",
  CELH: "celsiusholdings.com",
  CL: "colgatepalmolive.com",
  CMCSA: "comcast.com",
  CMG: "chipotle.com",
  COIN: "coinbase.com",
  COP: "conocophillips.com",
  COST: "costco.com",
  CRM: "salesforce.com",
  CRWD: "crowdstrike.com",
  CSCO: "cisco.com",
  CVS: "cvshealth.com",
  CVX: "chevron.com",
  DAL: "delta.com",
  DASH: "doordash.com",
  DDOG: "datadoghq.com",
  DE: "deere.com",
  DELL: "dell.com",
  DIS: "disney.com",
  DKNG: "draftkings.com",
  DPZ: "dominos.com",
  EA: "ea.com",
  EBAY: "ebay.com",
  F: "ford.com",
  FDX: "fedex.com",
  GE: "ge.com",
  GILD: "gilead.com",
  GM: "gm.com",
  GOOG: "abc.xyz",
  GOOGL: "abc.xyz",
  GS: "goldmansachs.com",
  HD: "homedepot.com",
  HON: "honeywell.com",
  HOOD: "robinhood.com",
  IBM: "ibm.com",
  INTC: "intel.com",
  INTU: "intuit.com",
  ISRG: "intuitive.com",
  JD: "jd.com",
  JNJ: "jnj.com",
  JPM: "jpmorganchase.com",
  KLAC: "kla.com",
  KO: "coca-colacompany.com",
  LLY: "lilly.com",
  LMT: "lockheedmartin.com",
  LOW: "lowes.com",
  LRCX: "lamresearch.com",
  LULU: "lululemon.com",
  LYFT: "lyft.com",
  MA: "mastercard.com",
  MAR: "marriott.com",
  MCD: "mcdonalds.com",
  MDB: "mongodb.com",
  MDLZ: "mondelezinternational.com",
  MDT: "medtronic.com",
  META: "meta.com",
  MMM: "3m.com",
  MRNA: "modernatx.com",
  MRVL: "marvell.com",
  MS: "morganstanley.com",
  MSFT: "microsoft.com",
  MU: "micron.com",
  NET: "cloudflare.com",
  NFLX: "netflix.com",
  NIO: "nio.com",
  NKE: "nike.com",
  NOC: "northropgrumman.com",
  NOW: "servicenow.com",
  NVDA: "nvidia.com",
  ORCL: "oracle.com",
  PANW: "paloaltonetworks.com",
  PDD: "pddholdings.com",
  PEP: "pepsico.com",
  PFE: "pfizer.com",
  PG: "pg.com",
  PINS: "pinterest.com",
  PLTR: "palantir.com",
  PM: "pmi.com",
  PYPL: "paypal.com",
  QCOM: "qualcomm.com",
  RBLX: "roblox.com",
  RCL: "royalcaribbean.com",
  RDDT: "redditinc.com",
  REGN: "regeneron.com",
  RIVN: "rivian.com",
  RTX: "rtx.com",
  SBUX: "starbucks.com",
  SCHW: "schwab.com",
  SE: "sea.com",
  SHOP: "shopify.com",
  SMCI: "supermicro.com",
  SNAP: "snap.com",
  SNOW: "snowflake.com",
  SOFI: "sofi.com",
  SPGI: "spglobal.com",
  SPOT: "spotify.com",
  SQ: "block.xyz",
  SYK: "stryker.com",
  T: "att.com",
  TEAM: "atlassian.com",
  TGT: "target.com",
  TJX: "tjx.com",
  TMO: "thermofisher.com",
  TMUS: "t-mobile.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  TTD: "thetradedesk.com",
  TTWO: "take2games.com",
  TXN: "ti.com",
  UBER: "uber.com",
  ULTA: "ulta.com",
  UNH: "unitedhealthgroup.com",
  UNP: "up.com",
  UPS: "ups.com",
  V: "visa.com",
  VRTX: "vrtx.com",
  VZ: "verizon.com",
  WBD: "wbd.com",
  WDAY: "workday.com",
  WFC: "wellsfargo.com",
  WM: "wm.com",
  WMT: "walmart.com",
  XOM: "exxonmobil.com",
  YUM: "yum.com",
  ZM: "zoom.us",
  ZS: "zscaler.com",
  ZTS: "zoetis.com"
};

export function normalizeSymbol(symbol) {
  return typeof symbol === "string" ? symbol.trim().toUpperCase() : "";
}

// Turns a Yahoo profile website ("https://www.apple.com/") into "apple.com".
export function websiteToDomain(website) {
  if (typeof website !== "string" || !website.trim()) return null;

  const withScheme = /^https?:\/\//i.test(website) ? website : `https://${website.trim()}`;

  try {
    const host = new URL(withScheme).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function getCompanyDomain(symbol, website) {
  return websiteToDomain(website) || DOMAIN_BY_SYMBOL[normalizeSymbol(symbol)] || null;
}

// A logo.dev publishable token ("pk_..."). Inlined at build time by Next, so it
// must carry the NEXT_PUBLIC_ prefix to reach the browser. Publishable tokens
// are meant to be visible in page source; do not put a secret key here.
const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || "";

// A plain ticker is safe to look up by symbol; class shares (BRK-B), indices
// (^GSPC), and crypto pairs (BTC-USD) have no brand mark to find.
function isPlainTicker(symbol) {
  return /^[A-Z]{1,5}$/.test(symbol);
}

// Ordered icon candidates, best fidelity first. Each falls through to the next
// when the image fails to load, and an empty list means "draw the monogram".
export function getLogoSources(symbol, website) {
  const normalized = normalizeSymbol(symbol);
  const domain = getCompanyDomain(symbol, website);
  const sources = [];

  const ownMark = getBrandMarkUrl(normalized);
  if (ownMark) {
    sources.push(ownMark);
  }

  if (isPlainTicker(normalized)) {
    if (LOGO_DEV_TOKEN) {
      sources.push(
        `https://img.logo.dev/ticker/${normalized}` +
          `?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=128&format=png&retries=0`
      );
    }

    sources.push(`https://assets.parqet.com/logos/symbol/${normalized}?format=png&size=128`);
  }

  if (domain) {
    sources.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    sources.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
  }

  return sources;
}

export function getMonogram(symbol, name) {
  const normalized = normalizeSymbol(symbol);
  if (normalized) return normalized.replace(/[^A-Z0-9]/g, "").slice(0, 2) || normalized.slice(0, 2);
  if (typeof name === "string" && name.trim()) return name.trim().slice(0, 2).toUpperCase();
  return "?";
}

// Stable hue per symbol so a company keeps the same tile colour across the page.
export function getSymbolHue(symbol) {
  const normalized = normalizeSymbol(symbol) || "?";
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 360;
  }

  return hash;
}
