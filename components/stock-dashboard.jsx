"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackAnalyticsEvent } from "../lib/analytics";
import { CandlestickChart } from "./trading-chart";
import { FinancialsSection } from "./financials-section";
import { TopBar } from "./top-bar";
import { AnalystInsights } from "./analyst-insights";

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
  const [chartRange, setChartRange] = useState("1m");
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

  const boardNews = useMemo(() => board.news || [], [board.news]);

  const marketSummary = useMemo(() => {
    const pricedStocks = board.stocks.filter(
      (stock) => typeof stock.regularMarketPrice === "number"
    );
    const gainers = board.stocks.filter(
      (stock) => typeof stock.marketChangePercent === "number" && stock.marketChangePercent > 0
    );

    const averageMove = gainers.length
      ? gainers.reduce((sum, stock) => sum + stock.marketChangePercent, 0) / gainers.length
      : 0;

    return {
      trackedCount: board.stocks.length,
      gainers: gainers.length,
      averageMove,
      averagePrice: pricedStocks.length
        ? pricedStocks.reduce((sum, stock) => sum + stock.regularMarketPrice, 0) / pricedStocks.length
        : 0
    };
  }, [board.stocks]);

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
        `/api/analytics?symbol=${encodeURIComponent(selectedStock.symbol)}&range=${range}&skipFundamentals=true`,
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
    setChartRange("1m");
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
        fundamentals: data.fundamentals
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

      <section className="summary-grid">
        <article className="summary-card accent-orange">
          <span>Tracked symbols</span>
          <strong>{marketSummary.trackedCount}</strong>
          <p>Fresh symbols pulled into today&apos;s board.</p>
        </article>
        <article className="summary-card accent-cream">
          <span>Positive movers</span>
          <strong>{marketSummary.gainers}</strong>
          <p>Names printing green inside the current list.</p>
        </article>
        <article className="summary-card accent-teal">
          <span>Average gain</span>
          <strong>{formatPercent(marketSummary.averageMove)}</strong>
          <p>Average move for the symbols showing upside.</p>
        </article>
        <article className="summary-card accent-ink">
          <span>Average price</span>
          <strong>{formatMoney(marketSummary.averagePrice)}</strong>
          <p>Price anchor across the active board.</p>
        </article>
      </section>

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

          <div className="stock-grid">
            {visibleStocks.map((stock) => {
              const isTracked = Boolean(watchlist[stock.symbol]);
              const tone = getChangeTone(stock.marketChangePercent);

              return (
                <article className="stock-card" key={stock.symbol}>
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
                      onClick={() => toggleWatchlist(stock.symbol)}
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

                  <button
                    className="view-analysis-button"
                    onClick={() => loadStockRecommendation(stock)}
                  >
                    View Analysis & Recommendation →
                  </button>
                </article>
              );
            })}
          </div>

          <section className="news-panel">
            <div className="section-heading compact news-heading">
              <div>
                <p className="eyebrow">Market headlines</p>
                <h2>Daily news for trending stocks</h2>
              </div>
            </div>

            <div className="news-stack">
              {boardNews.map((item) => (
                <article className="news-card" key={`${item.symbol}-${item.link}`}>
                  <div className="news-symbol">{item.symbol}</div>
                  <div>
                    <a className="news-link" href={item.link} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                    <p className="news-meta">
                      {item.source} · {item.publishedAt}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
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

                <div className="recommendation-score">
                  <div className={`recommendation-badge ${recommendationData.recommendation.toLowerCase()}`}>
                    {recommendationData.recommendation}
                  </div>
                  <div className="score-details">
                    <span className="score-label">Confidence</span>
                    <span className={`score-value ${recommendationData.confidence}`}>
                      {recommendationData.confidence.toUpperCase()}
                    </span>
                  </div>
                  <div className="score-bar">
                    <div className="score-bar-fill" style={{ width: `${recommendationData.score}%` }}></div>
                    <span className="score-number">{recommendationData.score}</span>
                  </div>
                </div>

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
              </div>
            ) : null}
          </div>
        </div>
      )}
      </main>
    </>
  );
}