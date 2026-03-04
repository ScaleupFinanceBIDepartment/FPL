import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PositionBadge({ pos }) {
  const cfg = {
    Goalkeeper: { abbr: 'GK',  cls: 'bg-yellow-500/20 text-yellow-400' },
    Defender:   { abbr: 'DEF', cls: 'bg-green-500/20  text-green-400'  },
    Midfielder: { abbr: 'MID', cls: 'bg-blue-500/20   text-blue-400'   },
    Forward:    { abbr: 'FWD', cls: 'bg-red-500/20    text-red-400'    },
  }
  const { abbr, cls } = cfg[pos] ?? { abbr: pos, cls: 'bg-slate-700 text-slate-300' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{abbr}</span>
  )
}

function PlayerToken({ player }) {
  const initials = player.player_web_name?.slice(0, 4).toUpperCase() ?? '??'
  return (
    <div className="flex flex-col items-center gap-1 w-[72px]">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3d195b] to-[#7c3aed] flex items-center justify-center text-white font-black text-[10px] border-2 border-purple-600 shadow-lg shadow-purple-900/50">
        {initials}
      </div>
      <div className="text-center space-y-0.5">
        <div className="text-white text-[11px] font-semibold leading-tight truncate w-full text-center">
          {player.player_web_name}
        </div>
        <div className="text-[#00ff87] text-[11px] font-black">{player.gw_points ?? 0} pts</div>
        <div className="text-slate-500 text-[10px] truncate">
          {player.manager_name?.split(' ')[0]}
        </div>
      </div>
    </div>
  )
}

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward']
const DREAM_SLOTS    = { Goalkeeper: 1, Defender: 4, Midfielder: 3, Forward: 3 }

export default function RoundReview() {
  const [lineups,  setLineups]  = useState([])
  const [standings, setStandings] = useState([])
  const [gw,        setGw]        = useState(null)
  const [gwList,    setGwList]    = useState([])
  const [loading,   setLoading]   = useState(true)

  // Load available gameweeks on mount
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

  // Load data for selected GW
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

  const starters = lineups.filter(l => l.is_starting_11)

  // Dream team: top N at each position from all starters
  const dreamTeam = POSITION_ORDER.flatMap(pos =>
    starters
      .filter(p => p.player_position === pos)
      .sort((a, b) => (b.gw_points ?? 0) - (a.gw_points ?? 0))
      .slice(0, DREAM_SLOTS[pos])
  )

  const topScorers = [...starters]
    .sort((a, b) => (b.gw_points ?? 0) - (a.gw_points ?? 0))
    .slice(0, 15)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Round Review</h1>
          <p className="text-slate-400 mt-1">Best players &amp; performances each week</p>
        </div>
        <select
          value={gw ?? ''}
          onChange={e => setGw(Number(e.target.value))}
          className="bg-[#1a0033] border border-purple-700 text-white rounded-xl px-4 py-2 focus:outline-none focus:border-[#00ff87] cursor-pointer"
        >
          {gwList.map(g => <option key={g} value={g}>Gameweek {g}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Manager performance cards */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Manager Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {standings.map((s, i) => (
                <div
                  key={s.manager_name}
                  className={`rounded-xl p-4 border transition-all ${
                    i === 0
                      ? 'bg-[#00ff87]/10 border-[#00ff87]/40 ring-1 ring-[#00ff87]/20'
                      : 'bg-[#1a0033]/60 border-purple-900/50'
                  }`}
                >
                  {i === 0 && (
                    <div className="text-[#00ff87] text-[10px] font-black tracking-widest uppercase mb-1">
                      Best this week
                    </div>
                  )}
                  <div className="text-white font-semibold text-sm leading-tight">{s.manager_name}</div>
                  <div className="text-slate-500 text-xs mb-3">{s.team_name}</div>
                  <div className="text-4xl font-black text-white">{s.gw_points}</div>
                  <div className="text-slate-500 text-xs">points</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dream Team / Team of the Week */}
          {dreamTeam.length > 0 && (
            <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 p-6">
              <h2 className="text-lg font-bold text-white mb-6">Team of the Week</h2>

              {/* Pitch-style layout */}
              <div
                className="rounded-xl p-6 space-y-6"
                style={{ background: 'linear-gradient(180deg, #052e16 0%, #14532d 40%, #15803d 100%)' }}
              >
                {POSITION_ORDER.map(pos => {
                  const row = dreamTeam.filter(p => p.player_position === pos)
                  if (!row.length) return null
                  return (
                    <div key={pos}>
                      <div className="text-white/50 text-xs text-center mb-3 font-semibold tracking-widest uppercase">
                        {pos === 'Goalkeeper' ? 'GK' : pos === 'Defender' ? 'DEF' : pos === 'Midfielder' ? 'MID' : 'FWD'}
                      </div>
                      <div className="flex justify-center gap-6 flex-wrap">
                        {row.map(p => <PlayerToken key={`${p.player_id}-${p.manager_name}`} player={p} />)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top scorers table */}
          <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-purple-900/50">
              <h2 className="text-lg font-bold text-white">Top Scorers</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-3 text-left">#</th>
                    <th className="px-6 py-3 text-left">Player</th>
                    <th className="px-6 py-3 text-left">Pos</th>
                    <th className="px-6 py-3 text-left">Club</th>
                    <th className="px-6 py-3 text-left">Manager</th>
                    <th className="px-6 py-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/20">
                  {topScorers.map((p, i) => (
                    <tr key={`${p.player_id}-${i}`} className="hover:bg-purple-900/20 transition-colors">
                      <td className="px-6 py-3 text-slate-500 text-sm">{i + 1}</td>
                      <td className="px-6 py-3 font-semibold text-white">{p.player_web_name}</td>
                      <td className="px-6 py-3"><PositionBadge pos={p.player_position} /></td>
                      <td className="px-6 py-3 text-slate-400 text-sm">{p.player_team}</td>
                      <td className="px-6 py-3 text-slate-400 text-sm">{p.manager_name}</td>
                      <td className="px-6 py-3 text-right font-black text-[#00ff87] text-lg">
                        {p.gw_points ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {starters.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              No lineup data for GW{gw} yet.
            </div>
          )}
        </>
      )}
    </div>
  )
}
