import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',       label: 'Standings' },
  { to: '/round',  label: 'Round Review' },
  { to: '/trades', label: 'Trade Center' },
]

export default function Navbar() {
  return (
    <nav className="bg-[#10002b] border-b border-purple-900/60 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00ff87] flex items-center justify-center">
            <span className="text-black font-black text-[10px] tracking-tight">FPL</span>
          </div>
          <span className="text-white font-black text-lg tracking-tight">Draft Dashboard</span>
        </div>

        <div className="flex gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#3d195b] text-[#00ff87]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
