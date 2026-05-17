const FALLBACK_STOCKS = [
  {
    symbol: "NVDA",
    shortName: "NVIDIA Corporation",
    regularMarketPrice: 116.52,
    marketChangePercent: 3.82,
    regularMarketVolume: 48215000,
    regularMarketDayLow: 112.3,
    regularMarketDayHigh: 117.18
  },
  {
    symbol: "AAPL",
    shortName: "Apple Inc.",
    regularMarketPrice: 211.48,
    marketChangePercent: 1.16,
    regularMarketVolume: 57310000,
    regularMarketDayLow: 208.67,
    regularMarketDayHigh: 212.02
  },
  {
    symbol: "TSLA",
    shortName: "Tesla, Inc.",
    regularMarketPrice: 177.61,
    marketChangePercent: 2.77,
    regularMarketVolume: 91822000,
    regularMarketDayLow: 173.55,
    regularMarketDayHigh: 179.4
  },
  {
    symbol: "AMD",
    shortName: "Advanced Micro Devices, Inc.",
    regularMarketPrice: 152.13,
    marketChangePercent: 2.04,
    regularMarketVolume: 44783000,
    regularMarketDayLow: 149.84,
    regularMarketDayHigh: 153.01
  },
  {
    symbol: "MSFT",
    shortName: "Microsoft Corporation",
    regularMarketPrice: 428.1,
    marketChangePercent: 0.94,
    regularMarketVolume: 22894000,
    regularMarketDayLow: 424.72,
    regularMarketDayHigh: 429.52
  },
  {
    symbol: "META",
    shortName: "Meta Platforms, Inc.",
    regularMarketPrice: 488.37,
    marketChangePercent: 1.44,
    regularMarketVolume: 14682000,
    regularMarketDayLow: 481.26,
    regularMarketDayHigh: 489.91
  },
  {
    symbol: "AMZN",
    shortName: "Amazon.com, Inc.",
    regularMarketPrice: 186.54,
    marketChangePercent: 0.81,
    regularMarketVolume: 31442000,
    regularMarketDayLow: 184.01,
    regularMarketDayHigh: 187.28
  },
  {
    symbol: "PLTR",
    shortName: "Palantir Technologies Inc.",
    regularMarketPrice: 25.18,
    marketChangePercent: 4.92,
    regularMarketVolume: 69572000,
    regularMarketDayLow: 23.88,
    regularMarketDayHigh: 25.49
  }
];

const FALLBACK_NEWS = [
  {
    symbol: "NVDA",
    title: "NVIDIA stays in focus as AI spending remains a market driver",
    link: "https://finance.yahoo.com/quote/NVDA",
    publishedAt: "Morning briefing",
    source: "Fallback market brief"
  },
  {
    symbol: "AAPL",
    title: "Apple traders watch hardware demand and services momentum",
    link: "https://finance.yahoo.com/quote/AAPL",
    publishedAt: "Morning briefing",
    source: "Fallback market brief"
  },
  {
    symbol: "TSLA",
    title: "Tesla remains a high-volume name as traders monitor delivery updates",
    link: "https://finance.yahoo.com/quote/TSLA",
    publishedAt: "Morning briefing",
    source: "Fallback market brief"
  },
  {
    symbol: "AMD",
    title: "AMD stays on watchlists as semiconductor names react to data-center demand",
    link: "https://finance.yahoo.com/quote/AMD",
    publishedAt: "Morning briefing",
    source: "Fallback market brief"
  }
];

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    },
    next: {
      revalidate: 900
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.text();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripHtml(value) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

function readNumeric(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && typeof value.raw === "number") {
    return Number.isFinite(value.raw) ? value.raw : null;
  }
  return null;
}

function mapQuoteToStock(quote, index) {
  return {
    rank: index + 1,
    symbol: quote.symbol,
    shortName: quote.shortName || quote.longName || quote.symbol,
    regularMarketPrice: readNumeric(quote.regularMarketPrice),
    marketChangePercent: readNumeric(quote.regularMarketChangePercent),
    regularMarketVolume: readNumeric(quote.regularMarketVolume),
    regularMarketDayLow: readNumeric(quote.regularMarketDayLow),
    regularMarketDayHigh: readNumeric(quote.regularMarketDayHigh)
  };
}

function mapChartToStock(payload, index, override = {}) {
  const result = payload.chart?.result?.[0];
  const meta = result?.meta || {};
  const regularMarketPrice = toNumber(meta.regularMarketPrice);
  const previousClose = toNumber(meta.chartPreviousClose);
  const marketChangePercent =
    regularMarketPrice !== null && previousClose !== null && previousClose !== 0
      ? ((regularMarketPrice - previousClose) / previousClose) * 100
      : null;

  return {
    rank: index + 1,
    symbol: override.symbol || meta.symbol || "--",
    shortName: override.shortName || meta.shortName || meta.longName || meta.symbol || "Unknown",
    regularMarketPrice,
    marketChangePercent,
    regularMarketVolume: toNumber(meta.regularMarketVolume),
    regularMarketDayLow: toNumber(meta.regularMarketDayLow),
    regularMarketDayHigh: toNumber(meta.regularMarketDayHigh)
  };
}

function buildFallbackPayload(reason) {
  return {
    fetchedAt: new Date().toISOString(),
    source: reason,
    news: FALLBACK_NEWS,
    stocks: FALLBACK_STOCKS.map((stock, index) => ({
      rank: index + 1,
      ...stock
    }))
  };
}

async function fetchChartBySymbol(symbol) {
  return fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  );
}

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let crumbCache = null;
let cookieCache = "";
let crumbExpires = 0;

function extractCookies(response) {
  const getter = response.headers.getSetCookie;
  if (typeof getter === "function") {
    const cookies = getter.call(response.headers);
    return cookies.map((c) => c.split(";")[0]).join("; ");
  }
  const raw = response.headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function getCrumbAndCookie() {
  if (crumbCache && Date.now() < crumbExpires) {
    return { crumb: crumbCache, cookie: cookieCache };
  }

  const initRes = await fetch("https://fc.yahoo.com/", {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": YAHOO_UA }
  });
  const cookies = extractCookies(initRes);
  if (!cookies) throw new Error("No Yahoo cookies received");

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": YAHOO_UA, Cookie: cookies }
  });
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error("Invalid crumb response");

  crumbCache = crumb;
  cookieCache = cookies;
  crumbExpires = Date.now() + 60 * 60 * 1000;

  return { crumb, cookie: cookies };
}

async function fetchFundamentals(symbol) {
  const modules =
    "incomeStatementHistory,earnings,earningsHistory,financialData,recommendationTrend";

  async function tryFetch(host, withAuth) {
    let url = `https://${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
    const headers = { "User-Agent": YAHOO_UA };
    if (withAuth) {
      try {
        const { crumb, cookie } = await getCrumbAndCookie();
        url += `&crumb=${encodeURIComponent(crumb)}`;
        headers.Cookie = cookie;
      } catch {
        return null;
      }
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return res.json();
  }

  try {
    let data = await tryFetch("query1.finance.yahoo.com", true);
    if (!data) data = await tryFetch("query2.finance.yahoo.com", true);
    if (!data) data = await tryFetch("query1.finance.yahoo.com", false);
    return data;
  } catch {
    return null;
  }
}

function getRaw(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value.raw === "number") return Number.isFinite(value.raw) ? value.raw : null;
  return null;
}

function mapFundamentals(payload) {
  if (!payload) return null;
  const result = payload.quoteSummary?.result?.[0];
  if (!result) return null;

  const annualStmts = result.incomeStatementHistory?.incomeStatementHistory || [];
  const earningsChart = result.earnings?.earningsChart;
  const financialsChart = result.earnings?.financialsChart;
  const epsHistory = result.earningsHistory?.history || [];

  const annualIncome = annualStmts
    .map((stmt) => ({
      endDate: stmt.endDate?.fmt || null,
      totalRevenue: getRaw(stmt.totalRevenue),
      grossProfit: getRaw(stmt.grossProfit),
      operatingIncome: getRaw(stmt.operatingIncome),
      netIncome: getRaw(stmt.netIncome)
    }))
    .filter((s) => s.endDate);

  const quarterlyEarnings = (earningsChart?.quarterly || [])
    .map((q) => ({
      date: q.date,
      actual: getRaw(q.actual),
      estimate: getRaw(q.estimate)
    }))
    .filter((q) => q.date);

  const annualFinancials = (financialsChart?.yearly || [])
    .map((y) => ({
      date: String(y.date),
      revenue: getRaw(y.revenue),
      earnings: getRaw(y.earnings)
    }))
    .filter((y) => y.date);

  const quarterlyFinancials = (financialsChart?.quarterly || [])
    .map((q) => ({
      date: q.date,
      revenue: getRaw(q.revenue),
      earnings: getRaw(q.earnings)
    }))
    .filter((q) => q.date);

  const epsHistoryMapped = epsHistory
    .map((h) => ({
      quarter: h.quarter?.fmt || null,
      period: h.period || null,
      actual: getRaw(h.epsActual),
      estimate: getRaw(h.epsEstimate),
      surprisePercent: getRaw(h.surprisePercent)
    }))
    .filter((h) => h.quarter);

  const financialData = result.financialData || {};
  const trendRaw = result.recommendationTrend?.trend || [];

  const trend = trendRaw
    .map((t) => ({
      period: t.period || null,
      strongBuy: getRaw(t.strongBuy) ?? 0,
      buy: getRaw(t.buy) ?? 0,
      hold: getRaw(t.hold) ?? 0,
      sell: getRaw(t.sell) ?? 0,
      strongSell: getRaw(t.strongSell) ?? 0
    }))
    .filter((t) => t.period);

  const analystInsights = {
    recommendationKey:
      typeof financialData.recommendationKey === "string" && financialData.recommendationKey !== "none"
        ? financialData.recommendationKey
        : null,
    recommendationMean: getRaw(financialData.recommendationMean),
    numberOfAnalysts: getRaw(financialData.numberOfAnalystOpinions),
    currentPrice: getRaw(financialData.currentPrice),
    targetMean: getRaw(financialData.targetMeanPrice),
    targetMedian: getRaw(financialData.targetMedianPrice),
    targetHigh: getRaw(financialData.targetHighPrice),
    targetLow: getRaw(financialData.targetLowPrice),
    trend
  };

  const hasAnalystData =
    analystInsights.recommendationKey !== null ||
    analystInsights.recommendationMean !== null ||
    analystInsights.targetMean !== null ||
    trend.length > 0;

  if (
    annualIncome.length === 0 &&
    quarterlyEarnings.length === 0 &&
    annualFinancials.length === 0 &&
    epsHistoryMapped.length === 0 &&
    !hasAnalystData
  ) {
    return null;
  }

  return {
    annualIncome,
    quarterlyEarnings,
    annualFinancials,
    quarterlyFinancials,
    epsHistory: epsHistoryMapped,
    analystInsights: hasAnalystData ? analystInsights : null
  };
}

async function fetchChartHistory(symbol, range = "1mo") {
  return fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  );
}

function buildHistoryFromChart(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const adj = result?.indicators?.adjclose?.[0] || {};

  return timestamps.map((time, index) => ({
    time: time * 1000,
    open: toNumber(quote.open?.[index]),
    high: toNumber(quote.high?.[index]),
    low: toNumber(quote.low?.[index]),
    close: toNumber(quote.close?.[index]),
    volume: toNumber(quote.volume?.[index]),
    adjustedClose: toNumber(adj.adjclose?.[index])
  })).filter((entry) => typeof entry.close === "number");
}

async function fetchSearchResults(query, maxResults = 8) {
  const searchResponse = await fetchJson(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${maxResults}&newsCount=0`
  );

  return searchResponse.quotes || [];
}

async function fetchNewsForStocks(stocks) {
  const candidates = stocks.slice(0, 6);

  try {
    const newsGroups = await Promise.all(
      candidates.map(async (stock) => {
        const searchTerm = encodeURIComponent(`${stock.symbol} stock`);
        const rss = await fetchText(
          `https://news.google.com/rss/search?q=${searchTerm}&hl=en-US&gl=US&ceid=US:en`
        );
        const itemMatches = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 1);

        return itemMatches.map((match) => {
          const item = match[1];
          const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
          const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
          const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
          const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);

          return {
            symbol: stock.symbol,
            title: stripHtml(titleMatch?.[1] || `${stock.symbol} market update`),
            link: decodeHtmlEntities(linkMatch?.[1] || `https://finance.yahoo.com/quote/${stock.symbol}`),
            publishedAt: decodeHtmlEntities(dateMatch?.[1] || "Latest"),
            source: stripHtml(sourceMatch?.[1] || "Google News")
          };
        });
      })
    );

    const flattened = newsGroups.flat().filter((item) => item.title && item.link);

    return flattened.length ? flattened : FALLBACK_NEWS;
  } catch {
    return FALLBACK_NEWS;
  }
}

export async function getStockQuoteBySymbol(symbol) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    throw new Error("Enter a stock symbol.");
  }

  const matches = await fetchSearchResults(normalizedSymbol, 10);
  const match = matches.find((entry) => entry.symbol === normalizedSymbol) || matches[0];

  if (!match) {
    throw new Error(`No market data found for ${normalizedSymbol}.`);
  }

  const chartPayload = await fetchChartBySymbol(match.symbol);

  return mapChartToStock(chartPayload, 0, {
    symbol: match.symbol,
    shortName: match.shortname || match.longname || match.symbol
  });
}

export async function getStockQuoteWithHistory(symbol, range = "1mo", options = {}) {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    throw new Error("Enter a stock symbol.");
  }

  const matches = await fetchSearchResults(normalizedSymbol, 10);
  const match = matches.find((entry) => entry.symbol === normalizedSymbol) || matches[0];

  if (!match) {
    throw new Error(`No market data found for ${normalizedSymbol}.`);
  }

  const requests = [
    fetchChartBySymbol(match.symbol),
    fetchChartHistory(match.symbol, range)
  ];

  if (!options.skipFundamentals) {
    requests.push(fetchFundamentals(match.symbol));
  }

  const results = await Promise.all(requests);
  const chartPayload = results[0];
  const historyPayload = results[1];
  const fundamentalsPayload = options.skipFundamentals ? null : results[2];

  const stock = mapChartToStock(chartPayload, 0, {
    symbol: match.symbol,
    shortName: match.shortname || match.longname || match.symbol
  });

  return {
    stock,
    history: buildHistoryFromChart(historyPayload),
    chartRange: range,
    fundamentals: options.skipFundamentals ? undefined : mapFundamentals(fundamentalsPayload)
  };
}

export async function searchStocks(query) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  try {
    const matches = await fetchSearchResults(normalizedQuery, 8);

    return matches
      .filter((entry) => entry.symbol && (entry.quoteType === "EQUITY" || entry.quoteType === "ETF"))
      .map((entry) => ({
        symbol: entry.symbol,
        shortName: entry.shortname || entry.longname || entry.symbol,
        exchange: entry.exchDisp || entry.exchange || "",
        type: entry.typeDisp || entry.quoteType || ""
      }));
  } catch {
    return FALLBACK_STOCKS.filter((stock) => {
      const value = normalizedQuery.toLowerCase();

      return (
        stock.symbol.toLowerCase().includes(value) || stock.shortName.toLowerCase().includes(value)
      );
    }).slice(0, 8).map((stock) => ({
      symbol: stock.symbol,
      shortName: stock.shortName,
      exchange: "Fallback",
      type: "equity"
    }));
  }
}

export async function getTrendingStocks() {
  let symbols = [];

  try {
    const trendingResponse = await fetchJson(
      "https://query1.finance.yahoo.com/v1/finance/trending/US"
    );

    symbols =
      trendingResponse.finance?.result?.[0]?.quotes
        ?.map((quote) => quote.symbol)
        .filter(Boolean)
        .slice(0, 12) || [];
  } catch {
    return buildFallbackPayload("Curated fallback list");
  }

  if (symbols.length === 0) {
    return buildFallbackPayload("Curated fallback list");
  }

  try {
    const stocks = await Promise.all(
      symbols.map(async (symbol, index) => {
        try {
          const chartPayload = await fetchChartBySymbol(symbol);

          return mapChartToStock(chartPayload, index, {
            symbol
          });
        } catch {
          const fallbackStock = FALLBACK_STOCKS.find((stock) => stock.symbol === symbol);

          return {
            rank: index + 1,
            symbol,
            shortName: fallbackStock?.shortName || symbol,
            regularMarketPrice: fallbackStock?.regularMarketPrice ?? null,
            marketChangePercent: fallbackStock?.marketChangePercent ?? null,
            regularMarketVolume: fallbackStock?.regularMarketVolume ?? null,
            regularMarketDayLow: fallbackStock?.regularMarketDayLow ?? null,
            regularMarketDayHigh: fallbackStock?.regularMarketDayHigh ?? null
          };
        }
      })
    );

    const rankedStocks = stocks
      .sort((left, right) => {
        const leftMove = left.marketChangePercent ?? Number.NEGATIVE_INFINITY;
        const rightMove = right.marketChangePercent ?? Number.NEGATIVE_INFINITY;

        return rightMove - leftMove;
      })
      .map((stock, index) => ({
        ...stock,
        rank: index + 1
      }));

    const news = await fetchNewsForStocks(rankedStocks);

    return {
      fetchedAt: new Date().toISOString(),
      source: "Yahoo Finance trending feed",
      news,
      stocks: rankedStocks
    };
  } catch {
    return buildFallbackPayload("Curated fallback list");
  }
}

async function fetchScreener(scrId, count) {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${encodeURIComponent(
    scrId
  )}&count=${count}&lang=en-US&region=US`;

  try {
    return await fetchJson(url);
  } catch {
    try {
      const { crumb, cookie } = await getCrumbAndCookie();
      const res = await fetch(`${url}&crumb=${encodeURIComponent(crumb)}`, {
        headers: { "User-Agent": YAHOO_UA, Cookie: cookie }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

function rankStocks(stocks) {
  return stocks.map((stock, index) => ({ ...stock, rank: index + 1 }));
}

export async function getTopGainers(count = 10) {
  const payload = await fetchScreener("day_gainers", count);
  const quotes = payload?.finance?.result?.[0]?.quotes;
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  return rankStocks(quotes.slice(0, count).map((q, i) => mapQuoteToStock(q, i)));
}

export async function getMostActives(count = 10) {
  const payload = await fetchScreener("most_actives", count);
  const quotes = payload?.finance?.result?.[0]?.quotes;
  if (!Array.isArray(quotes) || quotes.length === 0) return [];
  return rankStocks(quotes.slice(0, count).map((q, i) => mapQuoteToStock(q, i)));
}