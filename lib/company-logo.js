// Resolves a company icon for a ticker without needing an API key.
//
// Icons come from public favicon services keyed by the company's domain. The
// domain is taken from the Yahoo asset profile when we have it, and otherwise
// from the curated map below so that common tickers still get an icon before
// any profile data has loaded. Anything we cannot resolve — ETFs, indices,
// thinly covered tickers — falls back to a monogram tile drawn from the symbol.

const DOMAIN_BY_SYMBOL = {
  AAPL: "apple.com",
  ABBV: "abbvie.com",
  ABNB: "airbnb.com",
  ADBE: "adobe.com",
  AMD: "amd.com",
  AMZN: "amazon.com",
  AVGO: "broadcom.com",
  AXP: "americanexpress.com",
  BA: "boeing.com",
  BABA: "alibabagroup.com",
  BAC: "bankofamerica.com",
  "BRK-B": "berkshirehathaway.com",
  C: "citigroup.com",
  CAT: "caterpillar.com",
  COIN: "coinbase.com",
  COST: "costco.com",
  CRM: "salesforce.com",
  CRWD: "crowdstrike.com",
  CSCO: "cisco.com",
  CVX: "chevron.com",
  DAL: "delta.com",
  DDOG: "datadoghq.com",
  DIS: "disney.com",
  F: "ford.com",
  FDX: "fedex.com",
  GE: "ge.com",
  GM: "gm.com",
  GOOG: "abc.xyz",
  GOOGL: "abc.xyz",
  GS: "goldmansachs.com",
  HD: "homedepot.com",
  HOOD: "robinhood.com",
  IBM: "ibm.com",
  INTC: "intel.com",
  JNJ: "jnj.com",
  JPM: "jpmorganchase.com",
  KO: "coca-colacompany.com",
  LLY: "lilly.com",
  LMT: "lockheedmartin.com",
  MA: "mastercard.com",
  MCD: "mcdonalds.com",
  MDB: "mongodb.com",
  META: "meta.com",
  MRNA: "modernatx.com",
  MRVL: "marvell.com",
  MS: "morganstanley.com",
  MSFT: "microsoft.com",
  MU: "micron.com",
  NET: "cloudflare.com",
  NFLX: "netflix.com",
  NKE: "nike.com",
  NOW: "servicenow.com",
  NVDA: "nvidia.com",
  ORCL: "oracle.com",
  PANW: "paloaltonetworks.com",
  PEP: "pepsico.com",
  PFE: "pfizer.com",
  PG: "pg.com",
  PLTR: "palantir.com",
  PYPL: "paypal.com",
  QCOM: "qualcomm.com",
  RBLX: "roblox.com",
  RIVN: "rivian.com",
  SBUX: "starbucks.com",
  SHOP: "shopify.com",
  SNAP: "snap.com",
  SNOW: "snowflake.com",
  SOFI: "sofi.com",
  SQ: "block.xyz",
  T: "att.com",
  TGT: "target.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  TXN: "ti.com",
  UBER: "uber.com",
  UNH: "unitedhealthgroup.com",
  V: "visa.com",
  VZ: "verizon.com",
  WFC: "wellsfargo.com",
  WMT: "walmart.com",
  XOM: "exxonmobil.com",
  ZM: "zoom.us"
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

// Ordered icon candidates. DuckDuckGo answers with a 404 for domains it does
// not know, so a failure there can fall through; Google always answers with
// something, which makes it the right last stop before the monogram.
export function getLogoSources(symbol, website) {
  const domain = getCompanyDomain(symbol, website);
  if (!domain) return [];

  return [
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
  ];
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
