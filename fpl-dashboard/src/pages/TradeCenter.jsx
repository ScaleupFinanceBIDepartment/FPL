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

function StatusBadge({ status }) {
  const cfg = {
    open:      'bg-yellow-100 text-yellow-700 border-yellow-200',
    accepted:  'bg-green-100  text-green-700  border-green-200',
    rejected:  'bg-red-100    text-red-700    border-red-200',
    withdrawn: 'bg-su-neutral text-su-accent  border-su-border',
  }
  return (
    <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${cfg[status] ?? cfg.open}`}>
      {status}
    </span>
  )
}

function ProposalCard({ proposal, myTeam, onUpdateStatus }) {
  const isReceiver = myTeam === proposal.receiving_team
  const isProposer = myTeam === proposal.proposing_team
  const canAct     = proposal.status === 'open' && (isReceiver || isProposer)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-su-text text-sm font-bold">
            {proposal.proposing_team}
            <span className="text-su-accent font-normal mx-2">→</span>
            {proposal.receiving_team}
          </div>
          <StatusBadge status={proposal.status} />
        </div>
        <div className="text-su-accent text-xs">{new Date(proposal.created_at).toLocaleDateString()}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-su-accent font-semibold mb-1 uppercase tracking-wide">Offering</div>
          {(proposal.offering_players ?? []).map((p, i) => (
            <div key={i} className="text-su-text text-xs font-semibold py-0.5">{p.name}</div>
          ))}
        </div>
        <div>
          <div className="text-xs text-su-accent font-semibold mb-1 uppercase tracking-wide">Requesting</div>
          {(proposal.requesting_players ?? []).map((p, i) => (
            <div key={i} className="text-su-text text-xs font-semibold py-0.5">{p.name}</div>
          ))}
        </div>
      </div>

      {proposal.notes && (
        <p className="text-su-accent text-xs italic border-t border-su-border pt-2">"{proposal.notes}"</p>
      )}

      {canAct && (
        <div className="flex gap-2 pt-1">
          {isReceiver && (
            <>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'accepted')}
                className="flex-1 bg-su-green text-white text-xs font-bold py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Accept
              </button>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'rejected')}
                className="flex-1 bg-su-red text-white text-xs font-bold py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Reject
              </button>
            </>
          )}
          {isProposer && (
            <button
              onClick={() => onUpdateStatus(proposal.id, 'withdrawn')}
              className="flex-1 bg-su-neutral text-su-accent border border-su-border text-xs font-bold py-2 rounded-lg hover:bg-su-light transition-colors"
            >
              Withdraw
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

export default function TradeCenter() {
  const [squads,    setSquads]    = useState([])
  const [teams,     setTeams]     = useState([])
  const [tradeBlock, setTradeBlock] = useState([])
  const [proposals,  setProposals]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [myTeam,     setMyTeam]     = useState(() => localStorage.getItem('fpl_myTeam') ?? '')

  const [blockPlayer, setBlockPlayer] = useState('')
  const [blockNote,   setBlockNote]   = useState('')
  const [blockSaving, setBlockSaving] = useState(false)

  const [propReceiver,   setPropReceiver]   = useState('')
  const [propOffering,   setPropOffering]   = useState([])
  const [propRequesting, setPropRequesting] = useState([])
  const [propNote,       setPropNote]       = useState('')
  const [propSaving,     setPropSaving]     = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('fpl_current_squads').select('*'),
      supabase.from('trade_block').select('*').order('created_at', { ascending: false }),
      supabase.from('trade_proposals').select('*').order('created_at', { ascending: false }),
    ]).then(([sqRes, tbRes, prRes]) => {
      const squadsData = sqRes.data ?? []
      setSquads(squadsData)
      const seen = new Map()
      squadsData.forEach(s => { if (!seen.has(s.team_name)) seen.set(s.team_name, s.manager_name) })
      setTeams([...seen.entries()].map(([team_name, manager_name]) => ({ team_name, manager_name })))
      setTradeBlock(tbRes.data ?? [])
      setProposals(prRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const selectTeam = name => { setMyTeam(name); localStorage.setItem('fpl_myTeam', name) }

  const mySquad       = squads.filter(s => s.team_name === myTeam)
  const myTeamInfo    = teams.find(t => t.team_name === myTeam)
  const receiverSquad = squads.filter(s => s.team_name === propReceiver)

  const toggleArr = (setter, id) =>
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addToBlock = async () => {
    if (!myTeam || !blockPlayer) return
    const player = mySquad.find(p => String(p.player_id) === blockPlayer)
    if (!player) return
    setBlockSaving(true)
    const { error } = await supabase.from('trade_block').upsert({
      team_name: myTeam, manager_name: myTeamInfo?.manager_name ?? myTeam,
      player_id: player.player_id, player_web_name: player.player_web_name,
      player_position: player.player_position, player_team: player.player_team,
      notes: blockNote || null,
    }, { onConflict: 'team_name,player_id' })
    if (!error) {
      const { data } = await supabase.from('trade_block').select('*').order('created_at', { ascending: false })
      setTradeBlock(data ?? [])
      setBlockPlayer(''); setBlockNote('')
    }
    setBlockSaving(false)
  }

  const removeFromBlock = async id => {
    await supabase.from('trade_block').delete().eq('id', id)
    setTradeBlock(prev => prev.filter(p => p.id !== id))
  }

  const submitProposal = async () => {
    if (!myTeam || !propReceiver || !propOffering.length || !propRequesting.length) return
    setPropSaving(true)
    const offering   = propOffering.map(id => ({ player_id: id, name: mySquad.find(s => String(s.player_id) === id)?.player_web_name ?? id }))
    const requesting = propRequesting.map(id => ({ player_id: id, name: receiverSquad.find(s => String(s.player_id) === id)?.player_web_name ?? id }))
    await supabase.from('trade_proposals').insert({
      proposing_team: myTeam, receiving_team: propReceiver,
      offering_players: offering, requesting_players: requesting,
      notes: propNote || null, status: 'open',
    })
    const { data } = await supabase.from('trade_proposals').select('*').order('created_at', { ascending: false })
    setProposals(data ?? [])
    setPropReceiver(''); setPropOffering([]); setPropRequesting([]); setPropNote('')
    setPropSaving(false)
  }

  const updateProposalStatus = async (id, status) => {
    await supabase.from('trade_proposals').update({ status }).eq('id', id)
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  if (loading) return <Spinner />

  const playerSelectClass = "w-full bg-white border border-su-border text-su-text rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-su-purple cursor-pointer"
  const inputClass        = "w-full bg-white border border-su-border text-su-text rounded-lg px-3 py-2.5 text-sm placeholder-su-accent/50 focus:outline-none focus:border-su-purple"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-su-text">Trade Center</h1>
        <p className="text-su-accent text-sm mt-0.5">Put players on the block, propose and manage trades</p>
      </div>

      {/* Identity */}
      <Card className="p-5">
        <div className="text-sm font-semibold text-su-text mb-3">Who are you?</div>
        <div className="flex flex-wrap gap-2">
          {teams.map(t => (
            <button
              key={t.team_name}
              onClick={() => selectTeam(t.team_name)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                myTeam === t.team_name
                  ? 'bg-su-purple text-white border-su-purple'
                  : 'bg-white text-su-text border-su-border hover:border-su-purple hover:text-su-purple'
              }`}
            >
              {t.team_name}
            </button>
          ))}
        </div>
        {myTeam && (
          <p className="text-su-accent text-xs mt-3">
            Logged in as <span className="text-su-purple font-semibold">{myTeam}</span>
            {myTeamInfo && ` (${myTeamInfo.manager_name})`}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Trade Block */}
        <section className="space-y-4">
          <h2 className="font-bold text-su-text">Trade Block</h2>

          {myTeam && (
            <Card className="p-5 space-y-3">
              <div className="text-sm font-semibold text-su-text">Add player to block</div>
              <select value={blockPlayer} onChange={e => setBlockPlayer(e.target.value)} className={playerSelectClass}>
                <option value="">Select player...</option>
                {[...mySquad].sort((a, b) => a.player_position.localeCompare(b.player_position)).map(p => (
                  <option key={p.player_id} value={String(p.player_id)}>
                    {p.player_web_name} ({p.player_position[0]}) — {p.player_team}
                  </option>
                ))}
              </select>
              <input value={blockNote} onChange={e => setBlockNote(e.target.value)}
                placeholder="Note (optional)" className={inputClass} />
              <button onClick={addToBlock} disabled={!blockPlayer || blockSaving}
                className="w-full bg-su-purple text-white font-bold py-2.5 rounded-lg text-sm hover:bg-[#7a22bc] disabled:opacity-40 transition-colors">
                {blockSaving ? 'Adding...' : 'Add to Trade Block'}
              </button>
            </Card>
          )}

          <div className="space-y-2">
            {tradeBlock.length === 0 ? (
              <div className="text-su-accent text-sm text-center py-12 border border-dashed border-su-border rounded-lg">
                No players on the trade block yet
              </div>
            ) : tradeBlock.map(p => (
              <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-su-text font-semibold text-sm truncate">{p.player_web_name}</div>
                  <div className="text-su-accent text-xs">{p.player_position} · {p.player_team}</div>
                  <div className="text-su-purple text-xs font-semibold mt-0.5">{p.team_name}</div>
                  {p.notes && <div className="text-su-accent text-xs mt-1 italic truncate">"{p.notes}"</div>}
                </div>
                {myTeam === p.team_name && (
                  <button onClick={() => removeFromBlock(p.id)}
                    className="shrink-0 text-su-red text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                    Remove
                  </button>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Proposals */}
        <section className="space-y-4">
          <h2 className="font-bold text-su-text">Trade Proposals</h2>

          {myTeam && (
            <Card className="p-5 space-y-4">
              <div className="text-sm font-semibold text-su-text">Propose a trade</div>

              <select value={propReceiver}
                onChange={e => { setPropReceiver(e.target.value); setPropRequesting([]) }}
                className={playerSelectClass}>
                <option value="">Send offer to team...</option>
                {teams.filter(t => t.team_name !== myTeam).map(t => (
                  <option key={t.team_name} value={t.team_name}>{t.team_name}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-su-accent font-semibold mb-2 uppercase tracking-wide">You offer</div>
                  <div className="bg-su-neutral border border-su-border rounded-lg p-2 max-h-44 overflow-y-auto space-y-0.5">
                    {mySquad.length === 0 ? (
                      <div className="text-su-accent text-xs p-2">No squad data</div>
                    ) : [...mySquad].sort((a, b) => a.player_position.localeCompare(b.player_position)).map(p => (
                      <label key={p.player_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer transition-colors">
                        <input type="checkbox" checked={propOffering.includes(String(p.player_id))}
                          onChange={() => toggleArr(setPropOffering, String(p.player_id))}
                          className="accent-su-purple cursor-pointer" />
                        <span className="text-su-text text-xs truncate">{p.player_web_name}</span>
                        <span className="text-su-accent text-[10px] shrink-0">{p.player_position[0]}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-su-accent font-semibold mb-2 uppercase tracking-wide">You want</div>
                  <div className="bg-su-neutral border border-su-border rounded-lg p-2 max-h-44 overflow-y-auto space-y-0.5">
                    {!propReceiver ? (
                      <div className="text-su-accent text-xs p-2">Pick a team first</div>
                    ) : [...receiverSquad].sort((a, b) => a.player_position.localeCompare(b.player_position)).map(p => (
                      <label key={p.player_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer transition-colors">
                        <input type="checkbox" checked={propRequesting.includes(String(p.player_id))}
                          onChange={() => toggleArr(setPropRequesting, String(p.player_id))}
                          className="accent-su-purple cursor-pointer" />
                        <span className="text-su-text text-xs truncate">{p.player_web_name}</span>
                        <span className="text-su-accent text-[10px] shrink-0">{p.player_position[0]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <input value={propNote} onChange={e => setPropNote(e.target.value)}
                placeholder="Message (optional)" className={inputClass} />

              <button onClick={submitProposal}
                disabled={!propReceiver || !propOffering.length || !propRequesting.length || propSaving}
                className="w-full bg-su-teal text-su-dark font-black py-2.5 rounded-lg text-sm hover:opacity-90 disabled:opacity-40 transition-opacity">
                {propSaving ? 'Sending...' : 'Send Trade Proposal'}
              </button>
            </Card>
          )}

          <div className="space-y-3">
            {proposals.length === 0 ? (
              <div className="text-su-accent text-sm text-center py-12 border border-dashed border-su-border rounded-lg">
                No trade proposals yet
              </div>
            ) : proposals.map(p => (
              <ProposalCard key={p.id} proposal={p} myTeam={myTeam} onUpdateStatus={updateProposalStatus} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
