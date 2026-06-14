#!/usr/bin/env node
// Refreshes lib/news-brief.js from live Yahoo Finance + Google News data.
// Pure Node 20 (built-in fetch). No dependencies. No API keys.
//
// Triggered by .github/workflows/refresh-brief.yml on cron, also runnable
// locally via: node scripts/refresh-news-brief.mjs

import { writeFileSync } from "node:fs";

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function getTrendingSymbols() {
  const payload = await fetchJson(
    "https://query1.finance.yahoo.com/v1/finance/trending/US"
  );
  return (payload.finance?.result?.[0]?.quotes || [])
    .map((q) => q.symbol)
    .filter(Boolean)
    .slice(0, 12);
}

async function fetchStockData(symbol) {
  try {
    const payload = await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=1d&range=1d`
    );
    const meta = payload.chart?.result?.[0]?.meta || {};
    const price = toNumber(meta.regularMarketPrice);
    const prevClose = toNumber(meta.chartPreviousClose);
    const change =
      price != null && prevClose != null && prevClose !== 0
        ? ((price - prevClose) / prevClose) * 100
        : null;
    return {
      symbol,
      shortName: meta.shortName || meta.longName || symbol,
      price,
      change,
      volume: toNumber(meta.regularMarketVolume)
    };
  } catch {
    return null;
  }
}

function stripHtml(value) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchNewsForSymbol(symbol) {
  try {
    const rss = await fetchText(
      `https://news.google.com/rss/search?q=${encodeURIComponent(
        symbol
      )}+stock&hl=en-US&gl=US&ceid=US:en`
    );
    const match = rss.match(/<item>([\s\S]*?)<\/item>/);
    if (!match) return null;
    const titleMatch = match[1].match(/<title>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : null;
    return title ? { symbol, title } : null;
  } catch {
    return null;
  }
}

function decideLabel(date) {
  const utcDay = date.getUTCDay(); // 0=Sun, 6=Sat
  if (utcDay === 0 || utcDay === 6) return "Today";
  // US markets close at 4pm ET = 20:00 UTC (EST) / 21:00 UTC (EDT).
  // Anything before 18:00 UTC is comfortably pre-market; anything 20:00 UTC
  // or later is comfortably after-close. We round to "before/after 18:00".
  return date.getUTCHours() < 18 ? "Pre-Market" : "After Close";
}

function shortenName(name) {
  return name.split(/[,]/)[0].trim();
}

function trimHeadline(title) {
  // Headlines often end with " - Source" — keep just the lead clause
  return title.split(/\s[-–—]\s/)[0].trim();
}

function generateBriefText(stocks, news, label) {
  const valid = stocks.filter((s) => s && typeof s.change === "number");
  const gainers = [...valid].sort((a, b) => b.change - a.change).slice(0, 3);
  const losers = [...valid].sort((a, b) => a.change - b.change).slice(0, 2);

  const sentences = [];

  if (gainers.length > 0 && gainers[0].change > 0) {
    const lead = gainers[0];
    let s = `${shortenName(lead.shortName)} (${lead.symbol}) leads the trending board with a +${lead.change.toFixed(1)}% move`;
    const others = gainers.slice(1).filter((g) => g.change > 0);
    if (others.length > 0) {
      const parts = others.map(
        (g) => `${g.symbol} +${g.change.toFixed(1)}%`
      );
      s += `, joined by ${parts.join(" and ")}`;
    }
    sentences.push(s + ".");
  }

  if (losers.length > 0 && losers[0].change < 0) {
    const downs = losers.filter((l) => l.change < 0);
    const parts = downs.map((l) => `${l.symbol} ${l.change.toFixed(1)}%`);
    sentences.push(`On the downside, ${parts.join(" and ")}.`);
  }

  if (news.length > 0) {
    const top = news[0];
    sentences.push(
      `On the news front, ${top.symbol} headlines highlight: "${trimHeadline(top.title)}".`
    );
  }

  if (sentences.length === 0) {
    return label === "Today"
      ? "Markets are quiet — no notable moves across the trending board."
      : "No notable moves yet across the trending board.";
  }

  const preamble =
    label === "Pre-Market"
      ? "Pre-market view of trending names: "
      : label === "After Close"
      ? "Wrapping today's session: "
      : "Weekend / overnight activity across trending names: ";

  return preamble + sentences.join(" ");
}

async function main() {
  console.log("Fetching trending symbols…");
  const symbols = await getTrendingSymbols();
  console.log(`  ${symbols.length} symbols: ${symbols.join(", ")}`);

  console.log("Fetching stock data…");
  const stocks = (await Promise.all(symbols.map(fetchStockData))).filter(Boolean);
  console.log(`  ${stocks.length} stocks resolved`);

  console.log("Fetching headlines…");
  const newsSymbols = stocks.slice(0, 4).map((s) => s.symbol);
  const news = (await Promise.all(newsSymbols.map(fetchNewsForSymbol))).filter(Boolean);
  console.log(`  ${news.length} headlines`);

  const now = new Date();
  const label = decideLabel(now);
  const text = generateBriefText(stocks, news, label);
  const dateStr = now.toISOString().slice(0, 10);

  const briefs = [{ label, text }];

  const content = `// Static daily news brief — auto-generated by scripts/refresh-news-brief.mjs
// scheduled via .github/workflows/refresh-brief.yml.
//
// To refresh manually:   node scripts/refresh-news-brief.mjs
// To hide the panel:     export NEWS_BRIEFS = [] and commit.

export const NEWS_BRIEFS = ${JSON.stringify(briefs, null, 2)};

export const BRIEF_GENERATED_AT = ${JSON.stringify(dateStr)};
`;

  writeFileSync("lib/news-brief.js", content);
  console.log(`\n[${label}] ${text}`);
  console.log(`\nWrote lib/news-brief.js (BRIEF_GENERATED_AT=${dateStr}).`);
}

main().catch((err) => {
  console.error("Brief refresh failed:", err.message || err);
  process.exit(1);
});
