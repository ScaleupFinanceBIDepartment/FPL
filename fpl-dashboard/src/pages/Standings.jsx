import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, ReferenceLine
} from 'recharts'

const COLORS = [
  '#00ff87', '#e90052', '#ffbe0b', '#00b4d8',
  '#f72585', '#9b5de5', '#4cc9f0', '#06d6a0',
  '#ff6b6b', '#a8dadc', '#ffd166', '#c77dff',
]

const MEDAL = ['🥇', '🥈', '🥉']

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-2xl p-5 border ${accent ? 'bg-[#00ff87]/10 border-[#00ff87]/40' : 'bg-[#1a0033]/60 border-purple-900/50'}`}>
      <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-3xl font-black text-white">{value}</div>
      {sub && <div className="text-slate-400 text-xs mt-1">{sub}</div>}
    </div>
  )
}

export default function Standings() {
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [chartMode, setChartMode] = useState('total') // 'total' | 'rank'

  useEffect(() => {
    supabase
      .from('fpl_standings')
      .select('*')
      .order('gameweek', { ascending: true })
      .then(({ data }) => { setHistory(data || []); setLoading(false) })
  }, [])

  const maxGW   = Math.max(...history.map(s => s.gameweek), 0)
  const current = history
    .filter(s => s.gameweek === maxGW)
    .sort((a, b) => b.total_points - a.total_points)
    .map((s, i) => ({ ...s, rank: i + 1 }))

  const managers  = [...new Set(history.map(s => s.manager_name))]
  const gwNumbers = [...new Set(history.map(s => s.gameweek))].sort((a, b) => a - b)

  // Build chart data
  const chartData = gwNumbers.map(gw => {
    const row = { gw: `GW${gw}` }
    const gwRows = history.filter(s => s.gameweek === gw)
      .sort((a, b) => b.total_points - a.total_points)

    gwRows.forEach((s, idx) => {
      if (chartMode === 'total') row[s.manager_name] = s.total_points
      else row[s.manager_name] = idx + 1
    })
    return row
  })

  // Summary stats
  const bestGW = history.reduce((best, s) =>
    s.gw_points > (best?.gw_points ?? 0) ? s : best, null)
  const leader  = current[0]
  const chasing = current[1]
  const gap     = leader && chasing ? leader.total_points - chasing.total_points : 0

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white">League Standings</h1>
        <p className="text-slate-400 mt-1">Gameweek {maxGW} · {managers.length} managers</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leader"     value={leader?.team_name  ?? '—'} sub={`${leader?.total_points ?? 0} pts`} accent />
        <StatCard label="GW Leader"  value={bestGW?.manager_name?.split(' ')[0] ?? '—'} sub={`${bestGW?.gw_points ?? 0} pts (GW${bestGW?.gameweek ?? '—'})`} />
        <StatCard label="Gap to 1st" value={`${gap} pts`} sub="2nd place gap" />
        <StatCard label="GW"         value={maxGW || '—'} sub="current gameweek" />
      </div>

      {/* Table */}
      <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-purple-900/50">
          <h2 className="text-lg font-bold text-white">Current Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-purple-900/30">
                <th className="px-6 py-3 text-left">Rank</th>
                <th className="px-6 py-3 text-left">Manager</th>
                <th className="px-6 py-3 text-left">Team</th>
                <th className="px-6 py-3 text-right">GW Pts</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-900/20">
              {current.map((s, i) => (
                <tr key={s.manager_name} className="hover:bg-purple-900/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                      i === 0 ? 'bg-yellow-500 text-black' :
                      i === 1 ? 'bg-slate-400 text-black' :
                      i === 2 ? 'bg-amber-700 text-white' :
                      'text-slate-500'
                    }`}>
                      {i < 3 ? MEDAL[i] : i + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-white">{s.manager_name}</td>
                  <td className="px-6 py-4 text-slate-400">{s.team_name}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[#00ff87] font-semibold">{s.gw_points}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-white font-black text-lg">{s.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Points Progression</h2>
            <div className="flex rounded-xl overflow-hidden border border-purple-900/50">
              {[['total', 'Total Points'], ['rank', 'Rank']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    chartMode === mode
                      ? 'bg-[#3d195b] text-[#00ff87]'
                      : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3d195b33" />
              <XAxis dataKey="gw" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                reversed={chartMode === 'rank'}
                tickCount={chartMode === 'rank' ? managers.length : undefined}
              />
              <Tooltip
                contentStyle={{ background: '#10002b', border: '1px solid #3d195b', borderRadius: '10px', color: '#e2e8f0' }}
                labelStyle={{ color: '#00ff87', fontWeight: 'bold' }}
              />
              <Legend wrapperStyle={{ paddingTop: 16 }} />
              {managers.map((m, i) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          No data yet — run the Python extractor to populate standings.
        </div>
      )}
    </div>
  )
}
