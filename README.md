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

## Environment variables

Email/password sign-up works with **zero env vars** out of the box. To enable Google
sign-in and to satisfy NextAuth.js's session signing, add the following to
`.env.local` in the project root:

| Variable                 | Purpose                                                                                            | Required?                |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------ |
| `NEXTAUTH_SECRET`        | Secret used to sign session JWTs. Generate with `openssl rand -base64 32`.                          | **Required** (any deploy)|
| `NEXTAUTH_URL`           | Public URL of the site, e.g. `http://localhost:3000` in dev.                                       | **Required** in production |
| `GOOGLE_CLIENT_ID`       | OAuth client id from Google Cloud Console. Without it the "Continue with Google" button is hidden. | Optional                 |
| `GOOGLE_CLIENT_SECRET`   | OAuth client secret matching the above.                                                            | Optional                 |
| `WATCHLIST_DB_PATH`      | Override the default SQLite path (`data/market-current.db`).                                       | Optional                 |

A starter `.env.local`:

```ini
NEXTAUTH_SECRET=replace-with-output-of-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
# Optional — enables the Google sign-in button
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

`.env.local` is gitignored. Next.js auto-loads it on every `npm run dev` /
`npm run build` / `npm start`.

### Setting up Google OAuth (optional but nice)

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. **Authorized JavaScript origins:** `http://localhost:3000` (and your production URL).
4. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google` (and the production equivalent).
5. Copy the client id + secret into `.env.local` as shown above.
6. Restart `npm run dev` — the Google button on `/login` will light up.

## Run locally

### First-time setup

```bash
nvm use 20          # only needed once per new terminal session
npm install         # installs dependencies (also after package.json changes)
npm run dev         # starts the dev server at http://localhost:3000
```

Leave `npm run dev` running while you work — Next.js hot-reloads on every save, so
**you do not need to re-run anything** when you edit code. Just refresh the browser.

If you want `nvm` to default to Node 20 in every new shell so you can skip the
`nvm use 20` step, run `nvm alias default 20` once.

### Workflow cheat sheet

| You changed...                  | You need to run...                         |
| ------------------------------- | ------------------------------------------ |
| A `.jsx` / `.js` / `.css` file  | Nothing — hot reload handles it            |
| `package.json` (new dependency) | `npm install`                              |
| `next.config.js`                | Restart `npm run dev`                      |
| Nothing, but it's broken/cached | `rm -rf .next` and restart `npm run dev`   |
| Want a production bundle        | `npm run build` then `npm start`           |

### Production build

```bash
nvm use 20
npm run build       # type-checks and bundles for production
npm start           # serves the production build at :3000
```

Always run `npm run build` before deploying — it surfaces build-time errors that
the dev server can quietly ignore.

### When things look broken

If you hit weird cache errors (especially after switching branches, native modules
recompiling, or interrupted installs), reset the local state:

```bash
rm -rf .next node_modules package-lock.json
npm install
npm run dev
```

### Do not run `npm audit fix --force`

`--force` allows npm to downgrade **major versions** to make audit warnings go
away — on this project it will silently roll Next.js back to a 6-year-old release
and break everything. The "vulnerability" warnings on a clean install come from
transitive dev-only dependencies of Next.js itself; they are not exploitable in
your code and are tracked upstream. Plain `npm audit fix` (no flag) is safe.

## Auto-refresh schedule (news brief)

A GitHub Action ([.github/workflows/refresh-brief.yml](.github/workflows/refresh-brief.yml))
runs three times a day and regenerates [lib/news-brief.js](lib/news-brief.js) from
live Yahoo Finance + Google News data. The script picks the section label based on
the current UTC time, commits the change, and pushes to `main`.

| Cron (UTC)              | Days        | Label produced  | Roughly       |
| ----------------------- | ----------- | --------------- | ------------- |
| `0 12 * * 1-5`          | Mon–Fri     | `"Pre-Market"`  | 7am EST / 8am EDT |
| `0 22 * * 1-5`          | Mon–Fri     | `"After Close"` | 5pm EST / 6pm EDT |
| `0 15 * * 0,6`          | Sat / Sun   | `"Today"`       | 10am EST / 11am EDT |

### Enabling the action on your repo

1. **Push the repo to GitHub.** The workflow is committed in `.github/workflows/`, so it
   activates automatically as soon as the repo exists on GitHub. You don't need to
   configure anything in the GitHub UI — `permissions: contents: write` is declared in
   the workflow itself and uses the auto-provisioned `GITHUB_TOKEN`.

2. **Confirm Actions are enabled.** Repo → Settings → Actions → General → "Allow all
   actions and reusable workflows". (On a brand-new repo this is on by default.)

3. **Confirm workflow write permissions.** Repo → Settings → Actions → General →
   "Workflow permissions" → must be set to **Read and write permissions** so the
   workflow can push the regenerated file. (On personal repos this is the default;
   on org repos you may need to flip it on.)

4. **Verify the first run.** From the GitHub Actions tab, pick *Refresh news brief*
   and click *Run workflow* → main. It should take ~10 seconds, push a commit, and the
   brief panel will reflect the latest data on the next deploy.

### Local / manual refresh

```bash
npm run refresh-brief        # regenerates lib/news-brief.js from live data
git add lib/news-brief.js && git commit -m "chore: refresh brief"
git push                     # triggers your normal deploy (Vercel etc.)
```

No API keys required — the script uses only public Yahoo Finance + Google News RSS
endpoints. Cost: $0.

> **GitHub cron isn't precise.** Scheduled workflows can fire 5–30 minutes late
> during peak hours, and may be skipped entirely if a repo sees no activity for 60
> days (GitHub disables cron-only workflows on dormant repos). Re-enable via the
> Actions UI if that happens.

## What it includes

### Top bar
A sticky top bar gives one-click access to three categories of stocks. Each is a
dropdown that lists symbols, current price, and day change; clicking any row opens
the full analysis modal for that stock.

- **Watchlist** — the user's saved symbols (synced live from the server-side DB)
- **Top Gainers** — top % movers today from Yahoo's `day_gainers` screener
- **Most Active** — highest-volume tickers today from Yahoo's `most_actives` screener

If the screener endpoint is unavailable, both lists transparently fall back to a
sort of the trending board (by % change for gainers, by volume for most actives) so
the dropdowns are never empty.

### Daily market board
- Server-side Yahoo Finance fetch of trending US tickers via `getServerSideProps`.
- Curated fallback list when the live feed is unreachable.
- Each stock card is fully clickable (and keyboard-focusable with Enter/Space) —
  clicking anywhere on a card opens the full analysis modal with the chart,
  recommendation, analyst insights, income statement, and the latest 6 news
  headlines. The Track button stays on the card and doesn't trigger the modal.
- Type-ahead symbol search backed by Yahoo Finance's search endpoint.

### Right sidebar
- **Watchlist** with notes — synced live to the SQLite database (see Watchlist persistence below).
- **Trending** preview — the top 5 trending tickers from the board, click to open the analysis modal.
- **Top Gainers** preview — top 5 movers from the Yahoo `day_gainers` screener.

### Latest Hot News
- **Daily Brief** — static summary panel served from [lib/news-brief.js](lib/news-brief.js).
  No API key, no per-page-load cost. The file exports `NEWS_BRIEFS` (array of
  `{label, text}`) and is **auto-refreshed by a GitHub Action** three times a day
  ([.github/workflows/refresh-brief.yml](.github/workflows/refresh-brief.yml) — see
  *"Auto-refresh schedule"* below). To refresh manually, run
  `npm run refresh-brief` and commit the result.

  Labels:
  - **Trading day** (Mon–Fri): `"Pre-Market"` (before 18:00 UTC) or `"After Close"`
    (18:00 UTC and later) — the workflow chooses based on current UTC time.
  - **Non-trading day** (weekend, market holiday): one `"Today"` entry covering
    overnight/weekend activity (mostly crypto + futures).
  - Set `NEWS_BRIEFS = []` and commit to hide the panel.
- **Headline grid** — up to 12 fresh Google News headlines across the top trending
  tickers, interleaved (alternating symbols) for visual variety. Each card shows the
  stock chip (clickable → opens analysis modal) and the headline (external link).

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
- **Latest News** (at the bottom of the modal) — up to 6 fresh headlines for the
  selected symbol pulled from Google News RSS at modal-open time. Range tab switches
  don't refetch the headlines (the chart is re-fetched with `skipNews=true`).
- **Analyst Insights** ([components/analyst-insights.jsx](components/analyst-insights.jsx))
  - Recommendation badge: Strong Buy / Buy / Hold / Underperform / Sell
  - 1.0–5.0 average rating gauge with the mean position marked on a colored scale
  - Price-target bar — low / current / mean target / high, with % upside to the mean
  - Distribution chart showing how many analysts are in each rating bucket this month
- **Income Statement & Earnings** ([components/financials-section.jsx](components/financials-section.jsx))
  - Annual revenue & net income bar chart (4 fiscal years)
  - Quarterly EPS table — estimate vs. actual with color-coded surprise %
  - Annual income statement: Total Revenue, Gross Profit, Operating Income, Net Income

### Lightweight analytics
- Click and recommendation events are logged to `localStorage` under `analytics_events`
  via [lib/analytics.js](lib/analytics.js) — useful as a hook point if you later wire up a
  real analytics service.

### Watchlist persistence
The watchlist is now backed by a server-side SQLite database so symbols and notes survive
clearing browser storage, switching browsers on the same device that gets the same device id,
or any other case where `localStorage` is wiped.

- **Storage:** [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) backed by a
  single file at `data/market-current.db` (path overridable via `WATCHLIST_DB_PATH`).
- **Identity:** Each browser generates an anonymous UUID on first load and stores it under
  `market-current-device-id` in `localStorage`. The id is sent on every watchlist request via
  the `x-device-id` header. No login required.
- **Schema:** `watchlist_entries(device_id, symbol, note, added_at, updated_at)` with a
  composite primary key on `(device_id, symbol)`.
- **API:** [pages/api/watchlist.js](pages/api/watchlist.js) exposes:
  - `GET /api/watchlist` — returns the device's saved entries
  - `PUT /api/watchlist` with `{ entries: [...] }` — replaces the device's entries atomically
- **Sync behavior:** On mount the client fetches server state; if the server is empty but
  `localStorage` has a watchlist, the local copy is migrated up. After hydration, every
  watchlist mutation triggers a debounced (600ms) PUT, with `localStorage` kept as an offline
  cache. A small status pill in the watchlist header confirms each save.

> The default SQLite file works perfectly for local dev and self-hosted deployments. **It will
> not persist on Vercel** (their serverless functions run on a read-only filesystem); for
> Vercel, swap `lib/db.js` for a managed provider like Vercel Postgres, Vercel KV, or
> [Turso](https://turso.tech/) (libsql, drop-in API-compatible with better-sqlite3).

## Project layout

```
components/
  stock-dashboard.jsx       Main board + watchlist + analysis modal
  top-bar.jsx               Sticky nav with Watchlist / Top Gainers / Most Active menus
  trading-chart.jsx         Candlestick + SMA + Volume + RSI SVG chart
  analyst-insights.jsx      Analyst rating badge, rating gauge, price targets, distribution
  financials-section.jsx    Revenue/earnings chart, EPS table, income statement table
lib/
  stocks.js                 Yahoo Finance data layer (quotes, history, fundamentals)
  analytics.js              Recommendation scoring + client-side event logger
  db.js                     SQLite (better-sqlite3) — watchlist persistence
  news-brief.js             Static daily news brief — edit by hand or via Claude Code
pages/
  index.js                  Home page (SSR'd trending board)
  _app.js                   App shell
  api/
    trending.js             /api/trending — refresh the board
    quote.js                /api/quote — single-symbol quote
    search.js               /api/search — symbol type-ahead
    analytics.js            /api/analytics — chart history + recommendation + fundamentals
    watchlist.js            /api/watchlist — load / save per-device watchlist
styles/
  globals.css               All styles (no CSS framework)
scripts/
  refresh-news-brief.mjs    Regenerates lib/news-brief.js from live Yahoo + Google News
.github/
  workflows/
    refresh-brief.yml       Cron workflow that runs the refresh script + commits
data/                       SQLite database lives here (gitignored, auto-created)
```

## Data sources

All data comes directly from Yahoo Finance's public endpoints; no API key is required.

- **Trending list:** `query1.finance.yahoo.com/v1/finance/trending/US`
- **Top gainers / most active:**
  `query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers|most_actives`
  (falls back to a derived sort of the trending board if the screener errors)
- **Chart / OHLC history:** `query1.finance.yahoo.com/v8/finance/chart/<symbol>`
- **Symbol search:** `query1.finance.yahoo.com/v1/finance/search`
- **Fundamentals + analyst data:**
  `query1.finance.yahoo.com/v10/finance/quoteSummary/<symbol>` with modules
  `incomeStatementHistory,earnings,earningsHistory,financialData,recommendationTrend` —
  requires a crumb/cookie pair which is fetched and cached for an hour. If the auth fails
  the modal gracefully hides the analyst and financials sections while the rest of the
  analysis continues to work.
- **Headlines:** Google News RSS, queried per ticker.

## Notes

- Built on **Next.js 16** (Pages Router) with **React 19**.
- No external chart library — all charts are hand-rolled SVG so the bundle stays small.
- The analytics endpoint accepts `?range=1w|1m|3m` and `?skipFundamentals=true` (the
  range tabs use the latter to avoid re-fetching financials on every range switch).
