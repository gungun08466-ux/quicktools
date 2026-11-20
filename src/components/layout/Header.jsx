import { Menu, Wrench, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

const linkClass =
  'rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)')
    const closeMenuOnDesktop = (event) => {
      if (event.matches) setMenuOpen(false)
    }

    desktopQuery.addEventListener('change', closeMenuOnDesktop)
    return () => desktopQuery.removeEventListener('change', closeMenuOnDesktop)
  }, [])

  return (
    <header className="relative border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-950"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Wrench aria-hidden="true" size={19} />
            </span>
            QuickTools
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <Link to="/#popular-tools" className={linkClass}>
              All Tools
            </Link>
            <NavLink to="/about" className={linkClass}>
              About
            </NavLink>
          </nav>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 md:hidden"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className={`${menuOpen ? 'absolute inset-x-0 top-full z-10 flex border-b border-slate-200 bg-white p-4 shadow-lg' : 'hidden'} flex-col gap-1 md:hidden`}
        >
          <NavLink to="/" end className={linkClass} onClick={() => setMenuOpen(false)}>
            Home
          </NavLink>
          <Link to="/#popular-tools" className={linkClass} onClick={() => setMenuOpen(false)}>
            All Tools
          </Link>
          <NavLink to="/about" className={linkClass} onClick={() => setMenuOpen(false)}>
            About
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
