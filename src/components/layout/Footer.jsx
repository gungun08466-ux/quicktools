import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} QuickTools. Simple tools, right in your browser.</p>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-indigo-700" to="/">Home</Link>
          <Link className="hover:text-indigo-700" to="/about">About</Link>
          <Link className="hover:text-indigo-700" to="/contact">Contact</Link>
          <Link className="hover:text-indigo-700" to="/privacy">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  )
}
