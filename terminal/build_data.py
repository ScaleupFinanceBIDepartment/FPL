#!/usr/bin/env python3
"""Build terminal/data.json from the public FPL Draft API (league 56144).

The FPL Draft API has no CORS headers, so the browser can't read it directly —
this script fetches it server-side (locally or in CI) and bakes a data.json in
the shape the terminal's data layer expects (window.TD). The static dashboard
then loads data.json with no auth and no cross-origin calls.

Mirrors the league pull in ../fpl_extract_supabase.py (same endpoints), but
emits JSON for the dashboard instead of writing to Supabase.

Usage:  python3 build_data.py
"""
import json
import os
import sys
import urllib.request

API = "https://draft.premierleague.com/api"
LEAGUE_ID = int(os.environ.get("FPL_LEAGUE_ID", "56144"))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "data.json")
UA = {"User-Agent": "fpl-terminal-dashboard"}

POS = {1: "GK", 2: "DEF", 3: "MID", 4: "FWD"}
STATUS = {"a": "ok", "d": "doubt", "i": "inj", "s": "inj", "u": "inj", "n": "inj"}
FORM_GWS = 6
MAX_PLAYERS = 400


def fetch(path):
    req = urllib.request.Request(f"{API}/{path}", headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def fetch_live(gw):
    """{element_id: total_points} for a gameweek."""
    try:
        els = fetch(f"event/{gw}/live").get("elements", [])
        if isinstance(els, dict):   # keyed by element id (string) -> {stats:{...}}
            return {int(k): (v.get("stats") or {}).get("total_points", 0)
                    for k, v in els.items()}
        return {e["id"]: (e.get("stats") or {}).get("total_points", 0)
                for e in els if isinstance(e, dict) and "id" in e}
    except Exception as e:  # noqa: BLE001
        print(f"  ! live GW{gw} failed: {e}", file=sys.stderr)
        return {}


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def build():
    print("Fetching FPL Draft data...", file=sys.stderr)
    boot = fetch("bootstrap-static")
    game = fetch("game")
    league = fetch(f"league/{LEAGUE_ID}/details")
    estatus = fetch(f"league/{LEAGUE_ID}/element-status")

    cur = game.get("current_event") or 1
    gws = [g for g in range(max(1, cur - FORM_GWS + 1), cur + 1)]
    live = {g: fetch_live(g) for g in gws}

    elements = {e["id"]: e for e in boot["elements"]}
    teams = {t["id"]: t["short_name"] for t in boot["teams"]}
    entries = {le["entry_id"]: le for le in league["league_entries"]}
    entries_by_leid = {le["id"]: le for le in league["league_entries"]}

    def mgr_name(le):
        return f"{le.get('player_first_name','')} {le.get('player_last_name','')}".strip()

    owner_of = {}          # element_id -> entry_id
    for s in estatus.get("element_status", []):
        if s.get("owner"):
            owner_of[s["element"]] = s["owner"]

    # ---- build player rows ----
    def make_player(e):
        pid = e["id"]
        owner_eid = owner_of.get(pid)
        le = entries.get(owner_eid) if owner_eid else None
        form = [live[g].get(pid, 0) for g in gws]
        return {
            "id": pid,
            "name": e.get("web_name", ""),
            "club": teams.get(e.get("team"), "?"),
            "pos": POS.get(e.get("element_type"), "MID"),
            "pts": e.get("total_points", 0),
            "g": e.get("goals_scored", 0),
            "a": e.get("assists", 0),
            "xg": round(fnum(e.get("expected_goals")), 1),
            "xa": round(fnum(e.get("expected_assists")), 1),
            "cs": e.get("clean_sheets", 0),
            "saves": e.get("saves", 0),
            "bonus": e.get("bps", e.get("bonus", 0)),
            "mins": e.get("minutes", 0),
            "own": round(fnum(e.get("selected_by_percent")), 1),
            "form": form,
            "gw": form[-1] if form else 0,
            "owner": le["entry_name"] if le else None,
            "status": STATUS.get(e.get("status", "a"), "ok"),
            "price": round((e.get("now_cost") or 0) / 10, 1),
        }

    owned_ids = set(owner_of)
    rows = []
    for pid, e in elements.items():
        if pid in owned_ids or (e.get("minutes", 0) > 0 and e.get("total_points", 0) > 0):
            rows.append(make_player(e))
    rows.sort(key=lambda p: p["pts"], reverse=True)
    # keep all owned + top free agents up to MAX_PLAYERS
    owned = [p for p in rows if p["owner"]]
    free = [p for p in rows if not p["owner"]]
    rows = (owned + free)
    rows.sort(key=lambda p: p["pts"], reverse=True)
    if len(rows) > MAX_PLAYERS:
        keep = {id(p) for p in owned}
        trimmed, fa = [], 0
        for p in rows:
            if p["owner"]:
                trimmed.append(p)
            elif fa < MAX_PLAYERS - len(owned):
                trimmed.append(p); fa += 1
        rows = trimmed
        rows.sort(key=lambda p: p["pts"], reverse=True)
    for i, p in enumerate(rows, 1):
        p["rank"] = i
    by_id = {p["id"]: p for p in rows}

    # ---- managers + squads + starters ----
    managers = []
    squads = {}  # entry_id -> [player dicts]
    for pid, eid in owner_of.items():
        squads.setdefault(eid, []).append(by_id.get(pid) or make_player(elements[pid]))
    for eid, le in entries.items():
        squad = squads.get(eid, [])
        starters = set()
        try:
            picks = fetch(f"entry/{eid}/event/{cur}").get("picks", [])
            starters = {pk["element"] for pk in picks if pk.get("position", 99) <= 11}
        except Exception:  # noqa: BLE001
            # fallback: best XI by gw points (1-4-4-2)
            need = {"GK": 1, "DEF": 4, "MID": 4, "FWD": 2}
            for pos, n in need.items():
                for p in sorted([x for x in squad if x["pos"] == pos],
                                key=lambda x: x["gw"], reverse=True)[:n]:
                    starters.add(p["id"])
        for p in squad:
            p["starter"] = p["id"] in starters
        managers.append({"team": le["entry_name"], "mgr": mgr_name(le),
                         "entry": eid, "squad": squad})

    # ---- standings (real totals/ranks; form is a squad-points proxy) ----
    standings = []
    for s in league["standings"]:
        le = entries_by_leid.get(s["league_entry"])
        if not le:
            continue
        eid = le["entry_id"]
        squad = squads.get(eid, [])
        form = [sum(p["form"][i] for p in squad) for i in range(len(gws))]
        standings.append({
            "team": le["entry_name"], "mgr": mgr_name(le),
            "total": s.get("total", 0), "gwPts": s.get("event_total", 0),
            "rank": s.get("rank", 0), "form": form,
        })
    standings.sort(key=lambda x: x["rank"])
    for m in managers:                       # expose gwPts on managers too
        st = next((s for s in standings if s["team"] == m["team"]), None)
        m["gw"] = st["gwPts"] if st else 0

    # ---- movers (biggest 6-GW form swing among owned/relevant) ----
    movers = [{**p, "delta": p["form"][-1] - p["form"][0]} for p in rows if p["form"]]
    risers = sorted(movers, key=lambda p: p["delta"], reverse=True)[:6]
    fallers = sorted(movers, key=lambda p: p["delta"])[:6]

    data = {
        "gw": cur,
        "season": game.get("season") or "25/26",
        "leagueId": LEAGUE_ID,
        "leagueName": league.get("league", {}).get("name", "FPL Draft"),
        "players": rows,
        "managers": managers,
        "standings": standings,
        "risers": risers,
        "fallers": fallers,
        "clubs": sorted({p["club"] for p in rows}),
    }
    with open(OUT, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {OUT}: {len(rows)} players, {len(managers)} managers, "
          f"{len(standings)} standings, GW{cur}.", file=sys.stderr)
    print(f"  leader: {standings[0]['team']} ({standings[0]['total']})", file=sys.stderr)


if __name__ == "__main__":
    build()
