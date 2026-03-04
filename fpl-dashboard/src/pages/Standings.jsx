import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'

// Scaleup Finance data colours
const DATA_COLORS = ['#601C98', '#60DEC8', '#495A55', '#8B89B4', '#464468', '#2E3E39', '#B7CDC5', '#566164']

const MEDAL = ['🥇', '🥈', '🥉']

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

function StatCard({ label, value, sub, highlight = false }) {
  return (
    <Card className={`p-5 ${highlight ? 'border-su-purple border-l-4' : ''}`}>
      <div className="text-su-accent text-xs uppercase tracking-wider font-medium mb-1">{label}</div>
      <div className={`text-2xl font-black ${highlight ? 'text-su-purple' : 'text-su-text'}`}>{value}</div>
      {sub && <div className="text-su-accent text-xs mt-1">{sub}</div>}
    </Card>
  )
}

export default function Standings() {
  const [history,   setHistory]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [chartMode, setChartMode] = useState('total')

  useEffect(() => {
    supabase
      .from('fpl_standings')
      .select('*')
      .order('gameweek', { ascending: true })
      .then(({ data }) => { setHistory(data ?? []); setLoading(false) })
  }, [])

  const maxGW   = Math.max(...history.map(s => s.gameweek), 0)
  const current = history
    .filter(s => s.gameweek === maxGW)
    .sort((a, b) => b.total_points - a.total_points)

  const managers  = [...new Set(history.map(s => s.manager_name))]
  const gwNumbers = [...new Set(history.map(s => s.gameweek))].sort((a, b) => a - b)

  const chartData = gwNumbers.map(gw => {
    const row    = { gw: `GW${gw}` }
    const gwRows = history.filter(s => s.gameweek === gw)
      .sort((a, b) => b.total_points - a.total_points)
    gwRows.forEach((s, idx) => {
      row[s.manager_name] = chartMode === 'total' ? s.total_points : idx + 1
    })
    return row
  })

  const bestGW = history.reduce((best, s) => s.gw_points > (best?.gw_points ?? 0) ? s : best, null)
  const leader  = current[0]
  const gap     = current.length >= 2 ? current[0].total_points - current[1].total_points : 0

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-su-text">League Standings</h1>
          <p className="text-su-accent text-sm mt-0.5">Gameweek {maxGW || '—'} · {managers.length} managers</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Leader"     value={leader?.team_name ?? '—'}           sub={`${leader?.total_points ?? 0} pts`} highlight />
        <StatCard label="This Week"  value={bestGW?.manager_name?.split(' ')[0] ?? '—'} sub={`${bestGW?.gw_points ?? 0} pts · GW${bestGW?.gameweek ?? '—'}`} />
        <StatCard label="Gap to 1st" value={`${gap} pts`}                       sub="2nd place gap" />
        <StatCard label="Gameweek"   value={maxGW || '—'}                       sub="current" />
      </div>

      {/* Standings table */}
      <Card>
        <div className="px-6 py-4 border-b border-su-border flex items-center justify-between">
          <h2 className="font-bold text-su-text">Current Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-su-accent text-xs uppercase tracking-wider bg-su-neutral">
                <th className="px-6 py-3 text-left">Rank</th>
                <th className="px-6 py-3 text-left">Manager</th>
                <th className="px-6 py-3 text-left">Team</th>
                <th className="px-6 py-3 text-right">GW Pts</th>
                <th className="px-6 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-su-border">
              {current.map((s, i) => (
                <tr key={s.manager_name} className="hover:bg-su-neutral transition-colors">
                  <td className="px-6 py-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                      i === 0 ? 'bg-yellow-400 text-white' :
                      i === 1 ? 'bg-slate-300 text-white' :
                      i === 2 ? 'bg-amber-600 text-white' :
                      'bg-su-neutral text-su-accent'
                    }`}>
                      {i < 3 ? MEDAL[i] : i + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-su-text">{s.manager_name}</td>
                  <td className="px-6 py-4 text-su-accent">{s.team_name}</td>
                  <td className="px-6 py-4 text-right font-semibold text-su-teal">{s.gw_points}</td>
                  <td className="px-6 py-4 text-right font-black text-su-purple text-lg">{s.total_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-su-text">Points Progression</h2>
            <div className="flex rounded-lg overflow-hidden border border-su-border">
              {[['total', 'Total Points'], ['rank', 'Rank']].map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setChartMode(mode)}
                  className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                    chartMode === mode
                      ? 'bg-su-purple text-white'
                      : 'text-su-accent hover:bg-su-neutral'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DEDEDE" />
              <XAxis dataKey="gw" tick={{ fill: '#566164', fontSize: 12 }} axisLine={{ stroke: '#DEDEDE' }} />
              <YAxis
                tick={{ fill: '#566164', fontSize: 12 }}
                axisLine={{ stroke: '#DEDEDE' }}
                reversed={chartMode === 'rank'}
                tickCount={chartMode === 'rank' ? managers.length : undefined}
              />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #DEDEDE', borderRadius: '6px', color: '#252525' }}
                labelStyle={{ color: '#601C98', fontWeight: 'bold' }}
              />
              <Legend />
              {managers.map((m, i) => (
                <Line
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={DATA_COLORS[i % DATA_COLORS.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {history.length === 0 && (
        <div className="text-center py-16 text-su-accent border border-dashed border-su-border rounded-lg">
          No data yet — run the Python extractor to populate standings.
        </div>
      )}
    </div>
  )
}
