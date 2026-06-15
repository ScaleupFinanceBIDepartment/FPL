/* ============================================================
   FPL DRAFT TERMINAL — app
   ============================================================ */
const { useState, useEffect, useMemo, useRef } = React
const TD = window.TD

/* ---------- small components ---------- */
function FormBars({ data, h = 40 }) {
  const max = Math.max(...data, 1)
  return (
    <div className="formbars" style={{ height: h }}>
      {data.map((v, i) => <i key={i} className={i === data.length - 1 ? 'last' : ''} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} title={`GW${TD.gw - data.length + 1 + i}: ${v}`}></i>)}
    </div>
  )
}
function Pos({ p }) { return <span className={'pos ' + p}>{p}</span> }
function Status({ s }) {
  if (s === 'inj') return <span className="stbadge st-inj">INJ</span>
  if (s === 'doubt') return <span className="stbadge st-doubt">75%</span>
  return null
}
function Spark({ data, w = 400, h = 90, stroke = '#60DEC8' }) {
  const s = TD.spark(data, w, h)
  const area = s.line + ` L${w} ${h} L0 ${h} Z`
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stroke} stopOpacity="0.28" /><stop offset="1" stopColor={stroke} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#sg)" />
      <path d={s.line} fill="none" stroke={stroke} strokeWidth="2" />
      {s.pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={i === s.pts.length - 1 ? '#F2B33D' : stroke} />)}
    </svg>
  )
}

/* ---------- status bar ---------- */
function StatusBar() {
  const [clock, setClock] = useState('')
  useEffect(() => {
    const t = () => setClock(new Date().toLocaleTimeString('en-GB'))
    t(); const id = setInterval(t, 1000); return () => clearInterval(id)
  }, [])
  const tick = TD.risers.slice(0, 4).map(p => `${p.name.toUpperCase()} ${TD.fmtSign(p.delta)}`)
    .concat(TD.fallers.slice(0, 2).map(p => `${p.name.toUpperCase()} ${TD.fmtSign(p.delta)}`))
  return (
    <div className="statusbar">
      <span className="sb-brand">FPL://<b>DRAFT.TERMINAL</b></span>
      <span className="sb-seg">GW <b>{TD.gw}</b>/38</span>
      <span className="sb-live"><span className="dotpulse"></span>LIVE</span>
      <span className="sb-seg">SEASON <b>25/26</b></span>
      <span className="sb-ticker">
        {tick.map((t, i) => {
          const up = t.includes('+')
          return <span key={i}><span className={up ? 'up' : 'dn'}>{t} {up ? '▲' : '▼'}</span><span className="sep">·</span></span>
        })}
      </span>
      <span className="sb-clock">{clock}</span>
    </div>
  )
}

/* ---------- nav rail ---------- */
const VIEWS = [
  { id: 'league',  key: 'F1', label: 'LEAGUE',  desc: 'standings' },
  { id: 'players', key: 'F2', label: 'PLAYERS', desc: 'index' },
  { id: 'squads',  key: 'F3', label: 'SQUADS',  desc: 'rosters' },
]
function Rail({ view, setView, myTeam }) {
  const me = TD.standings.find(s => s.team === myTeam)
  return (
    <div className="rail">
      <div className="rail-h">Views</div>
      {VIEWS.map(v => (
        <div key={v.id} className={'navitem' + (view === v.id ? ' on' : '')} onClick={() => setView(v.id)}>
          <span className="k">{v.key}</span><span className="lbl">{v.label}</span>
          <span className="cnt">{v.id === 'players' ? TD.players.length : v.id === 'squads' ? TD.managers.length : ''}</span>
        </div>
      ))}
      <div className="rail-h">Watching</div>
      <div className="rail-stat" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
        <div className="row"><span>{me.team}</span><b>#{me.rank}</b></div>
        <div className="row"><span>total</span><b>{me.total}</b></div>
        <div className="row"><span>gw{TD.gw}</span><b>{me.gwPts}</b></div>
      </div>
      <div className="rail-stat">
        <div className="row"><span>players tracked</span><b>{TD.players.length}</b></div>
        <div className="row"><span>clubs</span><b>{TD.clubs.length}</b></div>
        <div className="row"><span>last sync</span><b>now</b></div>
      </div>
    </div>
  )
}

/* ---------- LEAGUE view ---------- */
function League({ setPlayer, myTeam }) {
  const S = TD.standings
  const lead = S[0]
  const topP = [...TD.players].slice(0, 8)
  return (
    <div className="view">
      <div className="leadstrip">
        <div className="leadcell">
          <div className="lab">League Leader</div>
          <div className="nm">{lead.team}</div>
          <div className="sub">{lead.mgr}</div>
        </div>
        <div className="leadcell"><div className="lab">Total</div><div className="big">{lead.total}</div></div>
        <div className="leadcell"><div className="lab">Margin</div><div className="big up">+{lead.total - S[1].total}</div><div className="sub">vs 2nd</div></div>
        <div className="leadcell"><div className="lab">GW{TD.gw}</div><div className="big" style={{ color: 'var(--amber)' }}>{lead.gwPts}</div></div>
        <div className="leadcell"><div className="lab">Form · last 6</div><FormBars data={lead.form} /></div>
      </div>

      <div className="grid-lead">
        <div className="panel">
          <div className="panel-h"><span className="t">League Table</span><span className="tag">[ TOTAL ▼ ]</span></div>
          <table className="tbl">
            <thead><tr><th className="l">#</th><th className="l">TEAM / MANAGER</th><th>GW{TD.gw}</th><th>TOTAL</th><th>±2ND</th><th className="l" style={{ paddingLeft: 18 }}>FORM</th></tr></thead>
            <tbody>
              {S.map((t, i) => (
                <tr key={t.team} className={t.team === myTeam ? 'me' : ''}>
                  <td className="l c-rk">{String(t.rank).padStart(2, '0')}</td>
                  <td className="l"><span className="c-tm">{t.team}</span> <span className="c-mgr">{t.mgr}</span></td>
                  <td className="c-amber">{t.gwPts}</td>
                  <td className="c-tot">{t.total}</td>
                  <td className={i === 0 ? 'c-dim' : 'c-dn'}>{i === 0 ? '—' : '−' + (S[0].total - t.total)}</td>
                  <td className="l" style={{ paddingLeft: 18, width: 92 }}><svg width="80" height="22" style={{ display: 'block' }}><path d={TD.spark(t.form, 80, 22).line} fill="none" stroke="#2E8B7C" strokeWidth="1.5" /><circle cx={TD.spark(t.form, 80, 22).pts[5][0]} cy={TD.spark(t.form, 80, 22).pts[5][1]} r="2.2" fill="#F2B33D" /></svg></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="panel">
            <div className="panel-h"><span className="t">Top Performers</span><span className="tag">PTS ▼</span></div>
            <table className="tbl">
              <tbody>
                {topP.map(p => (
                  <tr key={p.id} onClick={() => setPlayer(p)}>
                    <td className="l c-dim" style={{ width: 26 }}>{p.rank}</td>
                    <td className="l c-name">{p.name} <Pos p={p.pos} /></td>
                    <td className="c-dim">{p.club}</td>
                    <td className="c-tot">{p.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <div className="panel-h"><span className="t">Form Movers</span><span className="tag">Δ last 6</span></div>
            <table className="tbl">
              <tbody>
                {TD.risers.slice(0, 3).map(p => (
                  <tr key={p.id} onClick={() => setPlayer(p)}>
                    <td className="l c-name">{p.name} <Pos p={p.pos} /></td>
                    <td className="c-up">▲ {TD.fmtSign(p.delta)}</td>
                  </tr>
                ))}
                {TD.fallers.slice(0, 2).map(p => (
                  <tr key={p.id} onClick={() => setPlayer(p)}>
                    <td className="l c-name">{p.name} <Pos p={p.pos} /></td>
                    <td className="c-dn">▼ {TD.fmtSign(p.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- PLAYERS view ---------- */
const COLS = [
  { k: 'rank', t: '#', l: true, w: 36 },
  { k: 'name', t: 'PLAYER', l: true },
  { k: 'pos', t: 'POS', l: true },
  { k: 'club', t: 'CLUB', l: true },
  { k: 'pts', t: 'PTS' },
  { k: 'gw', t: 'GW' },
  { k: 'g', t: 'G' },
  { k: 'a', t: 'A' },
  { k: 'xg', t: 'xG' },
  { k: 'xa', t: 'xA' },
  { k: 'bonus', t: 'BPS' },
  { k: 'own', t: 'OWN%' },
  { k: 'owner', t: 'DRAFTED BY', l: true },
]
function Players({ setPlayer, selected, myTeam }) {
  const [sort, setSort] = useState({ k: 'pts', dir: -1 })
  const [pos, setPos] = useState('ALL')
  const [q, setQ] = useState('')
  const [scope, setScope] = useState('all') // all | mine | fa

  const rows = useMemo(() => {
    let r = TD.players
    if (pos !== 'ALL') r = r.filter(p => p.pos === pos)
    if (scope === 'mine') r = r.filter(p => p.owner === myTeam)
    if (scope === 'fa') r = r.filter(p => !p.owner)
    if (q.trim()) { const s = q.toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(s) || p.club.toLowerCase().includes(s) || (p.owner || '').toLowerCase().includes(s)) }
    const dir = sort.dir
    return [...r].sort((a, b) => {
      let av = a[sort.k], bv = b[sort.k]
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return ((av ?? -1) - (bv ?? -1)) * dir
    })
  }, [sort, pos, q, scope, myTeam])

  const clickSort = k => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: k === 'name' || k === 'club' || k === 'owner' || k === 'pos' ? 1 : -1 })
  const maxPts = TD.players[0].pts

  return (
    <div className="view">
      <div className="controls">
        <div className="search"><span className="pfx">/</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="filter players, clubs, managers…" /></div>
        <div className="segctl">
          {['ALL', 'GK', 'DEF', 'MID', 'FWD'].map(p => <button key={p} className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>)}
        </div>
        <div className="segctl">
          {[['all', 'ALL'], ['mine', 'MY SQUAD'], ['fa', 'FREE AGENTS']].map(([v, l]) => <button key={v} className={scope === v ? 'on' : ''} onClick={() => setScope(v)}>{l}</button>)}
        </div>
        <span className="ctl-spacer"><b>{rows.length}</b> rows · sort <b>{sort.k}{sort.dir < 0 ? '▼' : '▲'}</b></span>
      </div>

      <div className="panel" style={{ marginBottom: 0 }}>
        <table className="tbl">
          <thead>
            <tr>{COLS.map(c => (
              <th key={c.k} className={(c.l ? 'l ' : '') + (sort.k === c.k ? 'sort' : '')} style={c.w ? { width: c.w } : null} onClick={() => clickSort(c.k)}>
                {c.t}{sort.k === c.k && <span className="car">{sort.dir < 0 ? '▼' : '▲'}</span>}
              </th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.id} className={selected && selected.id === p.id ? 'sel' : ''} onClick={() => setPlayer(p)}>
                <td className="l c-dim">{p.rank}</td>
                <td className="l c-name">{p.name}<Status s={p.status} /></td>
                <td className="l"><Pos p={p.pos} /></td>
                <td className="l club">{p.club}</td>
                <td className="c-tot">{p.pts}</td>
                <td>{p.gw}</td>
                <td>{p.g}</td>
                <td>{p.a}</td>
                <td className={p.g > p.xg ? 'c-up' : 'c-dim'}>{p.xg.toFixed(1)}</td>
                <td className="c-dim">{p.xa.toFixed(1)}</td>
                <td className="c-amber">{p.bonus}</td>
                <td><span className="ownwrap"><span className="c-dim">{p.own.toFixed(0)}</span><span className="owntrack"><i style={{ width: `${p.own}%` }}></i></span></span></td>
                <td className="l">{p.owner ? <span className={p.owner === myTeam ? 'c-amber' : 'c-dim'}>{p.owner}</span> : <span style={{ color: 'var(--dim-2)' }}>— free —</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- SQUADS view ---------- */
const POS_ORDER = ['GK', 'DEF', 'MID', 'FWD']
function Squads({ setPlayer, myTeam, setMyTeam }) {
  const [team, setTeam] = useState(myTeam)
  const M = TD.managers.find(m => m.team === team)
  const std = TD.standings.find(s => s.team === team)
  const squad = M.squad
  return (
    <div className="view">
      <div className="squad-head">
        {TD.standings.map(s => (
          <div key={s.team} className={'mgrpick' + (s.team === team ? ' on' : '')} onClick={() => setTeam(s.team)}>
            <div className="t">{s.team}</div><div className="s">#{s.rank} · {s.total} pts</div>
          </div>
        ))}
      </div>

      <div className="leadstrip">
        <div className="leadcell"><div className="lab">Manager</div><div className="nm">{M.mgr}</div><div className="sub">{team}</div></div>
        <div className="leadcell"><div className="lab">League Pos</div><div className="big c-amber">#{std.rank}</div></div>
        <div className="leadcell"><div className="lab">Total</div><div className="big">{std.total}</div></div>
        <div className="leadcell"><div className="lab">GW{TD.gw}</div><div className="big" style={{ color: 'var(--amber)' }}>{std.gwPts}</div></div>
        <div className="leadcell">
          <div className="lab">Action</div>
          <div className={'mgrpick' + (team === myTeam ? ' on' : '')} style={{ padding: '6px 12px' }} onClick={() => setMyTeam(team)}>
            {team === myTeam ? '★ watching' : 'set as mine'}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 0 }}>
        <div className="panel-h"><span className="t">Roster · {squad.length}</span><span className="tag">XI + bench · click for stats</span></div>
        <table className="tbl">
          <thead><tr><th className="l">PLAYER</th><th className="l">POS</th><th className="l">CLUB</th><th>PTS</th><th>GW</th><th>G</th><th>A</th><th>BPS</th><th className="l">ROLE</th></tr></thead>
          <tbody>
            {POS_ORDER.flatMap(pos => squad.filter(p => p.pos === pos).sort((a, b) => (b.starter - a.starter) || b.pts - a.pts).map(p => (
              <tr key={p.id} onClick={() => setPlayer(p)}>
                <td className="l c-name">{p.name}<Status s={p.status} /></td>
                <td className="l"><Pos p={p.pos} /></td>
                <td className="l club">{p.club}</td>
                <td className="c-tot">{p.pts}</td>
                <td className="c-amber">{p.gw}</td>
                <td>{p.g}</td>
                <td>{p.a}</td>
                <td className="c-dim">{p.bonus}</td>
                <td className="l">{p.starter ? <span className="c-up">● XI</span> : <span style={{ color: 'var(--dim-2)' }}>○ bench</span>}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------- player detail drawer ---------- */
function Drawer({ p, onClose, myTeam }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  const std = TD.standings.find(s => s.team === p.owner)
  return (
    <>
      <div className="drawer-scrim" onClick={onClose}></div>
      <div className="drawer">
        <div className="drawer-h">
          <div>
            <div className="nm">{p.name}</div>
            <div className="meta"><Pos p={p.pos} /> · {p.club} · £{p.price}m <Status s={p.status} /></div>
          </div>
          <button className="drawer-x" onClick={onClose}>ESC ✕</button>
        </div>
        <div className="drawer-body">
          <div className="kpis">
            <div className="kpi"><div className="v">{p.pts}</div><div className="l">Points</div></div>
            <div className="kpi"><div className="v amber">{p.gw}</div><div className="l">GW{TD.gw}</div></div>
            <div className="kpi"><div className="v">#{p.rank}</div><div className="l">Overall</div></div>
            <div className="kpi"><div className="v">{p.own.toFixed(0)}%</div><div className="l">Owned</div></div>
          </div>

          <div className="dh">Form · last 6 GW</div>
          <div className="formchart">
            <Spark data={p.form} />
            <div className="axis">{p.form.map((_, i) => <span key={i}>GW{TD.gw - 5 + i}</span>)}</div>
          </div>

          <div className="dh">Season Splits</div>
          {[
            ['Goals', p.g], ['Assists', p.a],
            ['Expected goals (xG)', p.xg.toFixed(1)], ['Expected assists (xA)', p.xa.toFixed(1)],
            ['Bonus points', p.bonus], ['Minutes', p.mins],
            ...(p.pos === 'GK' || p.pos === 'DEF' ? [['Clean sheets', p.cs]] : []),
            ...(p.pos === 'GK' ? [['Saves', p.saves]] : []),
            ['Points / 90', (p.pts / (p.mins / 90)).toFixed(1)],
          ].map(([k, v]) => (
            <div className="splitrow" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>
          ))}

          <div className="dh">Draft Status</div>
          <div className="splitrow"><span className="k">Drafted by</span><span className="v">{p.owner ? `${p.owner}${std ? ' · #' + std.rank : ''}` : '— free agent —'}</span></div>
          <div className="splitrow"><span className="k">Status</span><span className="v" style={{ color: p.status === 'inj' ? 'var(--red)' : p.status === 'doubt' ? 'var(--amber)' : 'var(--green)' }}>{p.status === 'inj' ? 'Injured' : p.status === 'doubt' ? 'Doubtful (75%)' : 'Available'}</span></div>
          {p.owner === myTeam && <div className="splitrow"><span className="k">In your squad</span><span className="v c-amber">★ yes</span></div>}
        </div>
      </div>
    </>
  )
}

/* ---------- app ---------- */
function App() {
  const [view, setView] = useState('league')
  const [player, setPlayer] = useState(null)
  const [myTeam, setMyTeam] = useState(() => localStorage.getItem('td_myteam') || TD.standings[0].team)
  useEffect(() => { localStorage.setItem('td_myteam', myTeam) }, [myTeam])

  useEffect(() => {
    const h = e => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === '1') setView('league')
      if (e.key === '2') setView('players')
      if (e.key === '3') setView('squads')
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="app">
      <StatusBar />
      <div className="body">
        <Rail view={view} setView={setView} myTeam={myTeam} />
        {view === 'league' && <League setPlayer={setPlayer} myTeam={myTeam} />}
        {view === 'players' && <Players setPlayer={setPlayer} selected={player} myTeam={myTeam} />}
        {view === 'squads' && <Squads setPlayer={setPlayer} myTeam={myTeam} setMyTeam={setMyTeam} />}
      </div>
      <div className="cmdbar">
        <span className="key"><b>1</b> league</span>
        <span className="key"><b>2</b> players</span>
        <span className="key"><b>3</b> squads</span>
        <span className="key"><b>/</b> search</span>
        <span className="key"><b>esc</b> close</span>
        <span className="right">FPL DRAFT TERMINAL · {TD.players.length} players · {TD.managers.length} managers · GW{TD.gw}/38</span>
      </div>
      {player && <Drawer p={player} onClose={() => setPlayer(null)} myTeam={myTeam} />}
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
