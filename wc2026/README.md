# FIFA World Cup 2026 — Fantasy dashboard (SuF)

Et statisk dashboard til Fantasy-ligaen **"SuF"** (liga-ID `128462`, join-kode
`2SPXEBAF`). Kører som ren HTML/JS (ingen build) og kan serveres via GitHub
Pages. Stilling og statistik opdateres automatisk af en GitHub Actions-cron.

> Ligger i `wc2026/`-undermappen, adskilt fra repoets eksisterende Fantasy
> Premier League Draft-projekt (`fpl-dashboard/`).

## Hvad viser det

- **Ligastilling** for SuF (hentes af bot-kontoen).
- **Statistik / leaderboards**: topscorere, topassists, flest point, flest
  clean sheets, mest valgte spillere.

## Indhold

| Fil | Hvad |
|-----|------|
| `index.html` | Dashboardet. Henter `stats.json` + `standings.json` (relative stier). |
| `build_stats.py` | Bygger `stats.json` (leaderboards) fra FIFAs offentlige feeds. Ingen login. |
| `stats.json` | Genererede leaderboards. |
| `fetch_standings.py` | Henter ligastillingen (kræver bot-login) og skriver `standings.json`. |
| `standings.json` | Stillingsdata (`pending` indtil bot-kontoen og kampene er klar). |
| `../.github/workflows/wc2026-standings.yml` | Cron (hver 3. time) + manuel; bygger stats og committer begge filer. |

## Kør lokalt

```bash
cd wc2026
python3 build_stats.py          # henter live-feeds, skriver stats.json
python3 -m http.server 8000     # åbn http://localhost:8000/
```

`build_stats.py --offline` bruger cachede feeds i `data/` (kræver en tidligere
online-kørsel; `data/` er git-ignored).

## Datakilder

Offentlige, CORS-åbne feeds (ingen login):

- `players.json` — navne, nation, position, ejerskab, fantasy-point
  (`stats.totalPoints/avgPoints/form`). Altid koblet på navn.
- `player_stats.json` — mål, assists, clean sheets m.m., **kun nøglet på FIFAs
  person-id** og koblet til spillere via `players.json`-feltet `fifaId`.

> ⚠️ **Vigtigt før turneringen:** `fifaId` er `null` for alle spillere indtil
> FIFA udfylder kampdata. Derfor er **topscorere / assists / clean sheets tomme
> indtil kampene starter (11. juni 2026)** — præcis som stillingen. **Point** og
> **mest valgte** kommer fra `players.json` og virker uafhængigt af denne join.
> `stats.json.meta.statsJoin` rapporterer hvor mange spillere der er koblet.

## Stilling / auth

Ligastillingen kræver login (cookie-baseret via Ping OIDC på `auth.fifa.com` —
ikke en Bearer-header). Brug en **dedikeret bot-FIFA-konto**, meldt ind i ligaen
med koden `2SPXEBAF`. Login gemmes som **GitHub Secrets** (Settings → Secrets
and variables → Actions):

| Secret | Rolle |
|--------|-------|
| `FIFA_COOKIE` | **Anbefalet / mest robust.** Fuld Cookie-header fra en logget-ind bot-session. Fornyes ~ugentligt. |
| `FIFA_EMAIL` + `FIFA_PASSWORD` | Fallback: headless Playwright-login (kan blokeres af Ping captcha/bot-beskyttelse). |

**Robusthed:** FIFAs Ping Identity-login har realistisk captcha/bot-beskyttelse
mod headless-login. Den mest robuste løsning er `FIFA_COOKIE` som primær kilde
(ugentlig fornyelse), med `FIFA_EMAIL`/`FIFA_PASSWORD` som backup. Playwright
installeres kun i workflowet, hvis `FIFA_EMAIL` er sat.

`fetch_standings.py` falder pænt tilbage: uden credentials skrives `pending`,
ved auth-fejl skrives `error` (og tidligere rækker bevares). Indtil vi ser et
ægte 200-svar gemmes payloaden som `raw`, så feltnavnene i `normalize()` kan
finjusteres.

## GitHub Pages

Slå Pages til under **Settings → Pages → Source: Deploy from a branch →
`main` / root**. Dashboardet bliver tilgængeligt på
`https://<org>.github.io/FPL/wc2026/`. (Pages-indstillingen er en repo-setting,
der ikke kan sættes via en commit — slå den til i UI'et efter merge til `main`.)
