#!/usr/bin/env python3
"""Build stats.json for the WC2026 Fantasy dashboard.

Pulls FIFA's public, CORS-open fantasy feeds and produces leaderboards
(top scorers, assists, points, clean sheets, most selected) for the dashboard.
No authentication required for this step.

Data sources & join:
  * players.json      -> names, nation, position, ownership, fantasy points
                         (stats.totalPoints / avgPoints / form). Always joined.
  * player_stats.json -> goals, assists, clean_sheets, etc., keyed by FIFA
                         person id. Joined to players via players.json `fifaId`.
                         NOTE: pre-tournament `fifaId` is null for everyone, so
                         goal/assist boards stay empty until FIFA populates it
                         once matches begin. The join is reported in meta.

Usage:  python3 build_stats.py            # fetch live feeds, write stats.json
        python3 build_stats.py --offline  # use cached copies in ./data/
"""
import os
import sys
import json
import datetime
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FEEDS = {
    "players": "https://play.fifa.com/json/fantasy/players.json",
    "squads": "https://play.fifa.com/json/fantasy/squads.json",
    "player_stats": "https://play.fifa.com/json/fantasy/player_stats.json",
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


def base_row(p, sq):
    s = sq.get(p["squadId"], {})
    return {
        "id": p["id"],
        "name": player_name(p),
        "nation": s.get("name"),
        "nationAbbr": s.get("abbr"),
        "group": (s.get("group") or "").upper(),
        "pos": p["position"],
    }


def top_by(rows, key, extra_keys, n=TOP_N, positions=None):
    """Return the n rows with the highest `key` (>0), with `extra_keys` kept."""
    cand = [r for r in rows if (r.get(key) or 0) > 0
            and (positions is None or r["pos"] in positions)]
    cand.sort(key=lambda r: (r[key], r.get("points", 0)), reverse=True)
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
    pstats = load_feed("player_stats")
    sq = {s["id"]: s for s in squads}

    pool = [p for p in players if p.get("status") == "playing"]

    matched = 0
    rows = []
    for p in pool:
        r = base_row(p, sq)
        st = p.get("stats") or {}
        r["points"] = st.get("totalPoints", 0) or 0
        r["avg"] = st.get("avgPoints", 0) or 0
        r["form"] = st.get("form", 0) or 0
        r["ownPct"] = round(p.get("percentSelected") or 0.0, 1)
        # detailed stats via fifaId join (goals/assists/clean sheets)
        fid = p.get("fifaId")
        det = pstats.get(str(fid)) if fid is not None else None
        if det:
            matched += 1
            r["goals"] = det.get("goals", 0)
            r["assists"] = det.get("assists", 0)
            r["cleanSheets"] = det.get("clean_sheets", 0)
            r["games"] = det.get("games_played", 0)
        else:
            r["goals"] = r["assists"] = r["cleanSheets"] = r["games"] = 0
        rows.append(r)

    leaderboards = {
        "topScorers": top_by(rows, "goals", ["goals", "assists", "games"]),
        "topAssists": top_by(rows, "assists", ["assists", "goals", "games"]),
        "topPoints": top_by(rows, "points", ["points", "avg", "form"]),
        "topCleanSheets": top_by(rows, "cleanSheets", ["cleanSheets", "games"],
                                 positions=("GK", "DEF")),
        "mostSelected": top_by(rows, "ownPct", ["ownPct", "points"]),
    }

    join_ok = matched > 0
    model = {
        "meta": {
            "league": LEAGUE,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc)
            .isoformat(timespec="seconds"),
            "dataSource": "https://play.fifa.com/json/fantasy/*",
            "playerCount": len(rows),
            "tournamentStart": TOURNAMENT_START,
            "statsJoin": {
                "available": join_ok,
                "matched": matched,
                "note": ("Mål/assist/clean sheets er aktive." if join_ok else
                         "Mål/assist/clean sheets afventer FIFAs kampdata "
                         "(fifaId ikke udfyldt endnu). Point og mest valgte er live."),
            },
        },
        "leaderboards": leaderboards,
    }
    out = os.path.join(HERE, "stats.json")
    with open(out, "w") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out}: {len(rows)} players, stat-join matched {matched}.",
          file=sys.stderr)
    for k, v in leaderboards.items():
        print(f"  {k}: {len(v)} rows", file=sys.stderr)


if __name__ == "__main__":
    build()
