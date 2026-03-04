"""
FPL Draft → Supabase Extractor
Run after each gameweek to refresh all dashboard data.

Install deps:  pip install requests supabase python-dotenv
Credentials:   copy .env.example to .env and fill in values
"""

import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ---------------------------
# CONFIG
# ---------------------------
LEAGUE_ID   = 56144
USER_EMAIL  = os.getenv("FPL_EMAIL", "")
USER_PASSWD = os.getenv("FPL_PASSWORD", "")
TIMEOUT     = 30
API         = "https://draft.premierleague.com/api"

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://qswejhdkgwpomklndqws.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # Service role key for writes

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------------------------
# HELPERS
# ---------------------------
def fetch(url, session=None):
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    req = session if session else requests
    r = req.get(url, headers=headers, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def authenticate():
    login_url = "https://users.premierleague.com/accounts/login/"
    s = requests.Session()
    data = {
        "login": USER_EMAIL, "password": USER_PASSWD,
        "app": "plfpl-web", "redirect_uri": "https://fantasy.premierleague.com/"
    }
    r = s.post(login_url, headers={"User-Agent": "Mozilla/5.0"}, data=data, timeout=TIMEOUT)
    r.raise_for_status()
    return s

def upsert(table, rows, conflict_cols):
    if not rows:
        return
    supabase.table(table).upsert(rows, on_conflict=conflict_cols).execute()
    print(f"  Upserted {len(rows)} rows → {table}")

# ---------------------------
# MAIN
# ---------------------------
print("Authenticating...")
session = authenticate()
print("OK\n")

BOOTSTRAP     = fetch(f"{API}/bootstrap-static", session)
GAME_META     = fetch(f"{API}/game", session)
LEAGUE        = fetch(f"{API}/league/{LEAGUE_ID}/details", session)
ELEMENT_STATUS = fetch(f"{API}/league/{LEAGUE_ID}/element-status", session)

current_gw     = GAME_META.get("current_event", 1)
elements       = {e["id"]: e for e in BOOTSTRAP["elements"]}
elt_types      = {et["id"]: et for et in BOOTSTRAP["element_types"]}
teams_map      = {t["id"]: t for t in BOOTSTRAP["teams"]}
league_entries = LEAGUE["league_entries"]

print(f"Current GW: {current_gw}\n")

# ---- Current Squads -----------------------------------------------
print("Syncing squads...")
squad_rows = []
for st in ELEMENT_STATUS["element_status"]:
    pid, owner = st["element"], st["owner"]
    if not pid or not owner:
        continue
    p  = elements[pid]
    le = next((e for e in league_entries if e["entry_id"] == owner), None)
    if not le:
        continue
    squad_rows.append({
        "manager_name":    f"{le['player_first_name']} {le['player_last_name']}",
        "team_name":       le["entry_name"],
        "player_id":       pid,
        "player_web_name": p["web_name"],
        "player_position": elt_types[p["element_type"]]["singular_name"],
        "player_team":     teams_map[p["team"]]["name"],
        "total_points":    p["total_points"],
    })

# Wipe and re-insert (handles ownership changes from trades)
supabase.table("fpl_current_squads").delete().gte("id", 1).execute()
upsert("fpl_current_squads", squad_rows, "manager_name,player_id")

# ---- Standings + Lineups per GW -----------------------------------
for gw in range(1, current_gw + 1):
    print(f"Fetching GW {gw}...")

    # Live player points for this GW
    live_pts = {}
    try:
        live_data = fetch(f"{API}/event/{gw}/live", session)
        live_pts  = {
            e["id"]: e.get("stats", {}).get("total_points", 0)
            for e in live_data.get("elements", [])
        }
    except Exception as exc:
        print(f"  (no live data: {exc})")

    gw_standings = []
    gw_lineups   = []

    for le in league_entries:
        entry_id     = le["entry_id"]
        manager_name = f"{le['player_first_name']} {le['player_last_name']}"
        team_name    = le["entry_name"]

        try:
            resp = session.get(
                f"{API}/entry/{entry_id}/event/{gw}",
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            print(f"  Error {manager_name} GW{gw}: {exc}")
            continue

        picks         = data.get("picks", [])
        entry_history = data.get("entry_history", {})

        gw_standings.append({
            "gameweek":     gw,
            "manager_name": manager_name,
            "team_name":    team_name,
            "gw_points":    entry_history.get("points", 0),
            "total_points": entry_history.get("total_points", 0),
        })

        for pk in picks:
            pid = pk.get("element")
            pos = pk.get("position", 0)
            p   = elements.get(pid, {})
            gw_lineups.append({
                "gameweek":        gw,
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

    upsert("fpl_standings",        gw_standings, "gameweek,manager_name")
    upsert("fpl_starting_lineups", gw_lineups,   "gameweek,manager_name,player_id")

print("\nDone!")
