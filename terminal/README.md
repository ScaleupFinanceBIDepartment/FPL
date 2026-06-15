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

## Data
The prototype ships with a **deterministically generated** sample universe
(`data.js`): 6 managers, ~116 Premier League players, a snake draft, standings and
8-GW history — so every view is fully populated and stable. This is sample data,
not the league's real Supabase data.

> Next step (optional): wire `data.js` to the real `fpl_standings` /
> `fpl_current_squads` / `fpl_draft_picks` tables (Supabase) so the terminal shows
> live league data instead of the generated sample.

Files: `index.html` (shell + fonts), `term.css` (theme), `app.jsx` (views/drawer),
`data.js` (data layer → `window.TD`).
