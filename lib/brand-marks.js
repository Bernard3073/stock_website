// GENERATED FILE - do not edit by hand.
// Regenerate with: npm run build-brand-marks  (see scripts/generate-brand-marks.mjs)
//
// Tickers with a real brand mark stored at /brand-marks/<SYMBOL>.svg. Only the
// symbol list lives in the bundle; the marks themselves are fetched as static
// files, so adding a mark costs nothing at page load.
//
// Marks come from simple-icons (CC0-1.0). Trademarks remain with their owners;
// they identify the company behind a ticker.

export const BRAND_MARK_SYMBOLS = new Set([
  "AAPL",
  "ABBV",
  "ABNB",
  "ADP",
  "AMD",
  "ARM",
  "AVGO",
  "AXP",
  "BA",
  "BABA",
  "BAC",
  "BKNG",
  "CAT",
  "COIN",
  "CSCO",
  "DAL",
  "DASH",
  "DDOG",
  "DE",
  "DELL",
  "EA",
  "EBAY",
  "F",
  "FDX",
  "GE",
  "GM",
  "GOOG",
  "GOOGL",
  "GS",
  "HOOD",
  "INTC",
  "INTU",
  "KO",
  "LYFT",
  "MA",
  "MAR",
  "MCD",
  "MDB",
  "META",
  "MMM",
  "NET",
  "NFLX",
  "NKE",
  "NVDA",
  "PANW",
  "PINS",
  "PLTR",
  "PYPL",
  "QCOM",
  "RBLX",
  "RDDT",
  "SBUX",
  "SE",
  "SHOP",
  "SMCI",
  "SNAP",
  "SNOW",
  "SPOT",
  "SYK",
  "T",
  "TEAM",
  "TGT",
  "TSLA",
  "TTWO",
  "UBER",
  "V",
  "VZ",
  "WFC",
  "ZM"
]);

export function getBrandMarkUrl(symbol) {
  if (typeof symbol !== "string") return null;
  const normalized = symbol.trim().toUpperCase();
  return BRAND_MARK_SYMBOLS.has(normalized) ? "/brand-marks/" + normalized + ".svg" : null;
}
