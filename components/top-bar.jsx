"use client";

import { useEffect, useRef, useState } from "react";

function formatMoney(value) {
  if (typeof value !== "number") return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 3
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number") return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getChangeTone(change) {
  if (typeof change !== "number") return "neutral";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "neutral";
}

function StockDropdownRow({ stock, onSelect }) {
  const tone = getChangeTone(stock.marketChangePercent);
  return (
    <button
      type="button"
      className="top-bar-stock-row"
      onClick={() => onSelect(stock)}
    >
      <span className="top-bar-stock-symbol">{stock.symbol}</span>
      <span className="top-bar-stock-name">{stock.shortName}</span>
      <span className="top-bar-stock-price">{formatMoney(stock.regularMarketPrice)}</span>
      <span className={`top-bar-stock-change ${tone}`}>
        {formatPercent(stock.marketChangePercent)}
      </span>
    </button>
  );
}

export function TopBar({ watchlistStocks, topGainers, mostActives, onStockSelect }) {
  const [openMenu, setOpenMenu] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!openMenu) return undefined;

    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }
    function handleEsc(event) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [openMenu]);

  function toggleMenu(name) {
    setOpenMenu((current) => (current === name ? null : name));
  }

  function selectStock(stock) {
    setOpenMenu(null);
    onStockSelect?.(stock);
  }

  const sections = [
    {
      key: "watchlist",
      label: "Watchlist",
      stocks: watchlistStocks || [],
      emptyMessage: "Track stocks from the board to fill your watchlist."
    },
    {
      key: "gainers",
      label: "Top Gainers",
      stocks: topGainers || [],
      emptyMessage: "No gainers available right now."
    },
    {
      key: "actives",
      label: "Most Active",
      stocks: mostActives || [],
      emptyMessage: "No active stocks available right now."
    }
  ];

  return (
    <header className="top-bar" ref={containerRef}>
      <div className="top-bar-inner">
        <a className="top-bar-brand" href="#top">
          <span className="top-bar-logo" aria-hidden="true">●</span>
          Market Current
        </a>

        <nav className="top-bar-nav" aria-label="Stock categories">
          {sections.map((section) => {
            const isOpen = openMenu === section.key;
            return (
              <div key={section.key} className="top-bar-menu">
                <button
                  type="button"
                  className={`top-bar-nav-button${isOpen ? " active" : ""}`}
                  onClick={() => toggleMenu(section.key)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                >
                  <span>{section.label}</span>
                  <span className="top-bar-count">{section.stocks.length}</span>
                  <svg
                    className={`top-bar-chevron${isOpen ? " flipped" : ""}`}
                    width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"
                  >
                    <path d="M2 4 L5 7 L8 4"
                      stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>

                {isOpen && (
                  <div className="top-bar-dropdown" role="menu">
                    {section.stocks.length === 0 ? (
                      <div className="top-bar-empty">{section.emptyMessage}</div>
                    ) : (
                      section.stocks.map((stock) => (
                        <StockDropdownRow
                          key={stock.symbol}
                          stock={stock}
                          onSelect={selectStock}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
