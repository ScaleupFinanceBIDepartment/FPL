/* ============================================================
   FPL DRAFT TERMINAL — data layer  →  window.TD
   Deterministic generated universe so the UI is rich + stable.
   ============================================================ */
(function () {
  function rng(seed) {
    let h = 2166136261
    for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
    return () => { h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  }
  const ri = (r, a, b) => Math.floor(a + r() * (b - a + 1))

  /* shared helpers (used by both the live + generated data paths) */
  const fmtSign = n => (n > 0 ? '+' + n : '' + n)
  function spark(data, w, h) {
    const max = Math.max(...data), min = Math.min(...data), rngv = max - min || 1
    const step = w / (data.length - 1)
    const pts = data.map((v, i) => [i * step, h - ((v - min) / rngv) * (h - 3) - 1.5])
    return { line: pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), pts, max, min }
  }

  /* Prefer the real baked league data (terminal/data.json, same-origin so no
     CORS) produced by build_data.py from the FPL Draft API. Fall back to the
     generated sample universe below if it's missing (e.g. opened standalone). */
  try {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'data.json?t=' + Date.now(), false)
    xhr.send()
    if (xhr.status === 200) {
      const live = JSON.parse(xhr.responseText)
      if (live && Array.isArray(live.players) && live.players.length) {
        window.TD = Object.assign(live, { fmtSign, spark })
        return
      }
    }
  } catch (e) { /* fall back to generated universe */ }

  const MANAGERS = [
    { team: 'Penalty Box',     mgr: 'Maria Lund' },
    { team: 'Hand of God',     mgr: 'Emil Vinther' },
    { team: 'Klopp Watch',     mgr: 'Anders Krogh' },
    { team: 'Expected Goals',  mgr: 'Tobias Riis' },
    { team: 'Bench Warmers',   mgr: 'Sofie Holm' },
    { team: 'The Invincibles', mgr: 'Mikkel Bach' },
  ]

  /* name pools [web_name, club] — sized to fill 6×15 squads + free agents */
  const POOL = {
    GK: [
      ['Raya','ARS'],['Sánchez','CHE'],['Pickford','EVE'],['Pope','NEW'],['Sels','NFO'],['Flekken','BRE'],
      ['Vicario','TOT'],['Onana','MUN'],['Areola','WHU'],['E.Martínez','AVL'],['Verbruggen','BHA'],['Henderson','CRY'],
      ['Petrović','BOU'],['Fabianski','WHU'],['Kelleher','LIV'],['Ortega','MCI'],
    ],
    DEF: [
      ['Saliba','ARS'],['Gabriel','ARS'],['White','ARS'],['Timber','ARS'],['Calafiori','ARS'],
      ['Trippier','NEW'],['Burn','NEW'],['Hall','NEW'],['Schär','NEW'],['Livramento','NEW'],
      ['Van Dijk','LIV'],['Konaté','LIV'],['Robertson','LIV'],['Bradley','LIV'],['Gomez','LIV'],
      ['Gvardiol','MCI'],['Aké','MCI'],['Dias','MCI'],['Stones','MCI'],['Walker','MCI'],
      ['Colwill','CHE'],['James','CHE'],['Cucurella','CHE'],['Fofana','CHE'],['Gusto','CHE'],
      ['Murillo','NFO'],['Milenković','NFO'],['Aina','NFO'],['Pinnock','BRE'],['Collins','BRE'],
      ['Mings','AVL'],['Konsa','AVL'],['Cash','AVL'],['Dunk','BHA'],['Veltman','BHA'],
      ['Andersen','CRY'],['Mitchell','CRY'],['Tarkowski','EVE'],
    ],
    MID: [
      ['Saka','ARS'],['Rice','ARS'],['Ødegaard','ARS'],['Merino','ARS'],['Madueke','ARS'],
      ['Palmer','CHE'],['Caicedo','CHE'],['Fernández','CHE'],['Neto','CHE'],['Sancho','CHE'],
      ['Salah','LIV'],['Mac Allister','LIV'],['Szoboszlai','LIV'],['Gakpo','LIV'],['Jones','LIV'],
      ['Foden','MCI'],['B.Silva','MCI'],['Savinho','MCI'],['Kovačić','MCI'],['Doku','MCI'],
      ['Gordon','NEW'],['Guimarães','NEW'],['Joelinton','NEW'],['Barnes','NEW'],['Murphy','NEW'],
      ['Mbeumo','BRE'],['Wissa','BRE'],['Eze','CRY'],['Mateta','CRY'],['Sarr','CRY'],
      ['McGinn','AVL'],['Rogers','AVL'],['Tielemans','AVL'],['Mitoma','BHA'],['Gross','BHA'],
      ['Smith Rowe','FUL'],['Iwobi','FUL'],['Anderson','NFO'],
    ],
    FWD: [
      ['Haaland','MCI'],['Isak','NEW'],['Watkins','AVL'],['Wood','NFO'],['Solanke','TOT'],['Cunha','WOL'],
      ['Havertz','ARS'],['Jesus','ARS'],['N.Jackson','CHE'],['Delap','IPS'],['Awoniyi','NFO'],['Welbeck','BHA'],
      ['João Pedro','BHA'],['Strand Larsen','WOL'],['Evanilson','BOU'],['Beto','EVE'],['Füllkrug','WHU'],['Bowen','WHU'],
      ['Raúl','FUL'],['Muniz','FUL'],['Chris Wood','NFO'],['Nketiah','CRY'],['Toney','BRE'],['Calvert-Lewin','EVE'],
    ],
  }

  const SLOTS = { GK: 2, DEF: 5, MID: 5, FWD: 3 }
  const ELITE = new Set(['Salah','Haaland','Palmer','Saka','Isak','Mbeumo','Foden','Ødegaard','Watkins','Cole Palmer','Son','Gordon','Saliba','Van Dijk','Wood'])

  /* build player universe with stats */
  let PID = 1
  const players = []
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    POOL[pos].forEach(([name, club]) => {
      const r = rng(name + pos)
      const elite = ELITE.has(name)
      const tier = elite ? 1 : (r() > 0.55 ? 2 : 3)               // 1 best
      const mins = ri(r, tier === 1 ? 620 : 380, 720)
      let g = 0, a = 0
      if (pos === 'FWD') { g = ri(r, tier === 1 ? 7 : 1, tier === 1 ? 13 : 6); a = ri(r, 0, 4) }
      else if (pos === 'MID') { g = ri(r, tier === 1 ? 4 : 0, tier === 1 ? 10 : 5); a = ri(r, tier === 1 ? 4 : 0, 9) }
      else if (pos === 'DEF') { g = ri(r, 0, tier === 1 ? 3 : 1); a = ri(r, 0, tier === 1 ? 4 : 2) }
      else { g = 0; a = ri(r, 0, 1) }
      const cs = (pos === 'DEF' || pos === 'GK') ? ri(r, tier === 1 ? 3 : 0, 5) : 0
      const saves = pos === 'GK' ? ri(r, 14, 38) : 0
      const bonus = ri(r, tier === 1 ? 6 : 0, tier === 1 ? 16 : 8)
      const base = pos === 'GK' ? cs * 4 + Math.floor(saves / 3) + ri(r, 8, 20)
        : pos === 'DEF' ? g * 6 + a * 3 + cs * 4 + ri(r, 6, 22)
        : pos === 'MID' ? g * 5 + a * 3 + ri(r, 8, 26)
        : g * 4 + a * 3 + ri(r, 8, 24)
      const form = Array.from({ length: 6 }, () => {
        let v = ri(r, 1, tier === 1 ? 9 : 6); if (r() > 0.85) v += ri(r, 5, 9); return v
      })
      // season total must stay consistent with per-GW form (8-GW season ≥ sum of last 6 + the 2 earlier weeks)
      const sumForm = form.reduce((s, v) => s + v, 0)
      const ptsRaw = base + bonus + (tier === 1 ? ri(r, 10, 22) : 0)
      const pts = Math.max(ptsRaw, sumForm + ri(r, 4, 16))
      const xg = +(g * (0.78 + r() * 0.5)).toFixed(1)
      const xa = +(a * (0.7 + r() * 0.6)).toFixed(1)
      const own = +(elite ? 60 + r() * 38 : 6 + r() * 55).toFixed(1)
      players.push({
        id: PID++, name, club, pos, pts, g, a, xg, xa, cs, saves, bonus, mins,
        own, form, gw: form[5], owner: null, status: r() > 0.92 ? (r() > 0.5 ? 'inj' : 'doubt') : 'ok',
        price: +((tier === 1 ? 7.5 : tier === 2 ? 5.5 : 4.3) + r() * 4).toFixed(1),
      })
    })
  }
  players.sort((a, b) => b.pts - a.pts)
  players.forEach((p, i) => p.rank = i + 1)

  /* snake draft → assign 15 to each manager (2/5/5/3) */
  const byPos = pos => players.filter(p => p.pos === pos && !p.owner)
  const order = [0, 1, 2, 3, 4, 5]
  for (const pos of ['MID', 'FWD', 'DEF', 'GK']) {           // draft attackers first
    for (let round = 0; round < SLOTS[pos]; round++) {
      const seq = round % 2 ? [...order].reverse() : order
      for (const m of seq) {
        const avail = byPos(pos).sort((a, b) => b.pts - a.pts)
        if (avail.length) avail[0].owner = MANAGERS[m].team
      }
    }
  }

  /* lineups: top points start; mark starters by formation 1-4-4-2 */
  MANAGERS.forEach(M => {
    const squad = players.filter(p => p.owner === M.team)
    const pick = (pos, n) => squad.filter(p => p.pos === pos).sort((a, b) => b.gw - a.gw).slice(0, n).map(p => p.id)
    const starters = new Set([...pick('GK', 1), ...pick('DEF', 4), ...pick('MID', 4), ...pick('FWD', 2)])
    squad.forEach(p => p.starter = starters.has(p.id))
    M.squad = squad
    M.gw = squad.filter(p => p.starter).reduce((s, p) => s + p.gw, 0)
  })

  /* standings + 8-GW history */
  const standings = MANAGERS.map(M => {
    const r = rng('std' + M.team)
    const strength = M.squad.reduce((s, p) => s + p.pts, 0)
    const hist = []
    let total = 0
    for (let gw = 1; gw <= 8; gw++) {
      const pts = gw === 8 ? M.gw : Math.round((strength / 15) * (0.7 + r() * 0.7))
      total += pts; hist.push({ gw, pts, total })
    }
    return { ...M, total, hist, gwPts: M.gw, form: hist.slice(-6).map(h => h.pts) }
  }).sort((a, b) => b.total - a.total)
  standings.forEach((s, i) => s.rank = i + 1)

  /* movers (biggest form swings) */
  const movers = [...players].map(p => ({ ...p, delta: p.form[5] - p.form[0] }))
  const risers = [...movers].sort((a, b) => b.delta - a.delta).slice(0, 6)
  const fallers = [...movers].sort((a, b) => a.delta - b.delta).slice(0, 6)

  window.TD = {
    gw: 8, players, managers: MANAGERS, standings, risers, fallers,
    clubs: [...new Set(players.map(p => p.club))].sort(),
    fmtSign, spark,
  }
})()
