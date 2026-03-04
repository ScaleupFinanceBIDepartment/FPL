import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#00ff87] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    open:      'bg-yellow-500/20 text-yellow-400 border-yellow-700/40',
    accepted:  'bg-green-500/20  text-green-400  border-green-700/40',
    rejected:  'bg-red-500/20    text-red-400    border-red-700/40',
    withdrawn: 'bg-slate-700/40  text-slate-400  border-slate-600/40',
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
    <div className="bg-[#1a0033]/60 rounded-xl border border-purple-900/50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-white text-sm font-bold">
            {proposal.proposing_team}
            <span className="text-slate-500 font-normal mx-2">→</span>
            {proposal.receiving_team}
          </div>
          <StatusBadge status={proposal.status} />
        </div>
        <div className="text-slate-600 text-xs">
          {new Date(proposal.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500 mb-1 font-medium">Offering</div>
          {(proposal.offering_players ?? []).map((p, i) => (
            <div key={i} className="text-white text-xs font-semibold py-0.5">{p.name}</div>
          ))}
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1 font-medium">Requesting</div>
          {(proposal.requesting_players ?? []).map((p, i) => (
            <div key={i} className="text-white text-xs font-semibold py-0.5">{p.name}</div>
          ))}
        </div>
      </div>

      {proposal.notes && (
        <p className="text-slate-400 text-xs italic border-t border-purple-900/30 pt-2">"{proposal.notes}"</p>
      )}

      {canAct && (
        <div className="flex gap-2 pt-1">
          {isReceiver && (
            <>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'accepted')}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onUpdateStatus(proposal.id, 'rejected')}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
              >
                Reject
              </button>
            </>
          )}
          {isProposer && (
            <button
              onClick={() => onUpdateStatus(proposal.id, 'withdrawn')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 rounded-lg transition-colors"
            >
              Withdraw
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function TradeCenter() {
  const [squads,    setSquads]    = useState([])
  const [teams,     setTeams]     = useState([])
  const [tradeBlock, setTradeBlock] = useState([])
  const [proposals,  setProposals]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [myTeam,     setMyTeam]     = useState(() => localStorage.getItem('fpl_myTeam') ?? '')

  // Add-to-block form
  const [blockPlayer, setBlockPlayer] = useState('')
  const [blockNote,   setBlockNote]   = useState('')
  const [blockSaving, setBlockSaving] = useState(false)

  // Proposal form
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

      // Unique teams
      const seen = new Map()
      squadsData.forEach(s => {
        if (!seen.has(s.team_name)) seen.set(s.team_name, s.manager_name)
      })
      setTeams([...seen.entries()].map(([team_name, manager_name]) => ({ team_name, manager_name })))

      setTradeBlock(tbRes.data ?? [])
      setProposals(prRes.data ?? [])
      setLoading(false)
    })
  }, [])

  const selectTeam = (name) => {
    setMyTeam(name)
    localStorage.setItem('fpl_myTeam', name)
  }

  const mySquad       = squads.filter(s => s.team_name === myTeam)
  const myTeamInfo    = teams.find(t => t.team_name === myTeam)
  const receiverSquad = squads.filter(s => s.team_name === propReceiver)

  const toggleArr = (setter, id) =>
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // ---- Add to trade block
  const addToBlock = async () => {
    if (!myTeam || !blockPlayer) return
    const player = mySquad.find(p => String(p.player_id) === blockPlayer)
    if (!player) return
    setBlockSaving(true)
    const { error } = await supabase.from('trade_block').upsert({
      team_name:       myTeam,
      manager_name:    myTeamInfo?.manager_name ?? myTeam,
      player_id:       player.player_id,
      player_web_name: player.player_web_name,
      player_position: player.player_position,
      player_team:     player.player_team,
      notes:           blockNote || null,
    }, { onConflict: 'team_name,player_id' })

    if (!error) {
      const { data } = await supabase.from('trade_block').select('*').order('created_at', { ascending: false })
      setTradeBlock(data ?? [])
      setBlockPlayer('')
      setBlockNote('')
    }
    setBlockSaving(false)
  }

  const removeFromBlock = async (id) => {
    await supabase.from('trade_block').delete().eq('id', id)
    setTradeBlock(prev => prev.filter(p => p.id !== id))
  }

  // ---- Submit proposal
  const submitProposal = async () => {
    if (!myTeam || !propReceiver || !propOffering.length || !propRequesting.length) return
    setPropSaving(true)

    const offering   = propOffering.map(id => {
      const p = mySquad.find(s => String(s.player_id) === id)
      return { player_id: id, name: p?.player_web_name ?? id }
    })
    const requesting = propRequesting.map(id => {
      const p = receiverSquad.find(s => String(s.player_id) === id)
      return { player_id: id, name: p?.player_web_name ?? id }
    })

    await supabase.from('trade_proposals').insert({
      proposing_team:     myTeam,
      receiving_team:     propReceiver,
      offering_players:   offering,
      requesting_players: requesting,
      notes:              propNote || null,
      status:             'open',
    })

    const { data } = await supabase.from('trade_proposals').select('*').order('created_at', { ascending: false })
    setProposals(data ?? [])
    setPropReceiver('')
    setPropOffering([])
    setPropRequesting([])
    setPropNote('')
    setPropSaving(false)
  }

  const updateProposalStatus = async (id, status) => {
    await supabase.from('trade_proposals').update({ status }).eq('id', id)
    setProposals(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-white">Trade Center</h1>
        <p className="text-slate-400 mt-1">Put players on the block, propose and manage trades</p>
      </div>

      {/* Identity selector */}
      <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 p-5">
        <div className="text-sm font-semibold text-slate-300 mb-3">Who are you?</div>
        <div className="flex flex-wrap gap-2">
          {teams.map(t => (
            <button
              key={t.team_name}
              onClick={() => selectTeam(t.team_name)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                myTeam === t.team_name
                  ? 'bg-[#00ff87] text-black'
                  : 'bg-purple-900/40 text-slate-300 hover:bg-purple-900/70'
              }`}
            >
              {t.team_name}
            </button>
          ))}
        </div>
        {myTeam && (
          <p className="text-slate-500 text-xs mt-3">
            Logged in as <span className="text-[#00ff87] font-semibold">{myTeam}</span>
            {myTeamInfo && ` (${myTeamInfo.manager_name})`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ======== TRADE BLOCK ======== */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">Trade Block</h2>

          {/* Add to block */}
          {myTeam && (
            <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 p-5 space-y-3">
              <div className="text-sm font-semibold text-slate-300">Add player to block</div>
              <select
                value={blockPlayer}
                onChange={e => setBlockPlayer(e.target.value)}
                className="w-full bg-[#0d0d1a] border border-purple-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00ff87] cursor-pointer"
              >
                <option value="">Select player...</option>
                {[...mySquad].sort((a, b) => a.player_position.localeCompare(b.player_position)).map(p => (
                  <option key={p.player_id} value={String(p.player_id)}>
                    {p.player_web_name} ({p.player_position[0]}) — {p.player_team}
                  </option>
                ))}
              </select>
              <input
                value={blockNote}
                onChange={e => setBlockNote(e.target.value)}
                placeholder="Note (optional, e.g. 'looking for a striker')"
                className="w-full bg-[#0d0d1a] border border-purple-800 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-[#00ff87]"
              />
              <button
                onClick={addToBlock}
                disabled={!blockPlayer || blockSaving}
                className="w-full bg-[#00ff87] text-black font-black py-2.5 rounded-xl text-sm hover:bg-[#00dd77] disabled:opacity-40 transition-colors"
              >
                {blockSaving ? 'Adding...' : 'Add to Trade Block'}
              </button>
            </div>
          )}

          {/* Block list */}
          <div className="space-y-2">
            {tradeBlock.length === 0 ? (
              <div className="text-slate-600 text-sm text-center py-12 border border-dashed border-purple-900/40 rounded-2xl">
                No players on the trade block yet
              </div>
            ) : (
              tradeBlock.map(p => (
                <div key={p.id} className="bg-[#1a0033]/60 rounded-xl border border-purple-900/50 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{p.player_web_name}</div>
                    <div className="text-slate-400 text-xs">
                      {p.player_position} · {p.player_team}
                    </div>
                    <div className="text-[#00ff87] text-xs font-semibold mt-0.5">{p.team_name}</div>
                    {p.notes && (
                      <div className="text-slate-500 text-xs mt-1 italic truncate">"{p.notes}"</div>
                    )}
                  </div>
                  {myTeam === p.team_name && (
                    <button
                      onClick={() => removeFromBlock(p.id)}
                      className="shrink-0 text-red-400 hover:text-red-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-900/50 hover:bg-red-900/20 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ======== TRADE PROPOSALS ======== */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">Trade Proposals</h2>

          {/* Create proposal */}
          {myTeam && (
            <div className="bg-[#1a0033]/60 rounded-2xl border border-purple-900/50 p-5 space-y-4">
              <div className="text-sm font-semibold text-slate-300">Propose a trade</div>

              <select
                value={propReceiver}
                onChange={e => { setPropReceiver(e.target.value); setPropRequesting([]) }}
                className="w-full bg-[#0d0d1a] border border-purple-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#00ff87] cursor-pointer"
              >
                <option value="">Send offer to team...</option>
                {teams.filter(t => t.team_name !== myTeam).map(t => (
                  <option key={t.team_name} value={t.team_name}>{t.team_name}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-3">
                {/* Offering */}
                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">
                    You offer
                  </div>
                  <div className="bg-[#0d0d1a] border border-purple-800 rounded-xl p-2 max-h-44 overflow-y-auto space-y-0.5">
                    {mySquad.length === 0 ? (
                      <div className="text-slate-600 text-xs p-2">No squad data</div>
                    ) : (
                      [...mySquad]
                        .sort((a, b) => a.player_position.localeCompare(b.player_position))
                        .map(p => (
                          <label key={p.player_id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-purple-900/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={propOffering.includes(String(p.player_id))}
                              onChange={() => toggleArr(setPropOffering, String(p.player_id))}
                              className="accent-[#00ff87] cursor-pointer"
                            />
                            <span className="text-white text-xs truncate">{p.player_web_name}</span>
                            <span className="text-slate-500 text-[10px] shrink-0">{p.player_position[0]}</span>
                          </label>
                        ))
                    )}
                  </div>
                </div>

                {/* Requesting */}
                <div>
                  <div className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wide">
                    You want
                  </div>
                  <div className="bg-[#0d0d1a] border border-purple-800 rounded-xl p-2 max-h-44 overflow-y-auto space-y-0.5">
                    {!propReceiver ? (
                      <div className="text-slate-600 text-xs p-2">Pick a team first</div>
                    ) : (
                      [...receiverSquad]
                        .sort((a, b) => a.player_position.localeCompare(b.player_position))
                        .map(p => (
                          <label key={p.player_id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-purple-900/30 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={propRequesting.includes(String(p.player_id))}
                              onChange={() => toggleArr(setPropRequesting, String(p.player_id))}
                              className="accent-[#00ff87] cursor-pointer"
                            />
                            <span className="text-white text-xs truncate">{p.player_web_name}</span>
                            <span className="text-slate-500 text-[10px] shrink-0">{p.player_position[0]}</span>
                          </label>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <input
                value={propNote}
                onChange={e => setPropNote(e.target.value)}
                placeholder="Message to other manager (optional)"
                className="w-full bg-[#0d0d1a] border border-purple-800 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-[#00ff87]"
              />

              <button
                onClick={submitProposal}
                disabled={!propReceiver || !propOffering.length || !propRequesting.length || propSaving}
                className="w-full bg-[#e90052] text-white font-black py-2.5 rounded-xl text-sm hover:bg-[#c70045] disabled:opacity-40 transition-colors"
              >
                {propSaving ? 'Sending...' : 'Send Trade Proposal'}
              </button>
            </div>
          )}

          {/* Proposals list */}
          <div className="space-y-3">
            {proposals.length === 0 ? (
              <div className="text-slate-600 text-sm text-center py-12 border border-dashed border-purple-900/40 rounded-2xl">
                No trade proposals yet
              </div>
            ) : (
              proposals.map(p => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  myTeam={myTeam}
                  onUpdateStatus={updateProposalStatus}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
