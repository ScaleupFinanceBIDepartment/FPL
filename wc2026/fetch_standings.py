#!/usr/bin/env python3
"""Fetch the SuF league standings from FIFA and write standings.json.

The league ranking endpoint requires authentication (cookie-based, via Ping
OIDC on auth.fifa.com -- NOT a Bearer header). Two strategies, in order:

  1. FIFA_COOKIE  (RECOMMENDED / most robust)
       A full Cookie header string captured from a logged-in bot session.
       Set as a GitHub Secret; refresh ~weekly. Survives captcha/bot defenses
       because no automated login is attempted.

  2. FIFA_EMAIL + FIFA_PASSWORD  (fallback, headless Playwright login)
       Logs the bot account in via auth.fifa.com and reuses the session
       cookies. May be blocked by Ping Identity bot protection / captcha.

If both are absent or fail, a "pending" placeholder is written (and any
previously fetched entries are preserved) so the dashboard degrades cleanly.

Env:
  FIFA_LEAGUE_ID  (default 128462)
  FIFA_COOKIE     full Cookie header, e.g. "ping_at=...; PA.fifa=...; ..."
  FIFA_EMAIL / FIFA_PASSWORD
Usage:  python3 fetch_standings.py
"""
import os
import sys
import json
import datetime
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "standings.json")
LEAGUE_ID = os.environ.get("FIFA_LEAGUE_ID", "128462")
API = f"https://play.fifa.com/api/en/fantasy/ranking/league/{LEAGUE_ID}"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def load_existing():
    try:
        with open(OUT) as f:
            return json.load(f)
    except Exception:  # noqa: BLE001
        return {}


def write(status, message, entries=None, raw=None):
    prev = load_existing()
    if entries is None:                      # preserve last good data on failure
        entries = prev.get("entries", [])
    doc = {
        "league": {"id": int(LEAGUE_ID), "name": "SuF"},
        "fetchedAt": now() if entries or status == "ok" else prev.get("fetchedAt"),
        "status": status,
        "message": message,
        "entries": entries,
    }
    if raw is not None:
        doc["raw"] = raw                     # keep payload to refine mapping later
    with open(OUT, "w") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"[standings] {status}: {message} ({len(entries)} entries) -> {OUT}")


def _pick(d, *keys, default=None):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


def normalize(payload):
    """Best-effort mapping of FIFA's ranking payload into a flat list.

    The exact shape is unknown until we get a 200 from the bot account, so we
    search common container keys and field aliases, and keep the raw payload.
    """
    container = payload
    if isinstance(payload, dict):
        for key in ("rankings", "ranking", "entries", "results", "members",
                    "standings", "data", "items", "leaderboard"):
            v = payload.get(key)
            if isinstance(v, list):
                container = v
                break
            if isinstance(v, dict):
                for k2 in ("entries", "results", "items", "members"):
                    if isinstance(v.get(k2), list):
                        container = v[k2]
                        break
    if not isinstance(container, list):
        return []
    out = []
    for i, e in enumerate(container, 1):
        if not isinstance(e, dict):
            continue
        out.append({
            "rank": _pick(e, "rank", "position", "rankCurrent", "currentRank", default=i),
            "managerName": _pick(e, "managerName", "userName", "fullName",
                                 "displayName", "name", "user", default="—"),
            "teamName": _pick(e, "teamName", "entryName", "squadName",
                              "fantasyTeamName", "team", default=""),
            "points": _pick(e, "points", "totalPoints", "score", "totalScore",
                            "overallPoints"),
            "lastRoundPoints": _pick(e, "lastRoundPoints", "roundPoints",
                                     "eventPoints", "gameweekPoints"),
        })
    out.sort(key=lambda r: (r["rank"] if isinstance(r["rank"], int) else 1e9))
    return out


def http_get(cookie):
    req = urllib.request.Request(API, headers={
        "Cookie": cookie, "User-Agent": UA, "Accept": "application/json",
        "Referer": "https://play.fifa.com/", "Origin": "https://play.fifa.com",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def via_cookie(cookie):
    print("[standings] trying FIFA_COOKIE …")
    return http_get(cookie)


def via_playwright(email, password):
    """Headless login fallback. Requires `pip install playwright` + browsers."""
    print("[standings] trying Playwright login …")
    from playwright.sync_api import sync_playwright  # lazy import
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(user_agent=UA)
        page = ctx.new_page()
        page.goto("https://play.fifa.com/", wait_until="networkidle", timeout=60000)
        # Trigger login -> redirected to auth.fifa.com (Ping)
        try:
            page.get_by_role("link", name="Log in").click(timeout=8000)
        except Exception:  # noqa: BLE001
            page.goto("https://play.fifa.com/auth/login", timeout=60000)
        page.wait_for_url("**auth.fifa.com/**", timeout=30000)
        page.fill("input[type=email], input[name=email], #username", email)
        page.fill("input[type=password], input[name=password], #password", password)
        page.keyboard.press("Enter")
        page.wait_for_url("**play.fifa.com/**", timeout=45000)
        resp = ctx.request.get(API, headers={"Accept": "application/json"})
        data = resp.json()
        browser.close()
        if resp.status != 200:
            raise RuntimeError(f"API returned HTTP {resp.status} after login")
        return data


def main():
    cookie = os.environ.get("FIFA_COOKIE", "").strip()
    email = os.environ.get("FIFA_EMAIL", "").strip()
    password = os.environ.get("FIFA_PASSWORD", "").strip()

    payload, err = None, None
    if cookie:
        try:
            payload = via_cookie(cookie)
        except urllib.error.HTTPError as e:
            err = f"cookie auth HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            err = f"cookie auth failed: {e}"
    if payload is None and email and password:
        try:
            payload = via_playwright(email, password)
        except Exception as e:  # noqa: BLE001
            err = f"playwright login failed: {e}"
    if payload is None and not cookie and not email:
        write("pending",
              "Ingen credentials sat (FIFA_COOKIE eller FIFA_EMAIL/FIFA_PASSWORD). "
              "Botten skal meldes ind i ligaen (kode 2SPXEBAF) før der er data.")
        return 0

    if payload is None:
        write("error", f"Kunne ikke hente stilling: {err}. "
              "Forny FIFA_COOKIE eller tjek bot-login.")
        return 1

    entries = normalize(payload)
    raw = payload if not entries else None   # only keep raw while mapping is unproven
    write("ok",
          "Stilling hentet." if entries else
          "200 OK men ingen rækker endnu (turneringen er ikke startet).",
          entries=entries, raw=raw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
