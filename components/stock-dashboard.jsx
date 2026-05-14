"use client";

import { useEffect, useMemo, useState } from "react";

const WATCHLIST_STORAGE_KEY = "market-current-watchlist";

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

export default function StockDashboard({ initialData }) {
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

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);

      if (rawValue) {
        setWatchlist(JSON.parse(rawValue));
      }
    } catch {
      setWatchlist({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

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

  return (
    <main className="page-shell">
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
    </main>
  );
}