# DraftDay — Multiplayer Setup

## What you need

- A free [Supabase](https://supabase.com) account
- Your existing GitHub repo (for GitHub Pages hosting)
- Your Render proxy already deployed at `https://snowman-dynasty.onrender.com`

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New project**
3. Give it a name (e.g. `draftday`), set a database password, pick a region
4. Wait ~2 minutes for it to provision

---

## Step 2 — Run the database setup

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open `supabase-setup.sql` from this folder, copy the entire contents, paste it in
4. Click **Run**

You should see "Success" with no errors.

---

## Step 3 — Get your Supabase keys

1. In your Supabase project, go to **Settings → API**
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public** key (the long JWT string)

---

## Step 4 — Add your keys to the HTML files

In both `login.html` and `auction.html`, find these two lines near the top of the `<script>` tag:

```js
const SUPABASE_URL      = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace the placeholder strings with your actual values from Step 3.

---

## Step 5 — Push to GitHub

Add `login.html` and the updated `auction.html` to your repo:

```bash
git add login.html auction.html
git commit -m "Add multiplayer with Supabase auth"
git push
```

Make sure GitHub Pages is enabled (Settings → Pages → Source: `main` → root).

---

## How it works

| File | What it does |
|------|-------------|
| `login.html` | Sign up / sign in with email + password |
| `auction.html` | Full app — dashboard, wizard, lobby, auction room |
| `server.js` (Render) | MLB player data proxy (unchanged) |
| Supabase | Auth, database, real-time sync |

## User flow

1. User visits `auction.html` → redirected to `login.html` if not signed in
2. After login → lands on dashboard (list of their auctions)
3. Creator clicks **New auction** → goes through wizard → ends up in lobby
4. Lobby shows an **invite link** — share this with league mates
5. League mates click link → login/signup → land in lobby, claim a team slot
6. Creator clicks **Start auction** → everyone transitions to the live room
7. All bids, nominations, and timer countdowns are synced in real time via Supabase

## Invite link format

```
https://snowman2433.github.io/Dynasty-Baseball-App/auction.html?invite=TOKEN
```

The token is a 12-character hex string auto-generated when the auction is created.
