# Market Current

A small Next.js site for checking trending stocks each day, keeping a personal
watchlist (per-account, signed in with Google or email/password), and drilling
into a stock for a full TradingView-style chart, technical recommendation,
analyst insights, and a fundamentals view (income statement + earnings).

## Requirements

- Node.js **>= 20.9.0** (Next 16 will refuse to start on Node 18)
- npm 10+ (ships with Node 20)

If you're stuck on an older Node, install [nvm](https://github.com/nvm-sh/nvm) and run:

```bash
nvm install 20
nvm use 20
```

## Environment variables

The app needs a database (Turso) and a session secret to run. Google sign-in is
optional. Add the following to `.env.local` in the project root:

| Variable                 | Purpose                                                                                            | Required? |
| ------------------------ | -------------------------------------------------------------------------------------------------- | --------- |
| `TURSO_DATABASE_URL`     | libSQL database URL from `turso db show <name> --url`, e.g. `libsql://foo.turso.io`.               | **Required** |
| `TURSO_AUTH_TOKEN`       | Database auth token from `turso db tokens create <name>`.                                          | **Required** (remote DB) |
| `NEXTAUTH_SECRET`        | Secret used to sign session JWTs. Generate with `openssl rand -base64 32`.                          | **Required** |
| `NEXTAUTH_URL`           | Public URL of the site, e.g. `http://localhost:3000` in dev.                                       | **Required** in production |
| `GOOGLE_CLIENT_ID`       | OAuth client id from Google Cloud Console. Without it the "Continue with Google" button is hidden. | Optional  |
| `GOOGLE_CLIENT_SECRET`   | OAuth client secret matching the above.                                                            | Optional  |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | [logo.dev](https://logo.dev) publishable token (`pk_...`). Fills in company logos for tickers with no bundled mark — see **Company logos**. | Optional  |

A starter `.env.local`:

```ini
# Database
TURSO_DATABASE_URL=libsql://<your-db-name>-<your-user>.turso.io
TURSO_AUTH_TOKEN=<long jwt from `turso db tokens create`>

# Auth
NEXTAUTH_SECRET=<output of `openssl rand -base64 32`>
NEXTAUTH_URL=http://localhost:3000

# Optional — enables the Google sign-in button
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional — widens company logo coverage beyond the bundled marks
NEXT_PUBLIC_LOGO_DEV_TOKEN=
```

`.env.local` is gitignored. Next.js auto-loads it on every `npm run dev` /
`npm run build` / `npm start`.

### Setting up the Turso database (one-time, free)

The watchlist + user accounts live in [Turso](https://turso.tech/) — a hosted
libSQL service (SQLite-compatible). Free tier covers way more than this app needs.

```bash
# 1. Install the Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 2. Sign up / sign in (opens browser, GitHub or Google OAuth)
turso auth signup        # first time
# or
turso auth login         # if you already have an account

# 3. Create a database
turso db create stock-website

# 4. Get the connection URL — copy into TURSO_DATABASE_URL
turso db show stock-website --url

# 5. Generate an auth token — copy into TURSO_AUTH_TOKEN
turso db tokens create stock-website
```

Schema (`users` + `watchlist_entries`) auto-creates on first DB call — nothing
else to run. You can inspect the data anytime with `turso db shell stock-website`
then `SELECT email, provider FROM users;`.

### Setting up Google OAuth (optional but nice)

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. **Authorized JavaScript origins:** `http://localhost:3000` (and your production URL).
4. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google` (and the production equivalent).
5. Copy the client id + secret into `.env.local` as shown above.
6. Restart `npm run dev` — the Google button on `/login` will light up.
7. To let any Google account sign in (not just test users), go to **OAuth consent
   screen** → click **PUBLISH APP** so the app status flips from Testing to In
   production. Users will see an "unverified app" warning until you go through
   Google's verification flow — for personal/small projects that's fine, they
   can click "Advanced → Continue".

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

## Deploy to Vercel

1. **Push the repo to GitHub** and import it in [vercel.com/new](https://vercel.com/new).
   Vercel auto-detects Next.js — accept the defaults.

2. **Set environment variables** in **Vercel → Project → Settings → Environment Variables**.
   For each variable below, **tick all three scopes** (Production, Preview, Development):

   | Name                    | Value                                                |
   | ----------------------- | ---------------------------------------------------- |
   | `TURSO_DATABASE_URL`    | from `turso db show <name> --url`                    |
   | `TURSO_AUTH_TOKEN`      | from `turso db tokens create <name>`                 |
   | `NEXTAUTH_SECRET`       | from `openssl rand -base64 32`                       |
   | `NEXTAUTH_URL`          | your Vercel URL, e.g. `https://your-app.vercel.app` |
   | `GOOGLE_CLIENT_ID`      | (optional) Google OAuth client id                   |
   | `GOOGLE_CLIENT_SECRET`  | (optional) Google OAuth client secret               |

3. **Update Google Cloud Console** (only if using Google sign-in) — add the production
   URL to both Authorized JavaScript origins and Authorized redirect URIs on your OAuth
   client:
   - `https://your-app.vercel.app`
   - `https://your-app.vercel.app/api/auth/callback/google`
   Keep your `http://localhost:3000` entries too so local dev still works.

4. **Trigger a fresh build.** Env vars added after a deploy don't apply retroactively:
   Deployments tab → latest row → **⋯ → Redeploy** (uncheck "Use existing Build Cache"
   to be safe).

### Common deploy issues

- **`[NO_SECRET] Please define a 'secret' in production`** in the Vercel logs →
  `NEXTAUTH_SECRET` isn't set on Vercel (or wasn't ticked for Production scope). Set it,
  redeploy.
- **`ENOENT: mkdir '/var/task/data'`** → you're still on the old `better-sqlite3` code
  that tries to write to the local filesystem. Make sure you're on the `@libsql/client`
  version of `lib/db.js` and that `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are both set.
- **`redirect_uri_mismatch`** from Google → the URL on your Vercel deployment isn't in
  your OAuth client's Authorized redirect URIs. Add it exactly.

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
- **Watchlist** with notes — synced live to your account in the Turso DB (see Accounts & watchlist persistence below).
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

### Accounts & watchlist persistence

User accounts and watchlists are stored in a hosted libSQL database via
[Turso](https://turso.tech/). Works locally and in serverless (Vercel) without code
changes — the same DB serves both.

- **Auth:** [NextAuth.js v4](https://next-auth.js.org/) with two providers wired up in
  [lib/auth-options.js](lib/auth-options.js):
  - **Credentials** — email/password, hashed with `bcryptjs`
  - **Google OAuth** — auto-enabled when `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` are set
- **Session strategy:** JWT (no separate sessions table required)
- **DB client:** [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts).
  Schema is created on first call by [lib/db.js](lib/db.js) — nothing to migrate manually:
  - `users(id, email UNIQUE, name, image, password_hash, provider, created_at)`
  - `watchlist_entries(user_id, symbol, note, added_at, updated_at)` with composite PK on `(user_id, symbol)`
- **API:** [pages/api/watchlist.js](pages/api/watchlist.js) — both endpoints require a
  signed-in session (401 otherwise):
  - `GET /api/watchlist` → user's saved entries
  - `PUT /api/watchlist` with `{ entries: [...] }` → atomically replaces them
- **Client behavior:** On login/sign-up, [components/stock-dashboard.jsx](components/stock-dashboard.jsx)
  hydrates the watchlist from `/api/watchlist`. Subsequent mutations are debounced (600ms)
  and PUT back. A small status pill confirms each save. Anonymous visitors see a
  "Sign in to save your watchlist" card in place of the form.

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
  db.js                     Turso (libSQL) — users + watchlist persistence
  auth-options.js           NextAuth providers + callbacks (Google + Credentials)
  news-brief.js             Static daily news brief — edit by hand or via Claude Code
pages/
  index.js                  Home page (SSR'd trending board)
  _app.js                   App shell wrapped in <SessionProvider>
  _document.js              Pre-hydration script that applies the saved theme
  login.js                  Sign-in / sign-up page (Google + email/password)
  api/
    trending.js             /api/trending — refresh the board
    quote.js                /api/quote — single-symbol quote
    search.js               /api/search — symbol type-ahead
    analytics.js            /api/analytics — chart history + recommendation + fundamentals
    watchlist.js            /api/watchlist — load / save the signed-in user's watchlist
    auth/
      [...nextauth].js      NextAuth catch-all (Google + Credentials providers)
      register.js           Email/password sign-up endpoint
styles/
  globals.css               All styles (no CSS framework)
scripts/
  refresh-news-brief.mjs    Regenerates lib/news-brief.js from live Yahoo + Google News
.github/
  workflows/
    refresh-brief.yml       Cron workflow that runs the refresh script + commits
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

## Company logos

Every stock is shown with its company's brand mark. Sources are tried in order
and each falls through to the next if the image fails to load, ending at a
monogram tile built from the ticker:

1. **Bundled marks** — ~120 tickers have a real logo committed under
   `public/brand-marks/<SYMBOL>.svg`. These are vector, need no network, and are
   the only source guaranteed to work. Generated from
   [simple-icons](https://simple-icons.org) (CC0-1.0):

   ```bash
   npm run build-brand-marks   # after editing scripts/generate-brand-marks.mjs
   ```

   Edit `SLUG_BY_SYMBOL` in that script to add a ticker. The generator fails
   loudly on an unknown slug rather than guessing — an earlier fuzzy match
   silently gave Union Pacific the UPS logo.

2. **logo.dev**, by ticker — only when `NEXT_PUBLIC_LOGO_DEV_TOKEN` is set, and
   off by default. This is the one source that covers the whole market,
   including large caps no free icon set carries (Disney, PepsiCo, JPMorgan,
   Costco, Exxon, Pfizer). Setting a publishable token is what closes the gap
   left by the bundled set.

3. **Parqet**, by ticker, then **DuckDuckGo** and **Google** favicons, by the
   company's domain. Keyless but unverified, and favicon fidelity is low.

Trademarks belong to their owners; the marks identify the company behind a
ticker.

## Notes

- Built on **Next.js 16** (Pages Router) with **React 19**.
- No external chart library — all charts are hand-rolled SVG so the bundle stays small.
- The analytics endpoint accepts `?range=1w|1m|3m` and `?skipFundamentals=true` (the
  range tabs use the latter to avoid re-fetching financials on every range switch).
