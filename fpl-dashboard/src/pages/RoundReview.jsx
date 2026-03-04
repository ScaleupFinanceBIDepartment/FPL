import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-su-purple border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-su-card border border-su-border rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function PositionBadge({ pos }) {
  const cfg = {
    Goalkeeper: { abbr: 'GK',  cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    Defender:   { abbr: 'DEF', cls: 'bg-green-100  text-green-700  border-green-200'  },
    Midfielder: { abbr: 'MID', cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
    Forward:    { abbr: 'FWD', cls: 'bg-red-100    text-red-700    border-red-200'     },
  }
  const { abbr, cls } = cfg[pos] ?? { abbr: pos, cls: 'bg-su-neutral text-su-accent border-su-border' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${cls}`}>{abbr}</span>
  )
}

function PlayerToken({ player }) {
  const initials = player.player_web_name?.slice(0, 4).toUpperCase() ?? '??'
  return (
    <div className="flex flex-col items-center gap-1 w-[72px]">
      <div className="w-12 h-12 rounded-full bg-su-purple flex items-center justify-center text-white font-black text-[10px] shadow-md">
        {initials}
      </div>
      <div className="text-center">
        <div className="text-su-text text-[11px] font-semibold leading-tight truncate w-full text-center">
          {player.player_web_name}
        </div>
        <div className="text-su-purple text-[11px] font-black">{player.gw_points ?? 0} pts</div>
        <div className="text-su-accent text-[10px] truncate">{player.manager_name?.split(' ')[0]}</div>
      </div>
    </div>
  )
}

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
const DREAM_SLOTS    = { Goalkeeper: 1, Defender: 4, Midfielder: 3, Forward: 3 }

export default function RoundReview() {
  const [lineups,   setLineups]   = useState([])
  const [standings, setStandings] = useState([])
  const [gw,        setGw]        = useState(null)
  const [gwList,    setGwList]    = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('fpl_starting_lineups')
      .select('gameweek')
      .order('gameweek', { ascending: false })
      .then(({ data }) => {
        const gws = [...new Set((data ?? []).map(d => d.gameweek))]
        setGwList(gws)
        if (gws.length > 0) setGw(gws[0])
        else setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!gw) return
    setLoading(true)
    Promise.all([
      supabase.from('fpl_starting_lineups').select('*').eq('gameweek', gw),
      supabase.from('fpl_standings').select('*').eq('gameweek', gw),
    ]).then(([linRes, stRes]) => {
      setLineups(linRes.data ?? [])
      setStandings((stRes.data ?? []).sort((a, b) => b.gw_points - a.gw_points))
      setLoading(false)
    })
  }, [gw])

  const starters  = lineups.filter(l => l.is_starting_11)
  const dreamTeam = POSITION_ORDER.flatMap(pos =>
    starters
      .filter(p => p.player_position === pos)
      .sort((a, b) => (b.gw_points ?? 0) - (a.gw_points ?? 0))
      .slice(0, DREAM_SLOTS[pos])
  )
  const topScorers = [...starters].sort((a, b) => (b.gw_points ?? 0) - (a.gw_points ?? 0)).slice(0, 15)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-su-text">Round Review</h1>
          <p className="text-su-accent text-sm mt-0.5">Best players &amp; performances each week</p>
        </div>
        <select
          value={gw ?? ''}
          onChange={e => setGw(Number(e.target.value))}
          className="bg-white border border-su-border text-su-text rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-su-purple cursor-pointer shadow-sm"
        >
          {gwList.map(g => <option key={g} value={g}>Gameweek {g}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Manager cards */}
          <div>
            <h2 className="font-bold text-su-text mb-3">Manager Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {standings.map((s, i) => (
                <Card key={s.manager_name} className={`p-4 ${i === 0 ? 'border-su-purple border-l-4' : ''}`}>
                  {i === 0 && (
                    <div className="text-su-purple text-[10px] font-black tracking-widest uppercase mb-1">
                      Best this week
                    </div>
                  )}
                  <div className="text-su-text font-semibold text-sm leading-tight">{s.manager_name}</div>
                  <div className="text-su-accent text-xs mb-2">{s.team_name}</div>
                  <div className="text-3xl font-black text-su-purple">{s.gw_points}</div>
                  <div className="text-su-accent text-xs">points</div>
                </Card>
              ))}
            </div>
          </div>

          {/* Dream Team */}
          {dreamTeam.length > 0 && (
            <Card className="p-6">
              <h2 className="font-bold text-su-text mb-6">Team of the Week</h2>
              <div
                className="rounded-lg p-6 space-y-6"
                style={{ background: 'linear-gradient(180deg, #1a4731 0%, #2d6a4f 50%, #40916c 100%)' }}
              >
                {POSITION_ORDER.map(pos => {
                  const row = dreamTeam.filter(p => p.player_position === pos)
                  if (!row.length) return null
                  return (
                    <div key={pos}>
                      <div className="text-white/60 text-xs text-center mb-3 font-bold tracking-widest uppercase">
                        {pos === 'Goalkeeper' ? 'GK' : pos === 'Defender' ? 'DEF' : pos === 'Midfielder' ? 'MID' : 'FWD'}
                      </div>
                      <div className="flex justify-center gap-6 flex-wrap">
                        {row.map(p => <PlayerToken key={`${p.player_id}-${p.manager_name}`} player={p} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Top scorers */}
          <Card>
            <div className="px-6 py-4 border-b border-su-border">
              <h2 className="font-bold text-su-text">Top Scorers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-su-accent text-xs uppercase tracking-wider bg-su-neutral">
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Player</th>
                    <th className="px-6 py-3 text-left">Pos</th>
                    <th className="px-6 py-3 text-left">Club</th>
                    <th className="px-6 py-3 text-left">Manager</th>
                    <th className="px-6 py-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-su-border">
                  {topScorers.map((p, i) => (
                    <tr key={`${p.player_id}-${i}`} className="hover:bg-su-neutral transition-colors">
                      <td className="px-6 py-3 text-su-accent text-sm">{i + 1}</td>
                      <td className="px-6 py-3 font-semibold text-su-text">{p.player_web_name}</td>
                      <td className="px-6 py-3"><PositionBadge pos={p.player_position} /></td>
                      <td className="px-6 py-3 text-su-accent text-sm">{p.player_team}</td>
                      <td className="px-6 py-3 text-su-accent text-sm">{p.manager_name}</td>
                      <td className="px-6 py-3 text-right font-black text-su-purple text-lg">
                        {p.gw_points ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {starters.length === 0 && (
            <div className="text-center py-16 text-su-accent border border-dashed border-su-border rounded-lg">
              No lineup data for GW{gw} yet.
            </div>
          )}
        </>
      )}
    </div>
  )
}
