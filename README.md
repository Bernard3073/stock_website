# Market Current

A small Next.js site for checking trending stocks each day, keeping a local watchlist
with notes, and drilling into a stock for a full TradingView-style chart, technical
recommendation, and a fundamentals view (income statement + earnings).

## Requirements

- Node.js **>= 20.9.0** (Next 16 will refuse to start on Node 18)
- npm 10+ (ships with Node 20)

If you're stuck on an older Node, install [nvm](https://github.com/nvm-sh/nvm) and run:

```bash
nvm install 20
nvm use 20
```

## Run locally

```bash
npm install
npm run dev
```

The dev server boots at <http://localhost:3000>. A production build can be produced with
`npm run build` and served with `npm start`.

## What it includes

### Daily market board
- Server-side Yahoo Finance fetch of trending US tickers via `getServerSideProps`.
- Curated fallback list when the live feed is unreachable.
- Per-symbol headlines pulled from Google News RSS for the top trending stocks.
- Browser-saved watchlist with notes, persisted in `localStorage` across visits.
- Type-ahead symbol search backed by Yahoo Finance's search endpoint.

### Stock analysis modal
Clicking **View Analysis & Recommendation** on any stock opens a detailed panel containing:

- **TradingView-style chart** ([components/trading-chart.jsx](components/trading-chart.jsx))
  - OHLC candlesticks (green = bullish close, red = bearish close)
  - 20-period Simple Moving Average overlay
  - Volume histogram aligned with each candle, colored by direction
  - 14-period RSI panel with 70 / 50 / 30 reference lines
  - Crosshair + OHLC tooltip on hover
  - **1W / 1M / 3M** range tabs that refetch only the chart payload
- **Buy / Sell / Hold recommendation** with a confidence score and the underlying signals
  ([lib/analytics.js](lib/analytics.js)).
- **Income Statement & Earnings** ([components/financials-section.jsx](components/financials-section.jsx))
  - Annual revenue & net income bar chart (4 fiscal years)
  - Quarterly EPS table — estimate vs. actual with color-coded surprise %
  - Annual income statement: Total Revenue, Gross Profit, Operating Income, Net Income

### Lightweight analytics
- Click and recommendation events are logged to `localStorage` under `analytics_events`
  via [lib/analytics.js](lib/analytics.js) — useful as a hook point if you later wire up a
  real analytics service.

## Project layout

```
components/
  stock-dashboard.jsx       Main board + watchlist + analysis modal
  trading-chart.jsx         Candlestick + SMA + Volume + RSI SVG chart
  financials-section.jsx    Revenue/earnings chart, EPS table, income statement table
lib/
  stocks.js                 Yahoo Finance data layer (quotes, history, fundamentals)
  analytics.js              Recommendation scoring + client-side event logger
pages/
  index.js                  Home page (SSR'd trending board)
  _app.js                   App shell
  api/
    trending.js             /api/trending — refresh the board
    quote.js                /api/quote — single-symbol quote
    search.js               /api/search — symbol type-ahead
    analytics.js            /api/analytics — chart history + recommendation + fundamentals
styles/
  globals.css               All styles (no CSS framework)
```

## Data sources

All data comes directly from Yahoo Finance's public endpoints; no API key is required.

- **Trending list:** `query1.finance.yahoo.com/v1/finance/trending/US`
- **Chart / OHLC history:** `query1.finance.yahoo.com/v8/finance/chart/<symbol>`
- **Symbol search:** `query1.finance.yahoo.com/v1/finance/search`
- **Fundamentals (income statement + earnings):**
  `query1.finance.yahoo.com/v10/finance/quoteSummary/<symbol>` — requires a crumb/cookie
  pair which is fetched and cached for an hour. If the auth fails for any reason the
  modal gracefully shows "data unavailable" for the financials section while the rest of
  the analysis continues to work.
- **Headlines:** Google News RSS, queried per ticker.

## Notes

- Built on **Next.js 16** (Pages Router) with **React 19**.
- No external chart library — all charts are hand-rolled SVG so the bundle stays small.
- The analytics endpoint accepts `?range=1w|1m|3m` and `?skipFundamentals=true` (the
  range tabs use the latter to avoid re-fetching financials on every range switch).
