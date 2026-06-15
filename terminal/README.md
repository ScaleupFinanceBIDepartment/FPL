# FPL Draft Terminal

A dense, Bloomberg-style "data desk" view of the FPL Draft league — implemented
from the Claude Design handoff (the **Terminal** direction the design landed on).
Self-contained static app (React UMD + Babel standalone, IBM Plex Mono), isolated
in `terminal/` like the other dashboards in this repo.

## Views
- **LEAGUE** (`1` / F1) — status bar + live ticker, leader strip, sortable league
  table with form sparklines, Top Performers and Form Movers panels.
- **PLAYERS** (`2` / F2) — dense player index: 13 sortable columns (PTS, GW, G, A,
  xG, xA, BPS, OWN%, drafted-by). Click a header to sort, `/` to search, filter by
  position and ALL / MY SQUAD / FREE AGENTS.
- **SQUADS** (`3` / F3) — pick a manager, see their 15-man roster grouped by
  position with XI/bench roles.

Click any player → a detail drawer (KPIs, last-6-GW form chart, season splits).
`Esc` closes it. Your watched team is remembered in `localStorage`.

## Run
```bash
cd terminal && python3 -m http.server 8000   # open http://localhost:8000/
```

## Data — real FPL Draft league (56144)

`build_data.py` pulls the **public FPL Draft API** (`draft.premierleague.com/api`,
league **56144**, no auth) and bakes `data.json` in the `window.TD` shape:
real standings, rosters/lineups, draft ownership and per-player stats
(points, goals, assists, xG, xA, BPS, last-6-GW form). The FPL API has no CORS
headers, so the browser can't call it directly — we fetch server-side and the
static page reads the baked `data.json` (same-origin, no auth).

```bash
cd terminal
python3 build_data.py          # fetch FPL Draft API → write data.json
python3 -m http.server 8000    # open http://localhost:8000/
```

`data.js` loads `data.json` first (same-origin) and **falls back to a generated
sample universe** if it's missing — so the page always renders, even opened
standalone. Refreshed by `../.github/workflows/terminal-data.yml` (weekly + manual).

> Note: the 25/26 season is complete (GW38), so the data is final until a new
> season starts. Set `FPL_LEAGUE_ID` to point at a different draft league.

Files: `index.html` (shell + fonts), `term.css` (theme), `app.jsx` (views/drawer),
`data.js` (loader + sample fallback → `window.TD`), `build_data.py` (FPL → `data.json`),
`data.json` (baked real league data).
