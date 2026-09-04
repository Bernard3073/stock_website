"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

const THEME_STORAGE_KEY = "market-current-theme";

function readActiveTheme() {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function applyTheme(next) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // localStorage may be disabled — the data-theme attribute still works.
  }
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

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

export function TopBar({ watchlistStocks, onStockSelect }) {
  const { data: session, status } = useSession();
  const [openMenu, setOpenMenu] = useState(null);
  const [theme, setTheme] = useState("light");
  const containerRef = useRef(null);

  useEffect(() => {
    setTheme(readActiveTheme());
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

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

  // Gainers and Most Active live on the board as tabs; the top bar only keeps
  // the watchlist, which is worth reaching while scrolled away from its column.
  const sections = [
    {
      key: "watchlist",
      label: "Watchlist",
      stocks: watchlistStocks || [],
      emptyMessage: "Track stocks from the board to fill your watchlist."
    }
  ];

  return (
    <header className="top-bar" ref={containerRef}>
      <div className="top-bar-inner">
        <a className="top-bar-brand" href="#top">
          <span className="top-bar-logo" aria-hidden="true">●</span>
          Market Current
        </a>

        <nav className="top-bar-nav" aria-label="Saved stocks">
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

        <button
          type="button"
          className="top-bar-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        {status === "authenticated" && session?.user ? (
          <div className="top-bar-user">
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="top-bar-avatar"
              />
            ) : (
              <span className="top-bar-avatar top-bar-avatar-initial" aria-hidden="true">
                {(session.user.name || session.user.email || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <span className="top-bar-user-label" title={session.user.email}>
              {session.user.name || session.user.email}
            </span>
            <button
              type="button"
              className="top-bar-signout-btn"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Sign out
            </button>
          </div>
        ) : status === "loading" ? (
          <span className="top-bar-signin-placeholder" aria-hidden="true">…</span>
        ) : (
          <Link href="/login" className="top-bar-signin-btn">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
