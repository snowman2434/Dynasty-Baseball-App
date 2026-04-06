# DraftDay — MLB Stats Proxy

A lightweight Express server that proxies requests to the MLB Stats API (`statsapi.mlb.com`) with CORS headers, so DraftDay's browser-based frontend can fetch live player data.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/players?season=2025` | All active MLB players |
| GET | `/players/:id` | One player's bio |
| GET | `/players/:id/stats?group=hitting&season=2025` | Season stats for one player |
| GET | `/teams` | All MLB teams |
| GET | `/teams/:id/roster?rosterType=active` | Active roster for a team |
| GET | `/stats/leaders?leaderCategories=homeRuns&limit=50` | League leaderboards |
| GET | `/auction/players?season=2025` | **Main DraftDay endpoint** — all players + stats merged |

## Run locally

```bash
npm install
npm run dev        # uses nodemon, auto-restarts on changes
# or
npm start          # plain node
```

Server runs on `http://localhost:3001` by default.

## Deploy to Render (free)

1. Push this folder to a GitHub repo (can be the same `Dynasty-Baseball-App` repo, in a `/proxy` subfolder, or a separate repo)
2. Go to [render.com](https://render.com) and sign in with GitHub
3. Click **New → Web Service**
4. Select your repo
5. Set these fields:
   - **Name**: `draftday-proxy` (or anything)
   - **Runtime**: Node
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free
6. Click **Create Web Service**

Render will give you a URL like `https://draftday-proxy.onrender.com`. Paste that into `auction.html` as your `PROXY_BASE` value.

## Deploy to Vercel (free)

```bash
npm i -g vercel
vercel
```

Follow the prompts. Vercel will give you a URL to use as `PROXY_BASE`.

## Connect to DraftDay frontend

In `auction.html`, find this line near the top of the `<script>`:

```js
const PROXY_BASE = 'http://localhost:3001'; // change to your deployed URL
```

Update it to your Render/Vercel URL when deployed.
