import { NavLink } from 'react-router-dom'

const links = [
  { to: '/',       label: 'Standings'    },
  { to: '/round',  label: 'Round Review' },
  { to: '/trades', label: 'Trade Center' },
]

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-su-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Scaleup Finance"
            className="h-8 w-auto object-contain object-left"
          />
          <span className="text-su-accent font-semibold text-sm hidden sm:block border-l border-su-border pl-3">
            FPL Draft
          </span>
        </div>

        {/* Nav links */}
        <div className="flex gap-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-su-purple text-white'
                    : 'text-su-accent hover:bg-su-neutral hover:text-su-text'
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
