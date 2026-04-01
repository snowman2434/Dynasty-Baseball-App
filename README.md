# DraftDay 🏟️

A fantasy baseball auction tool built as a personal project. Currently a frontend-only prototype — no backend or accounts required. Open the HTML files directly in any browser.

## What it does

- **Live auction room** — players go on the block, managers bid in real time with countdown timers
- **Regular or slow auction modes** — timers in seconds (live draft) or hours (async over days)
- **Multi-nomination support** — configure how many players each team can nominate simultaneously
- **Keeper support** — assign keepers per team before the auction; prices auto-deduct from budgets
- **Custom roster positions** — pick exactly which slots your league uses (C, 1B, 2B, SS, 3B, MI, CI, OF, UTIL, SP, RP, P, BENCH, MiLB)
- **Full roster view** — see every team's roster with filled and empty position slots at any time
- **Per-team settings** — individual team names, budgets, and nomination slot counts

## Files

| File | Description |
|------|-------------|
| `index.html` | Landing page |
| `auction.html` | Full auction tool (setup wizard → lobby → auction room) |

## How to run

No build step needed. Just open `index.html` in your browser, or serve locally:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Roadmap

- [ ] Real multiplayer via WebSockets (so league mates can actually join)
- [ ] Player database with real stats and projections
- [ ] Draft export (CSV / printable recap)
- [ ] League history and year-over-year keeper tracking
- [ ] Mobile layout

## Tech stack

Pure HTML, CSS, and vanilla JavaScript. No frameworks, no dependencies, no build tools.

---

Built with [Claude](https://claude.ai).
