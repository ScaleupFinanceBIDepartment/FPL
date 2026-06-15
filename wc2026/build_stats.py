#!/usr/bin/env python3
"""Build stats.json for the WC2026 Fantasy dashboard.

Pulls FIFA's public, CORS-open fantasy feeds and produces leaderboards
(top scorers, assists, points, most selected) for the dashboard. No auth.

Data sources & join:
  * players.json -> names, nation, position, ownership, fantasy points
                    (stats.totalPoints / avgPoints / form).
  * squads.json  -> nation name / abbr / group.
  * rounds.json  -> match results incl. homeGoalScorersAssists /
                    awayGoalScorersAssists, each {playerId, assistId} using the
                    fantasy player id. Goals & assists are tallied from here.

  (player_stats.json also exists but is keyed by FIFA person id with no usable
   join to the fantasy ids, so it is NOT used.)

Usage:  python3 build_stats.py            # fetch live feeds, write stats.json
        python3 build_stats.py --offline  # use cached copies in ./data/
"""
import os
import sys
import json
import datetime
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FEEDS = {
    "players": "https://play.fifa.com/json/fantasy/players.json",
    "squads": "https://play.fifa.com/json/fantasy/squads.json",
    "rounds": "https://play.fifa.com/json/fantasy/rounds.json",
}
LEAGUE = {"id": 128462, "name": "SuF", "joinCode": "2SPXEBAF"}
TOURNAMENT_START = "2026-06-11"
TOP_N = 25


def load_feed(name):
    path = os.path.join(DATA, name + ".json")
    if "--offline" not in sys.argv:
        try:
            req = urllib.request.Request(FEEDS[name], headers={"User-Agent": "wc2026-dashboard"})
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
            os.makedirs(DATA, exist_ok=True)
            with open(path, "wb") as f:
                f.write(raw)
            return json.loads(raw)
        except Exception as e:  # noqa: BLE001
            print(f"  ! live fetch failed for {name} ({e}); trying cache", file=sys.stderr)
    with open(path) as f:
        return json.load(f)


def player_name(p):
    kn = p.get("knownName")
    if kn:
        return kn
    return f"{p.get('firstName') or ''} {p.get('lastName') or ''}".strip()


def tally_matches(rounds):
    """Return (goals, assists, matches_played) from rounds.json match data."""
    goals, assists = Counter(), Counter()
    played = 0
    for rnd in rounds:
        for m in rnd.get("tournaments", []):
            if m.get("homeScore") is None and m.get("awayScore") is None:
                continue
            played += 1
            for side in ("homeGoalScorersAssists", "awayGoalScorersAssists"):
                for ev in (m.get(side) or []):
                    if ev.get("playerId"):
                        goals[ev["playerId"]] += 1
                    if ev.get("assistId"):
                        assists[ev["assistId"]] += 1
    return goals, assists, played


def top_by(rows, key, tiebreak, extra_keys, n=TOP_N):
    cand = [r for r in rows if (r.get(key) or 0) > 0]
    cand.sort(key=lambda r: (r[key], r.get(tiebreak, 0)), reverse=True)
    out = []
    for r in cand[:n]:
        out.append({**{k: r[k] for k in ("id", "name", "nation", "nationAbbr",
                                         "group", "pos")},
                    **{k: r.get(k) for k in extra_keys}})
    return out


def build():
    print("Loading feeds...", file=sys.stderr)
    players = load_feed("players")
    squads = load_feed("squads")
    rounds = load_feed("rounds")
    sq = {s["id"]: s for s in squads}

    goals, assists, matches_played = tally_matches(rounds)

    pool = [p for p in players if p.get("status") == "playing"]
    rows = []
    for p in pool:
        s = sq.get(p["squadId"], {})
        st = p.get("stats") or {}
        rows.append({
            "id": p["id"],
            "name": player_name(p),
            "nation": s.get("name"),
            "nationAbbr": s.get("abbr"),
            "group": (s.get("group") or "").upper(),
            "pos": p["position"],
            "points": st.get("totalPoints", 0) or 0,
            "avg": st.get("avgPoints", 0) or 0,
            "form": st.get("form", 0) or 0,
            "ownPct": round(p.get("percentSelected") or 0.0, 1),
            "goals": goals.get(p["id"], 0),
            "assists": assists.get(p["id"], 0),
        })

    leaderboards = {
        "topScorers": top_by(rows, "goals", "assists", ["goals", "assists"]),
        "topAssists": top_by(rows, "assists", "goals", ["assists", "goals"]),
        "topPoints": top_by(rows, "points", "avg", ["points", "avg", "form"]),
        "mostSelected": top_by(rows, "ownPct", "points", ["ownPct", "points"]),
    }

    note = (f"{matches_played} kampe spillet — mål, assists og point er live."
            if matches_played else
            "Turneringen er ikke startet endnu — leaderboards udfyldes når "
            "kampene begynder.")
    model = {
        "meta": {
            "league": LEAGUE,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc)
            .isoformat(timespec="seconds"),
            "dataSource": "https://play.fifa.com/json/fantasy/*",
            "playerCount": len(rows),
            "tournamentStart": TOURNAMENT_START,
            "matchesPlayed": matches_played,
            "note": note,
        },
        "leaderboards": leaderboards,
    }
    out = os.path.join(HERE, "stats.json")
    with open(out, "w") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out}: {len(rows)} players, {matches_played} matches played.",
          file=sys.stderr)
    for k, v in leaderboards.items():
        print(f"  {k}: {len(v)} rows", file=sys.stderr)


if __name__ == "__main__":
    build()
