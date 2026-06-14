"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackAnalyticsEvent } from "../lib/analytics";
import { CandlestickChart } from "./trading-chart";
import { FinancialsSection } from "./financials-section";
import { TopBar } from "./top-bar";
import { AnalystInsights } from "./analyst-insights";
import { NEWS_BRIEFS, BRIEF_GENERATED_AT } from "../lib/news-brief";

const WATCHLIST_STORAGE_KEY = "market-current-watchlist";
const DEVICE_ID_KEY = "market-current-device-id";
const SYNC_DEBOUNCE_MS = 600;

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function watchlistObjectToArray(map) {
  return Object.entries(map).map(([symbol, entry]) => ({
    symbol,
    note: entry?.note || "",
    addedAt: entry?.addedAt || new Date().toISOString()
  }));
}

function watchlistArrayToObject(items) {
  const result = {};
  for (const item of items) {
    if (!item?.symbol) continue;
    result[item.symbol] = {
      note: item.note || "",
      addedAt: item.addedAt || new Date().toISOString()
    };
  }
  return result;
}

function formatMoney(value) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 3
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number") {
    return "--";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompact(value) {
  if (typeof value !== "number") {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function getChangeTone(change) {
  if (typeof change !== "number") {
    return "neutral";
  }

  if (change > 0) {
    return "up";
  }

  if (change < 0) {
    return "down";
  }

  return "neutral";
}


export default function StockDashboard({ initialData, topGainers = [], mostActives = [] }) {
  const [board, setBoard] = useState(initialData);
  const [watchlist, setWatchlist] = useState({});
  const [query, setQuery] = useState("");
  const [symbolInput, setSymbolInput] = useState("");
  const [symbolSuggestions, setSymbolSuggestions] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingSymbol, setIsAddingSymbol] = useState(false);
  const [isSearchingSymbols, setIsSearchingSymbols] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [watchlistMessage, setWatchlistMessage] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [recommendationData, setRecommendationData] = useState(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [chartRange, setChartRange] = useState("1mo");
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [isWatchlistHydrated, setIsWatchlistHydrated] = useState(false);
  const [watchlistSyncStatus, setWatchlistSyncStatus] = useState("");
  const syncTimerRef = useRef(null);
  const skipNextSyncRef = useRef(true);

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    let cancelled = false;
    let localCache = {};
    try {
      const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (raw) localCache = JSON.parse(raw) || {};
    } catch {
      localCache = {};
    }

    async function hydrate() {
      try {
        const response = await fetch("/api/watchlist", {
          headers: { "x-device-id": id },
          cache: "no-store"
        });
        if (!response.ok) throw new Error("server unavailable");
        const payload = await response.json();
        const serverItems = Array.isArray(payload.items) ? payload.items : [];

        if (cancelled) return;

        if (serverItems.length > 0) {
          skipNextSyncRef.current = true;
          setWatchlist(watchlistArrayToObject(serverItems));
        } else if (Object.keys(localCache).length > 0) {
          setWatchlist(localCache);
          await fetch("/api/watchlist", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-device-id": id },
            body: JSON.stringify({ entries: watchlistObjectToArray(localCache) })
          }).catch(() => {});
        } else {
          skipNextSyncRef.current = true;
          setWatchlist({});
        }
      } catch {
        if (cancelled) return;
        skipNextSyncRef.current = true;
        setWatchlist(localCache);
      } finally {
        if (!cancelled) setIsWatchlistHydrated(true);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isWatchlistHydrated) return;
    try {
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {
      // localStorage may be full or disabled
    }
  }, [watchlist, isWatchlistHydrated]);

  useEffect(() => {
    if (!isWatchlistHydrated || !deviceId) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);

    syncTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/watchlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-device-id": deviceId },
          body: JSON.stringify({ entries: watchlistObjectToArray(watchlist) })
        });
        if (!response.ok) throw new Error("sync failed");
        setWatchlistSyncStatus("Saved to your account");
      } catch {
        setWatchlistSyncStatus("Offline — changes saved locally");
      }
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [watchlist, isWatchlistHydrated, deviceId]);

  useEffect(() => {
    const normalizedSymbol = symbolInput.trim();

    if (normalizedSymbol.length < 1) {
      setSymbolSuggestions([]);
      setIsSearchingSymbols(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingSymbols(true);

      try {
        const response = await fetch(
          `/api/search?query=${encodeURIComponent(normalizedSymbol)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.message || "Unable to search for stocks.");
        }

        setSymbolSuggestions(payload.matches || []);
      } catch {
        setSymbolSuggestions([]);
      } finally {
        setIsSearchingSymbols(false);
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [symbolInput]);

  const visibleStocks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return board.stocks;
    }

    return board.stocks.filter((stock) => {
      return (
        stock.symbol.toLowerCase().includes(normalizedQuery) ||
        stock.shortName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [board.stocks, query]);

  const groupedStocks = useMemo(() => {
    const groups = new Map();
    for (const stock of visibleStocks) {
      const key = stock.industry || stock.sector || "Uncategorized";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(stock);
    }
    return Array.from(groups.entries())
      .sort((a, b) => {
        if (a[0] === "Uncategorized") return 1;
        if (b[0] === "Uncategorized") return -1;
        return b[1].length - a[1].length;
      })
      .map(([name, stocks]) => ({ name, stocks }));
  }, [visibleStocks]);

  const watchlistItems = useMemo(() => {
    return Object.entries(watchlist)
      .map(([symbol, entry]) => {
        const marketEntry = board.stocks.find((stock) => stock.symbol === symbol);

        return {
          symbol,
          note: entry.note,
          addedAt: entry.addedAt,
          stock: marketEntry
        };
      })
      .sort((left, right) => right.addedAt.localeCompare(left.addedAt));
  }, [board.stocks, watchlist]);

  const watchlistStocks = useMemo(() => {
    return watchlistItems.map((item) => ({
      symbol: item.symbol,
      shortName: item.stock?.shortName || item.symbol,
      regularMarketPrice: item.stock?.regularMarketPrice,
      marketChangePercent: item.stock?.marketChangePercent,
      regularMarketVolume: item.stock?.regularMarketVolume,
      regularMarketDayLow: item.stock?.regularMarketDayLow,
      regularMarketDayHigh: item.stock?.regularMarketDayHigh
    }));
  }, [watchlistItems]);

  const hotNews = useMemo(() => board.news || [], [board.news]);

  const sidebarTrending = useMemo(() => board.stocks.slice(0, 5), [board.stocks]);
  const sidebarGainers = useMemo(() => (topGainers || []).slice(0, 5), [topGainers]);

  const tickerStocks = useMemo(() => {
    const seen = new Set();
    const combined = [];
    for (const stock of [...board.stocks, ...(topGainers || []), ...(mostActives || [])]) {
      if (!stock || !stock.symbol || seen.has(stock.symbol)) continue;
      if (typeof stock.regularMarketPrice !== "number") continue;
      seen.add(stock.symbol);
      combined.push(stock);
    }
    return combined;
  }, [board.stocks, topGainers, mostActives]);

  async function refreshBoard() {
    setIsRefreshing(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/trending", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("The live market feed did not respond.");
      }

      const payload = await response.json();
      setBoard(payload);
      setStatusMessage("Board refreshed with the latest market snapshot.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to refresh the market board."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function toggleWatchlist(symbol) {
    setWatchlist((current) => {
      if (current[symbol]) {
        const next = { ...current };
        delete next[symbol];
        return next;
      }

      return {
        ...current,
        [symbol]: {
          note: "",
          addedAt: new Date().toISOString()
        }
      };
    });
  }

  async function addSymbolToWatchlist(event) {
    event.preventDefault();

    const normalizedSymbol = symbolInput.trim().toUpperCase();

    if (!normalizedSymbol) {
      setWatchlistMessage("Enter a stock symbol to add.");
      return;
    }

    if (watchlist[normalizedSymbol]) {
      setWatchlistMessage(`${normalizedSymbol} is already in your watchlist.`);
      setSymbolInput("");
      return;
    }

    setIsAddingSymbol(true);
    setWatchlistMessage("");

    try {
      const response = await fetch(`/api/quote?symbol=${encodeURIComponent(normalizedSymbol)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to find that stock symbol.");
      }

      setBoard((current) => {
        const existing = current.stocks.find((stock) => stock.symbol === payload.symbol);

        return {
          ...current,
          stocks: existing
            ? current.stocks
            : [
                ...current.stocks,
                {
                  ...payload,
                  rank: current.stocks.length + 1
                }
              ]
        };
      });

      setWatchlist((current) => ({
        ...current,
        [payload.symbol]: {
          note: current[payload.symbol]?.note || "",
          addedAt: new Date().toISOString()
        }
      }));
      setWatchlistMessage(`${payload.symbol} added to your watchlist.`);
      setSymbolInput("");
      setSymbolSuggestions([]);
    } catch (error) {
      setWatchlistMessage(
        error instanceof Error ? error.message : "Unable to add that stock right now."
      );
    } finally {
      setIsAddingSymbol(false);
    }
  }

  function updateNote(symbol, note) {
    setWatchlist((current) => ({
      ...current,
      [symbol]: {
        ...current[symbol],
        note
      }
    }));
  }

  function selectSuggestion(suggestion) {
    setSymbolInput(suggestion.symbol);
    setSymbolSuggestions([]);
    setWatchlistMessage("");
  }

  async function handleRangeChange(range) {
    if (!selectedStock || range === chartRange || isLoadingChart) return;
    setChartRange(range);
    setIsLoadingChart(true);
    try {
      const response = await fetch(
        `/api/analytics?symbol=${encodeURIComponent(selectedStock.symbol)}&range=${range}&skipFundamentals=true&skipNews=true`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Unable to fetch chart data");
      const data = await response.json();
      setRecommendationData(prev => ({
        ...prev,
        history: data.history,
        chartRange: data.chartRange
      }));
    } catch {
      // keep existing chart data on error
    } finally {
      setIsLoadingChart(false);
    }
  }

  async function loadStockRecommendation(stock) {
    setSelectedStock(stock);
    setChartRange("1mo");
    setIsLoadingRecommendation(true);
    setRecommendationError("");
    setRecommendationData(null);

    // Track the click event
    trackAnalyticsEvent("stock_clicked", {
      symbol: stock.symbol,
      name: stock.shortName,
      price: stock.regularMarketPrice,
      change: stock.marketChangePercent
    });

    try {
      const response = await fetch(`/api/analytics?symbol=${encodeURIComponent(stock.symbol)}`);
      
      if (!response.ok) {
        throw new Error("Unable to fetch recommendation");
      }

      const data = await response.json();
      setRecommendationData({
        ...data.analysis,
        history: data.history,
        chartRange: data.chartRange,
        fundamentals: data.fundamentals,
        news: data.news || []
      });
      
      // Track successful recommendation view
      trackAnalyticsEvent("recommendation_viewed", {
        symbol: stock.symbol,
        recommendation: data.analysis.recommendation,
        confidence: data.analysis.confidence
      });
    } catch (error) {
      setRecommendationError(
        error instanceof Error ? error.message : "Unable to load recommendation"
      );
      trackAnalyticsEvent("recommendation_error", {
        symbol: stock.symbol,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoadingRecommendation(false);
    }
  }

  function closeRecommendation() {
    setSelectedStock(null);
    setRecommendationData(null);
    setRecommendationError("");
  }

  return (
    <>
      <TopBar
        watchlistStocks={watchlistStocks}
        topGainers={topGainers}
        mostActives={mostActives}
        onStockSelect={loadStockRecommendation}
      />
      <main className="page-shell" id="top">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Daily market radar</p>
          <h1>Track the stocks everyone is watching before the opening bell fades.</h1>
          <p className="hero-text">
            The board blends live trending symbols with a personal watchlist saved on this device,
            so you can return every day and keep the names that matter in view.
          </p>
        </div>

        <div className="hero-actions">
          <div className="search-box">
            <label htmlFor="stock-search">Filter symbols</label>
            <input
              id="stock-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search AAPL, NVDA, Tesla..."
            />
          </div>

          <button className="refresh-button" onClick={refreshBoard} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh market board"}
          </button>

          <p className="status-copy">{statusMessage || `Source: ${board.source}`}</p>
        </div>
      </section>

      {tickerStocks.length > 0 && (
        <section className="stock-ticker" aria-label="Live stock ticker">
          <div className="stock-ticker-track">
            {[...tickerStocks, ...tickerStocks].map((stock, index) => (
              <button
                key={`${stock.symbol}-${index}`}
                type="button"
                className="ticker-item"
                onClick={() => loadStockRecommendation(stock)}
              >
                <span className="ticker-symbol">{stock.symbol}</span>
                <span className="ticker-price">{formatMoney(stock.regularMarketPrice)}</span>
                <span className={`ticker-change ${getChangeTone(stock.marketChangePercent)}`}>
                  {formatPercent(stock.marketChangePercent)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {hotNews.length > 0 && (
        <section className="hot-news" aria-label="Latest hot news">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Headlines now</p>
              <h2>Latest hot news</h2>
            </div>
            <p className="section-meta">
              {hotNews.length} {hotNews.length === 1 ? "story" : "stories"} across trending tickers
            </p>
          </div>
          {Array.isArray(NEWS_BRIEFS) && NEWS_BRIEFS.length > 0 && (
            <div className="hot-news-summary">
              <div className="hot-news-summary-head">
                <span className="hot-news-summary-badge">Daily Brief</span>
                <span className="hot-news-summary-source">
                  Updated {BRIEF_GENERATED_AT}
                </span>
              </div>
              <div className="hot-news-summary-sections">
                {NEWS_BRIEFS.map((brief) => (
                  <div className="hot-news-summary-section" key={brief.label}>
                    <span className="hot-news-summary-label">{brief.label}</span>
                    <p className="hot-news-summary-text">{brief.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hot-news-grid">
            {hotNews.map((item, idx) => {
              const matchingStock = board.stocks.find((s) => s.symbol === item.symbol);
              const stockForModal = matchingStock || {
                symbol: item.symbol,
                shortName: item.symbol
              };
              const tone = matchingStock
                ? getChangeTone(matchingStock.marketChangePercent)
                : "neutral";
              return (
                <article className="hot-news-card" key={`${item.symbol}-${item.link}-${idx}`}>
                  <div className="hot-news-card-top">
                    <button
                      type="button"
                      className={`hot-news-chip ${tone}`}
                      onClick={() => loadStockRecommendation(stockForModal)}
                      title={`Open analysis for ${item.symbol}`}
                    >
                      {item.symbol}
                      {matchingStock ? (
                        <span className="hot-news-chip-move">
                          {formatPercent(matchingStock.marketChangePercent)}
                        </span>
                      ) : null}
                    </button>
                    <span className="hot-news-source">
                      {item.source}
                      {item.publishedAt ? ` · ${item.publishedAt}` : ""}
                    </span>
                  </div>
                  <a
                    className="hot-news-title"
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.title}
                  </a>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="board-column">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today&apos;s board</p>
              <h2>Trending stocks</h2>
            </div>
            <p className="section-meta">
              Updated {new Date(board.fetchedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit"
              })}
            </p>
          </div>

          <div className="industry-groups">
            {groupedStocks.map((group) => (
              <section className="industry-group" key={group.name}>
                <div className="industry-group-header">
                  <h3>{group.name}</h3>
                  <span className="industry-group-count">
                    {group.stocks.length} {group.stocks.length === 1 ? "stock" : "stocks"}
                  </span>
                </div>
                <div className="stock-grid">
                  {group.stocks.map((stock) => {
                    const isTracked = Boolean(watchlist[stock.symbol]);
                    const tone = getChangeTone(stock.marketChangePercent);

                    function handleCardKeyDown(event) {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        loadStockRecommendation(stock);
                      }
                    }

                    return (
                      <article
                        className="stock-card"
                        key={stock.symbol}
                        onClick={() => loadStockRecommendation(stock)}
                        onKeyDown={handleCardKeyDown}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open analysis for ${stock.symbol} ${stock.shortName}`}
                      >
                        <div className="stock-card-top">
                          <div>
                            <div className="stock-symbol-row">
                              <span className="stock-rank">#{stock.rank}</span>
                              <h3>{stock.symbol}</h3>
                            </div>
                            <p className="stock-name">{stock.shortName}</p>
                          </div>

                          <button
                            className={`track-button ${isTracked ? "tracked" : ""}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleWatchlist(stock.symbol);
                            }}
                          >
                            {isTracked ? "Tracking" : "Track"}
                          </button>
                        </div>

                        <div className="price-row">
                          <strong>{formatMoney(stock.regularMarketPrice)}</strong>
                          <span className={`change-pill ${tone}`}>
                            {formatPercent(stock.marketChangePercent)}
                          </span>
                        </div>

                        <div className="metric-row">
                          <div>
                            <span>Volume</span>
                            <strong>{formatCompact(stock.regularMarketVolume)}</strong>
                          </div>
                          <div>
                            <span>Day range</span>
                            <strong>
                              {formatMoney(stock.regularMarketDayLow)} - {formatMoney(stock.regularMarketDayHigh)}
                            </strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="watchlist-column">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Personal tracking</p>
              <h2>Watchlist</h2>
            </div>
            {watchlistSyncStatus ? (
              <span className="watchlist-sync-status">{watchlistSyncStatus}</span>
            ) : null}
          </div>

          <form className="watchlist-form" onSubmit={addSymbolToWatchlist}>
            <label htmlFor="watchlist-symbol">Add a symbol</label>
            <div className="watchlist-form-row">
              <div className="watchlist-input-wrap">
                <input
                  id="watchlist-symbol"
                  value={symbolInput}
                  onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                  onBlur={() => window.setTimeout(() => setSymbolSuggestions([]), 120)}
                  placeholder="Add NVDA or type a company name"
                  maxLength={32}
                  autoComplete="off"
                />
                {(symbolSuggestions.length > 0 || isSearchingSymbols) && (
                  <div className="suggestions-list" role="listbox" aria-label="Stock suggestions">
                    {isSearchingSymbols && symbolSuggestions.length === 0 ? (
                      <div className="suggestion-item muted">Searching...</div>
                    ) : (
                      symbolSuggestions.map((suggestion) => (
                        <button
                          className="suggestion-item"
                          key={`${suggestion.symbol}-${suggestion.exchange}`}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectSuggestion(suggestion);
                          }}
                          type="button"
                        >
                          <span className="suggestion-symbol">{suggestion.symbol}</span>
                          <span className="suggestion-name">{suggestion.shortName}</span>
                          <span className="suggestion-meta">{suggestion.exchange}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button className="track-button tracked" type="submit" disabled={isAddingSymbol}>
                {isAddingSymbol ? "Adding..." : "Add"}
              </button>
            </div>
            <p className="watchlist-helper">
              Add any symbol directly, even if it is not on today&apos;s board.
            </p>
            {watchlistMessage ? <p className="status-copy">{watchlistMessage}</p> : null}
          </form>

          {watchlistItems.length === 0 ? (
            <div className="empty-watchlist">
              <p>Add a symbol manually or track one from the board to keep it here.</p>
              <p>Your notes stay saved in this browser for your next daily check-in.</p>
            </div>
          ) : (
            <div className="watchlist-stack">
              {watchlistItems.map((item) => (
                <article className="watchlist-card" key={item.symbol}>
                  <div className="watchlist-card-header">
                    <div>
                      <h3>{item.symbol}</h3>
                      <p>{item.stock?.shortName || "Saved from a previous session"}</p>
                    </div>
                    <button className="ghost-button" onClick={() => toggleWatchlist(item.symbol)}>
                      Remove
                    </button>
                  </div>

                  <div className="watchlist-price-row">
                    <strong>{formatMoney(item.stock?.regularMarketPrice)}</strong>
                    <span className={`change-pill ${getChangeTone(item.stock?.marketChangePercent)}`}>
                      {formatPercent(item.stock?.marketChangePercent)}
                    </span>
                  </div>

                  <label className="notes-label" htmlFor={`note-${item.symbol}`}>
                    Daily note
                  </label>
                  <textarea
                    id={`note-${item.symbol}`}
                    value={item.note}
                    onChange={(event) => updateNote(item.symbol, event.target.value)}
                    placeholder="Why is this one on your radar today?"
                  />
                </article>
              ))}
            </div>
          )}

        </aside>

        {(sidebarTrending.length > 0 || sidebarGainers.length > 0) && (
          <aside className="lists-column">
            {sidebarTrending.length > 0 && (
              <section className="sidebar-list-section">
                <div className="sidebar-list-header">
                  <h3>Trending</h3>
                  <span className="sidebar-list-meta">Top {sidebarTrending.length}</span>
                </div>
                <div className="sidebar-stock-list">
                  {sidebarTrending.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      className="sidebar-stock-row"
                      onClick={() => loadStockRecommendation(stock)}
                    >
                      <span className="sidebar-stock-symbol">{stock.symbol}</span>
                      <span className="sidebar-stock-name">{stock.shortName}</span>
                      <span className={`sidebar-stock-change ${getChangeTone(stock.marketChangePercent)}`}>
                        {formatPercent(stock.marketChangePercent)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {sidebarGainers.length > 0 && (
              <section className="sidebar-list-section">
                <div className="sidebar-list-header">
                  <h3>Top Gainers</h3>
                  <span className="sidebar-list-meta">Top {sidebarGainers.length}</span>
                </div>
                <div className="sidebar-stock-list">
                  {sidebarGainers.map((stock) => (
                    <button
                      key={stock.symbol}
                      type="button"
                      className="sidebar-stock-row"
                      onClick={() => loadStockRecommendation(stock)}
                    >
                      <span className="sidebar-stock-symbol">{stock.symbol}</span>
                      <span className="sidebar-stock-name">{stock.shortName}</span>
                      <span className={`sidebar-stock-change ${getChangeTone(stock.marketChangePercent)}`}>
                        {formatPercent(stock.marketChangePercent)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>
        )}
      </section>

      {selectedStock && (
        <div className="recommendation-modal-overlay" onClick={closeRecommendation}>
          <div className="recommendation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recommendation-header">
              <div>
                <h2>{selectedStock.symbol}</h2>
                <p>{selectedStock.shortName}</p>
              </div>
              <button className="close-button" onClick={closeRecommendation}>✕</button>
            </div>

            {isLoadingRecommendation ? (
              <div className="recommendation-loading">
                <p>Analyzing stock data...</p>
              </div>
            ) : recommendationError ? (
              <div className="recommendation-error">
                <p>⚠️ {recommendationError}</p>
              </div>
            ) : recommendationData ? (
              <div className="recommendation-content">
                <CandlestickChart
                  history={recommendationData.history || []}
                  currentRange={chartRange}
                  onRangeChange={handleRangeChange}
                  isLoading={isLoadingChart}
                />

                <div className="recommendation-reasoning">
                  <h3>Analysis</h3>
                  <p>{recommendationData.reasoning}</p>
                </div>

                {recommendationData.signals.length > 0 && (
                  <div className="recommendation-signals">
                    <h3>Key Signals</h3>
                    <ul>
                      {recommendationData.signals.map((signal, idx) => (
                        <li key={idx}>• {signal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="recommendation-metrics">
                  <h3>Stock Metrics</h3>
                  <div className="metrics-grid">
                    <div className="metric">
                      <span>Current Price</span>
                      <strong>{formatMoney(recommendationData.indicators.price)}</strong>
                    </div>
                    <div className="metric">
                      <span>Day Change</span>
                      <strong className={getChangeTone(recommendationData.indicators.dayChange) === "up" ? "up" : "down"}>
                        {formatPercent(recommendationData.indicators.dayChange)}
                      </strong>
                    </div>
                    <div className="metric">
                      <span>Volume</span>
                      <strong>{formatCompact(recommendationData.indicators.volume)}</strong>
                    </div>
                    {recommendationData.indicators.pe && (
                      <div className="metric">
                        <span>P/E Ratio</span>
                        <strong>{recommendationData.indicators.pe.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <AnalystInsights analyst={recommendationData.fundamentals?.analystInsights} />

                <FinancialsSection fundamentals={recommendationData.fundamentals} />

                <div className="recommendation-disclaimer">
                  <p>💡 This is an automated analysis for educational purposes only. Always do your own research before making investment decisions.</p>
                </div>

                {recommendationData.news && recommendationData.news.length > 0 && (
                  <div className="modal-news-section">
                    <div className="modal-news-header">
                      <h3>Latest News</h3>
                      <span className="modal-news-count">
                        {recommendationData.news.length} {recommendationData.news.length === 1 ? "headline" : "headlines"}
                      </span>
                    </div>
                    <div className="modal-news-list">
                      {recommendationData.news.map((item, idx) => (
                        <a
                          key={`${item.link || idx}-${idx}`}
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="modal-news-item"
                        >
                          <span className="modal-news-title">{item.title}</span>
                          <span className="modal-news-meta">
                            {item.source}
                            {item.publishedAt ? ` · ${item.publishedAt}` : ""}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
      </main>
    </>
  );
}