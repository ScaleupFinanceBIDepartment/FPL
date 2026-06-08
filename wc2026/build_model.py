#!/usr/bin/env python3
"""Build model.json for the WC2026 Fantasy dashboard.

Pulls the public, CORS-open FIFA fantasy feeds and computes an expected-points
(xPts) model for every selectable player, calibrated to FIFA's WC fantasy
scoring. Output is a single self-contained model.json that the dashboard
(index.html) reads directly -- no auth required for this step.

Method (documented so the numbers are reproducible / tweakable):
  * Team strength from a World-Football-Elo snapshot (eloratings.net style).
      goals/match   gpm  = 1.35 * 10^((Elo-1800)/450)     (clamped to a sane range)
      conceded/match cpm = 1.35 * 10^((1800-Elo)/450)     (symmetric)
      clean-sheet prob   = exp(-cpm)                       (Poisson P(0 conceded))
  * Expected matches = 3 group games + Elo-weighted knockout advancement
    (R32, R16, QF, SF, Final).
  * A team's goal/assist output is split across positions, then within a
    position by price rank (stars carry more of the load) -- this also drives
    each player's start probability.
  * Points per appearance use FIFA's scoring:
      goal  GK 9 / DEF 7 / MID 6 / FWD 5 ; assist 3 ;
      clean sheet GK 5 / DEF 5 / MID 1 / FWD 0 ; appearance ~2 ;
      small card/penalty drag ; scouting bonus +2 if strong & <5% owned.
  * AVAILABILITY: a 0-1 injury/fitness factor (researched, see AVAILABILITY)
    multiplies xPts. Default 1.0.

Usage:  python3 build_model.py            # fetch live feeds, write model.json
        python3 build_model.py --offline  # use cached copies in ./data/
"""
import json
import math
import sys
import unicodedata
import datetime
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FEEDS = {
    "players": "https://play.fifa.com/json/fantasy/players.json",
    "squads": "https://play.fifa.com/json/fantasy/squads.json",
    "rounds": "https://play.fifa.com/json/fantasy/rounds.json",
}

# --- snapshot date for the human-readable "as of" labels ---------------------
ELO_AS_OF = "2026-06-05"
AVAIL_AS_OF = "2026-06-05"

# --- World Football Elo snapshot (best-effort, mid-2026) ---------------------
# Refresh from https://eloratings.net . Names must match squads.json exactly.
ELO = {
    "Spain": 2120, "Argentina": 2100, "France": 2080, "Brazil": 2030,
    "England": 2010, "Portugal": 1985, "Netherlands": 1975, "Germany": 1960,
    "Belgium": 1925, "Croatia": 1900, "Uruguay": 1900, "Colombia": 1900,
    "Morocco": 1870, "Japan": 1840, "Norway": 1830, "Ecuador": 1820,
    "Senegal": 1820, "Switzerland": 1820, "Austria": 1810, "USA": 1800,
    "Türkiye": 1800, "Mexico": 1790, "Czechia": 1790, "IR Iran": 1780,
    "Côte d'Ivoire": 1780, "Algeria": 1780, "Canada": 1760, "Paraguay": 1760,
    "Scotland": 1760, "Sweden": 1760, "Egypt": 1760,
    "Bosnia and Herzegovina": 1740, "Australia": 1730, "Ghana": 1700,
    "Congo DR": 1700, "Qatar": 1680, "South Africa": 1680, "Saudi Arabia": 1670,
    "Panama": 1660, "Uzbekistan": 1660, "Iraq": 1650, "Cabo Verde": 1620,
    "Jordan": 1620, "New Zealand": 1600, "Curaçao": 1580, "Haiti": 1560,
}
DEFAULT_ELO = 1700

# --- FIFA fantasy scoring constants ------------------------------------------
GOAL_PTS = {"GK": 9, "DEF": 7, "MID": 6, "FWD": 5}
CS_PTS = {"GK": 5, "DEF": 5, "MID": 1, "FWD": 0}
ASSIST_PTS = 3
APPEAR_FULL = 2.0          # 60+ minutes
APPEAR_SUB = 0.5           # weighted value of a cameo
CARD_PEN = {"GK": -0.10, "DEF": -0.45, "MID": -0.45, "FWD": -0.30}

# share of a team's goals / assists that flows to each position
GOAL_SHARE = {"FWD": 0.46, "MID": 0.38, "DEF": 0.14, "GK": 0.02}
ASSIST_SHARE = {"FWD": 0.34, "MID": 0.46, "DEF": 0.18, "GK": 0.02}
ASSIST_RATE = 0.75         # assists per goal (team level)

# start-probability decay by price rank within nation+position
START_DECAY = {
    "GK": [0.90, 0.12, 0.05],
    "DEF": [0.85, 0.80, 0.75, 0.68, 0.45, 0.25, 0.12, 0.06],
    "MID": [0.85, 0.80, 0.72, 0.60, 0.40, 0.25, 0.12, 0.06],
    "FWD": [0.82, 0.70, 0.45, 0.28, 0.15, 0.08],
}
START_FLOOR = 0.04

# --- AVAILABILITY flags (researched as of AVAIL_AS_OF) -----------------------
# matched on (first_contains, last_contains, squad, pos); any field None = wildcard
AVAILABILITY = [
    dict(last="yamal", squad="Spain", pos="MID", factor=0.65,
         note="Baglår-skade, i tvivl til åbningskampen"),
    dict(first="cristian", last="romero", squad="Argentina", pos="DEF", factor=0.88,
         note="MCL, på vej tilbage til fuld fitness"),
    dict(last="mbappé", squad="France", pos="FWD", factor=0.96, note="Mindre niggle, ventes klar"),
    dict(first="william", last="saliba", squad="France", pos="DEF", factor=0.55,
         note="Skade i tvivl om VM-deltagelse"),
    dict(first="lisandro", last="martínez", squad="Argentina", pos="DEF", factor=0.65,
         note="Vender tilbage fra langtidsskade"),
    dict(last="molina", squad="Argentina", pos="DEF", factor=0.78, note="Fitness-tvivl"),
    dict(last="montiel", squad="Argentina", pos="DEF", factor=0.78, note="Fitness-tvivl"),
    dict(last="rodrygo", squad="Brazil", factor=0.50, note="Rotations-/fitness-risiko"),
    dict(first="xavi", last="simons", squad="Netherlands", factor=0.50, note="Skade/form i tvivl"),
    dict(last="neymar", squad="Brazil", factor=0.00, note="Ude — ikke i VM-truppen"),
]

LEAGUE = {"id": 128462, "name": "SuF", "joinCode": "2SPXEBAF"}
BUDGET = 100.0
SQUAD_RULES = {"size": 15, "GK": 2, "DEF": 5, "MID": 5, "FWD": 3,
               "maxPerNation": 3, "minMid": 3}

# Recommended starting XI (resolved to FIFA player ids), both Yamal variants.
RECOMMENDED = {
    "formation": "4-3-3",
    "captainId": 500, "viceId": 468,
    "note": ("Skift GK pga. Spaniens 3-spiller-loft: med Yamal inde er Spanien "
             "fyldt op (Laporte, Porro, Yamal), så GK hentes fra Argentina "
             "(E. Martínez). Uden Yamal er der plads til spansk GK (Raya) + Saka."),
    "variants": {
        "yamalFit": {"label": "Yamal FIT",
                     "ids": [45, 1086, 1085, 494, 28, 1092, 173, 256, 500, 468, 1573]},
        "yamalOut": {"label": "Yamal UDE",
                     "ids": [1098, 1086, 1085, 494, 28, 173, 256, 469, 500, 468, 1573]},
    },
}


def strip(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "")
                   if not unicodedata.combining(c)).lower().strip()


def load_feed(name):
    """Fetch a feed live; fall back to ./data/<name>.json (and cache live)."""
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


def avail_factor(p, squad_name):
    first = strip(p.get("firstName"))
    last = strip(p.get("lastName"))
    known = strip(p.get("knownName"))
    for rule in AVAILABILITY:
        if rule.get("squad") and rule["squad"] != squad_name:
            continue
        if rule.get("pos") and rule["pos"] != p["position"]:
            continue
        rf = strip(rule.get("first"))
        if rf and rf not in first and rf not in known:
            continue
        rl = strip(rule.get("last"))
        if rl and rl not in last and rl not in known:
            continue
        return rule["factor"], rule["note"]
    return 1.0, None


def expected_games(elo):
    """3 group games + Elo-weighted knockout progression (R32..Final)."""
    p_r32 = 1.0 / (1.0 + math.exp(-(elo - 1765) / 70.0))   # reach the round of 32
    opp = {"R32": 1820, "R16": 1880, "QF": 1955, "SF": 2010, "F": 2055}
    games = 3.0 + p_r32                                    # group + R32 match
    reach = p_r32
    for rnd in ("R32", "R16", "QF", "SF"):
        p_win = 1.0 / (1.0 + 10 ** ((opp[rnd] - elo) / 400.0))
        reach *= p_win                                     # reached next round
        games += reach
    return round(games, 3)


def team_rates(elo):
    gpm = 1.35 * 10 ** ((elo - 1800) / 450.0)
    cpm = 1.35 * 10 ** ((1800 - elo) / 450.0)
    gpm = max(0.45, min(gpm, 3.1))
    cpm = max(0.30, min(cpm, 3.1))
    cs = math.exp(-cpm)
    return gpm, cs


def build():
    print("Loading feeds...", file=sys.stderr)
    players = load_feed("players")
    squads = load_feed("squads")
    load_feed("rounds")  # cache for completeness / future use
    sq = {s["id"]: s for s in squads}

    # selectable pool = currently in a squad
    pool = [p for p in players if p.get("status") == "playing"]

    # group players by (squadId, position) for output distribution
    by_np = {}
    for p in pool:
        by_np.setdefault((p["squadId"], p["position"]), []).append(p)
    for lst in by_np.values():
        lst.sort(key=lambda x: x["price"], reverse=True)

    elo_cache = {sid: ELO.get(s["name"], DEFAULT_ELO) for sid, s in sq.items()}
    games_cache = {sid: expected_games(e) for sid, e in elo_cache.items()}
    rate_cache = {sid: team_rates(e) for sid, e in elo_cache.items()}

    rows = []
    for p in pool:
        sid, pos = p["squadId"], p["position"]
        squad = sq[sid]
        elo = elo_cache[sid]
        gpm, cs = rate_cache[sid]
        peers = by_np[(sid, pos)]
        rank = peers.index(p)

        # output weight within nation+position (stars dominate)
        weights = [x["price"] ** 2.2 for x in peers]
        wsum = sum(weights) or 1.0
        wshare = weights[rank] / wsum

        pstart = START_DECAY.get(pos, [0.5])
        pstart = pstart[rank] if rank < len(pstart) else START_FLOOR
        pstart = max(pstart, START_FLOOR)

        goals = gpm * GOAL_SHARE[pos] * wshare
        assists = gpm * ASSIST_RATE * ASSIST_SHARE[pos] * wshare

        appear_pts = pstart * APPEAR_FULL + (1 - pstart) * APPEAR_SUB
        goal_pts = goals * GOAL_PTS[pos]
        assist_pts = assists * ASSIST_PTS
        cs_pts = cs * CS_PTS[pos] * pstart
        base_pm = appear_pts + goal_pts + assist_pts + cs_pts + CARD_PEN[pos]
        base_pm = max(base_pm, 0.20)

        games = games_cache[sid]
        x_base = base_pm * games

        af, note = avail_factor(p, squad["name"])
        own = p.get("percentSelected") or 0.0
        scouting = base_pm >= 4.0 and own < 5.0
        x = x_base * af + (2.0 if scouting else 0.0)
        x = round(x, 1)
        price = p["price"]

        rows.append({
            "id": p["id"],
            "name": player_name(p),
            "nation": squad["name"],
            "nationAbbr": squad.get("abbr"),
            "group": (squad.get("group") or "").upper(),
            "pos": pos,
            "price": price,
            "ownPct": round(own, 1),
            "elo": elo,
            "expGames": games,
            "startProb": round(pstart, 2),
            "ptsPerMatch": round(base_pm, 2),
            "availFactor": af,
            "injuryNote": note,
            "scouting": scouting,
            "xPts": x,
            "value": round(x / price, 2) if price else 0.0,
        })

    rows.sort(key=lambda r: r["xPts"], reverse=True)
    by_id = {r["id"]: r for r in rows}

    # best value per position (min realistic involvement: a starter-ish role)
    best_value = {}
    for pos in ("GK", "DEF", "MID", "FWD"):
        cand = [r for r in rows if r["pos"] == pos and r["startProb"] >= 0.35
                and r["availFactor"] > 0]
        cand.sort(key=lambda r: r["value"], reverse=True)
        best_value[pos] = cand[:8]

    # resolve recommended XI variants
    rec = {"formation": RECOMMENDED["formation"],
           "captain": by_id.get(RECOMMENDED["captainId"], {}).get("name"),
           "vice": by_id.get(RECOMMENDED["viceId"], {}).get("name"),
           "note": RECOMMENDED["note"], "variants": {}}
    for key, v in RECOMMENDED["variants"].items():
        starters = []
        cost = 0.0
        total = 0.0
        nation_count = {}
        for pid in v["ids"]:
            r = by_id.get(pid)
            if not r:
                print(f"  ! recommended id {pid} not in pool", file=sys.stderr)
                continue
            is_c = pid == RECOMMENDED["captainId"]
            starters.append({**{k: r[k] for k in
                                ("id", "name", "nation", "nationAbbr", "pos",
                                 "price", "xPts", "availFactor", "injuryNote")},
                             "isCaptain": is_c,
                             "isVice": pid == RECOMMENDED["viceId"]})
            cost += r["price"]
            total += r["xPts"] * (2 if is_c else 1)
            nation_count[r["nation"]] = nation_count.get(r["nation"], 0) + 1
        rec["variants"][key] = {
            "label": v["label"],
            "players": starters,
            "cost": round(cost, 1),
            "xPts": round(total, 1),
            "maxPerNation": max(nation_count.values()) if nation_count else 0,
        }

    model = {
        "meta": {
            "league": LEAGUE,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc)
            .isoformat(timespec="seconds"),
            "dataSource": "https://play.fifa.com/json/fantasy/*",
            "budget": BUDGET,
            "squadRules": SQUAD_RULES,
            "eloAsOf": ELO_AS_OF,
            "availabilityAsOf": AVAIL_AS_OF,
            "playerCount": len(rows),
            "method": ("xPts = (point/kamp kalibreret til FIFA-scoring) × forventede "
                       "kampe × tilgængelighed. Holdstyrke fra Elo-snapshot; "
                       "output fordelt på position og prisrang."),
        },
        "players": rows[:120],
        "bestValue": best_value,
        "recommended": rec,
    }
    out = os.path.join(HERE, "model.json")
    with open(out, "w") as f:
        json.dump(model, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out}: {len(rows)} players "
          f"(top {len(model['players'])} embedded).", file=sys.stderr)
    for key, v in rec["variants"].items():
        print(f"  {v['label']}: cost {v['cost']}M, xPts {v['xPts']}, "
              f"max/nation {v['maxPerNation']}", file=sys.stderr)


if __name__ == "__main__":
    build()
