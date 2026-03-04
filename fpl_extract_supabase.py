"""
FPL Draft -> Supabase Extractor
Run after each gameweek to refresh all dashboard data.

Install deps:  pip install requests python-dotenv
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------
# CONFIG
# ---------------------------
LEAGUE_ID    = 56144
TIMEOUT      = 30
API          = "https://draft.premierleague.com/api"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# ---------------------------
# SUPABASE REST HELPERS
# ---------------------------
SB_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
}

def sb_upsert(table, rows, on_conflict):
    if not rows:
        return
    url     = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {**SB_HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}
    for i in range(0, len(rows), 500):
        batch = rows[i:i+500]
        r = requests.post(url, json=batch, headers=headers,
                          params={"on_conflict": on_conflict}, timeout=TIMEOUT)
        if r.status_code not in (200, 201):
            print(f"  ERROR {table}: {r.status_code} {r.text[:200]}")
        else:
            print(f"  Upserted {len(batch)} rows -> {table}")

def sb_delete_all(table):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.delete(url, headers={**SB_HEADERS, "Prefer": "return=minimal"},
                        params={"id": "gte.0"}, timeout=TIMEOUT)
    if r.status_code not in (200, 204):
        print(f"  ERROR clearing {table}: {r.status_code} {r.text[:200]}")

# ---------------------------
# FPL HELPERS
# ---------------------------
def fetch(url):
    """Fetch from FPL API - no auth needed for public endpoints."""
    r = requests.get(url, headers={"User-Agent": "fabric-notebook"}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def fetch_live(gw):
    """Get player points for a specific GW. Returns {player_id: points}."""
    try:
        data     = fetch(f"{API}/event/{gw}/live")
        elements = data.get("elements", [])
        # API sometimes returns a dict instead of a list
        if isinstance(elements, dict):
            elements = elements.values()
        return {
            e["id"]: e.get("stats", {}).get("total_points", 0)
            for e in elements
            if isinstance(e, dict) and "id" in e
        }
    except Exception as exc:
        return {}

# ---------------------------
# FETCH CORE DATA
# ---------------------------
print("Fetching FPL Draft data...")

BOOTSTRAP      = fetch(f"{API}/bootstrap-static")
GAME_META      = fetch(f"{API}/game")
LEAGUE         = fetch(f"{API}/league/{LEAGUE_ID}/details")
ELEMENT_STATUS = fetch(f"{API}/league/{LEAGUE_ID}/element-status")
CHOICES        = fetch(f"{API}/draft/{LEAGUE_ID}/choices")

current_gw     = GAME_META.get("current_event", 1)
elements       = {e["id"]: e for e in BOOTSTRAP["elements"]}
elt_types      = {et["id"]: et for et in BOOTSTRAP["element_types"]}
teams_map      = {t["id"]: t for t in BOOTSTRAP["teams"]}
league_entries = {le["id"]: le for le in LEAGUE["league_entries"]}
standings_list = LEAGUE.get("standings", [])

# Team IDs in standings order
TEAM_IDS = []
for s in standings_list:
    le = league_entries.get(s.get("league_entry"))
    if le and le.get("entry_id"):
        TEAM_IDS.append(le["entry_id"])

print(f"Current GW: {current_gw}  |  Managers: {len(TEAM_IDS)}\n")

# ---------------------------
# 1. CURRENT SQUADS
# ---------------------------
print("Syncing current squads...")
squad_rows = []
for st in ELEMENT_STATUS.get("element_status", []):
    pid, owner = st.get("element"), st.get("owner")
    if not pid or not owner:
        continue
    p  = elements.get(pid, {})
    le = next((e for e in league_entries.values() if e["entry_id"] == owner), None)
    if not le or not p:
        continue
    squad_rows.append({
        "manager_name":    f"{le['player_first_name']} {le['player_last_name']}",
        "team_name":       le["entry_name"],
        "player_id":       pid,
        "player_web_name": p.get("web_name", ""),
        "player_position": elt_types.get(p.get("element_type", 0), {}).get("singular_name", ""),
        "player_team":     teams_map.get(p.get("team", 0), {}).get("name", ""),
        "total_points":    p.get("total_points", 0),
    })

sb_delete_all("fpl_current_squads")
sb_upsert("fpl_current_squads", squad_rows, "manager_name,player_id")

# ---------------------------
# 2. STANDINGS (from league details — no per-GW auth needed)
# ---------------------------
print("\nSyncing overall standings...")
overall_rows = []
for s in standings_list:
    le = league_entries.get(s.get("league_entry"), {})
    overall_rows.append({
        "gameweek":     current_gw,
        "manager_name": f"{le.get('player_first_name','')} {le.get('player_last_name','')}".strip(),
        "team_name":    le.get("entry_name", ""),
        "gw_points":    s.get("event_total", 0),
        "total_points": s.get("total", 0),
    })
sb_upsert("fpl_standings", overall_rows, "gameweek,manager_name")

# ---------------------------
# 3. CURRENT GW LINEUPS + PLAYER POINTS
# ---------------------------
print(f"\nSyncing GW {current_gw} lineups...")
live_pts = fetch_live(current_gw)
print(f"  Live points fetched for {len(live_pts)} players")

lineup_rows = []
for le in league_entries.values():
    entry_id     = le["entry_id"]
    manager_name = f"{le['player_first_name']} {le['player_last_name']}"
    team_name    = le["entry_name"]

    try:
        data = fetch(f"{API}/entry/{entry_id}/event/{current_gw}")
    except Exception as exc:
        print(f"  Skipping {manager_name}: {exc}")
        continue

    for pk in data.get("picks", []):
        pid = pk.get("element")
        pos = pk.get("position", 0)
        p   = elements.get(pid, {})
        lineup_rows.append({
            "gameweek":        current_gw,
            "manager_name":    manager_name,
            "team_name":       team_name,
            "player_id":       pid,
            "player_web_name": p.get("web_name", ""),
            "player_position": elt_types.get(p.get("element_type", 0), {}).get("singular_name", ""),
            "player_team":     teams_map.get(p.get("team", 0), {}).get("name", ""),
            "lineup_position": pos,
            "is_starting_11":  bool(pos and pos <= 11),
            "is_bench":        bool(pos and pos > 11),
            "gw_points":       live_pts.get(pid, 0),
        })

sb_upsert("fpl_starting_lineups", lineup_rows, "gameweek,manager_name,player_id")

# ---------------------------
# 4. DRAFT PICKS (one-time, but re-synced each run)
# ---------------------------
print("\nSyncing draft picks...")
draft_rows = []
choices_list = CHOICES.get("choices", [])
for i, choice in enumerate(choices_list, 1):
    pid      = choice.get("element")
    p        = elements.get(pid, {})
    le       = league_entries.get(choice.get("entry"), {})
    round_n  = ((i - 1) // len(TEAM_IDS)) + 1 if TEAM_IDS else 1
    pick_n   = ((i - 1) % len(TEAM_IDS)) + 1  if TEAM_IDS else 1
    draft_rows.append({
        "pick_number":      i,
        "round":            round_n,
        "pick_in_round":    pick_n,
        "manager_name":     f"{le.get('player_first_name','')} {le.get('player_last_name','')}".strip(),
        "team_name":        le.get("entry_name", ""),
        "player_id":        pid,
        "player_web_name":  p.get("web_name", ""),
        "player_position":  elt_types.get(p.get("element_type", 0), {}).get("singular_name", ""),
        "player_team":      teams_map.get(p.get("team", 0), {}).get("name", ""),
        "total_points":     p.get("total_points", 0),
    })

try:
    sb_upsert("fpl_draft_picks", draft_rows, "pick_number")
except Exception:
    print("  (fpl_draft_picks table not found — run SQL setup to enable)")

print("\nDone! All data is in Supabase.")
print(f"  Squads:    {len(squad_rows)} players")
print(f"  Standings: {len(overall_rows)} managers")
print(f"  Lineups:   {len(lineup_rows)} picks (GW{current_gw})")
print(f"  Draft:     {len(draft_rows)} picks")
