# FIFA World Cup 2026 — Fantasy dashboard (SuF)

Et statisk dashboard til Fantasy-ligaen **"SuF"** (liga-ID `128462`, join-kode
`2SPXEBAF`). Kører som ren HTML/JS (ingen build) og kan serveres via GitHub
Pages. Stillingen hentes automatisk af en GitHub Actions-cron.

> Bemærk: Dette ligger i `wc2026/`-undermappen, adskilt fra repoets
> eksisterende Fantasy Premier League Draft-projekt (`fpl-dashboard/`).

## Indhold

| Fil | Hvad |
|-----|------|
| `index.html` | Dashboardet. Henter `model.json` + `standings.json` (relative stier). Viser ligastilling, anbefalet hold med **Yamal FIT/UDE**-toggle, bedste værdi pr. position og en søgbar spillermodel. |
| `model.json` | Genereret spiller-model (top-120 + bedste værdi pr. position + anbefalet XI). |
| `build_model.py` | Genererer `model.json` fra FIFAs offentlige feeds + xPts-modellen. Reproducerbar. |
| `fetch_standings.py` | Henter ligastillingen (kræver bot-login) og skriver `standings.json`. |
| `standings.json` | Stillingsdata (starter som `pending` indtil bot-kontoen og kampene er klar). |
| `../.github/workflows/wc2026-standings.yml` | Cron (hver 3. time) + manuel kørsel; committer `standings.json`. |

## Kør lokalt

```bash
cd wc2026
python3 build_model.py          # henter live-feeds, skriver model.json
python3 -m http.server 8000     # åbn http://localhost:8000/
```

`build_model.py --offline` bruger cachede feeds i `data/` (kræver en tidligere
online-kørsel; `data/` er git-ignored).

## Modellen kort

`xPts = (point/kamp kalibreret til FIFA-scoring) × forventede kampe × tilgængelighed`

- **Holdstyrke**: Elo-snapshot (`ELO` i `build_model.py`, opdater fra
  eloratings.net). `mål/kamp = 1.35·10^((Elo−1800)/450)`, indkasserede
  symmetrisk, clean sheet = `exp(−indkass.)`.
- **Forventede kampe**: 3 gruppekampe + Elo-vægtet knockout (R32→finale).
- **Output** fordeles på position og prisrang i nationen (stjerner bærer mest);
  prisrang driver også start-sandsynligheden.
- **Scoring**: mål GK9/DEF7/MID6/FWD5, assist 3, clean sheet GK/DEF 5 / MID 1,
  fremmøde ~2, små kort/straffe, scouting-bonus +2 (≥4 pt/kamp og <5% ejerskab).
- **Tilgængelighed** (`AVAILABILITY`, pr. 2026-06-05): Yamal 0.65, C. Romero
  0.88, Mbappé 0.96, Saliba 0.55, L. Martínez 0.65, Molina/Montiel 0.78,
  Rodrygo/Xavi Simons 0.5, Neymar 0.

> Tallene er et **bedste estimat** kalibreret til metoden — ikke en garanti.
> Juster konstanterne øverst i `build_model.py` efter behov.

### Anbefalet hold (4-3-3, kaptajn Mbappé ×2, vice Kane)

- **Yamal FIT** — GK E. Martínez; DEF Laporte, Porro, Upamecano, Romero; MID Yamal, Vinícius, Luis Díaz; FWD Mbappé (C), Kane, Ronaldo
- **Yamal UDE** — GK Raya; DEF Laporte, Porro, Upamecano, Romero; MID Vinícius, Luis Díaz, Saka; FWD Mbappé (C), Kane, Ronaldo

GK skifter pga. Spaniens 3-spiller-loft når Yamal byttes ind/ud. Begge XI'er
holder budget ($100M) og max 3/nation (verificeret af `build_model.py`).

## Stilling / auth

Ligastillingen kræver login (cookie-baseret via Ping OIDC på `auth.fifa.com` —
ikke en Bearer-header). Brug en **dedikeret bot-FIFA-konto**, meldt ind i ligaen
med koden `2SPXEBAF`. Login gemmes som **GitHub Secrets** (Settings → Secrets
and variables → Actions):

| Secret | Rolle |
|--------|-------|
| `FIFA_COOKIE` | **Anbefalet / mest robust.** Fuld Cookie-header fra en logget-ind bot-session. Fornyes ~ugentligt. |
| `FIFA_EMAIL` + `FIFA_PASSWORD` | Fallback: headless Playwright-login (kan blokeres af Ping captcha/bot-beskyttelse). |

**Anbefaling om robusthed:** FIFAs Ping Identity-login har realistisk
captcha/bot-beskyttelse mod headless-login. Den mest robuste løsning er derfor
`FIFA_COOKIE` som primær kilde (ugentlig fornyelse), med
`FIFA_EMAIL`/`FIFA_PASSWORD` som backup. Playwright-stien installeres kun i
workflowet, hvis `FIFA_EMAIL` er sat.

`fetch_standings.py` falder pænt tilbage: uden credentials skrives `pending`,
ved auth-fejl skrives `error` (og tidligere rækker bevares). Indtil vi ser et
ægte 200-svar gemmes payloaden i `standings.json` som `raw`, så feltnavnene i
`normalize()` kan finjusteres.

## GitHub Pages

Slå Pages til under **Settings → Pages → Source: Deploy from a branch →
`main` / root**. Dashboardet bliver så tilgængeligt på
`https://<org>.github.io/FPL/wc2026/`. (Pages-indstillingen er en repo-setting,
der ikke kan sættes via en commit — slå den til i UI'et efter merge til `main`.)
