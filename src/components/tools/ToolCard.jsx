import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ToolCard({ title, description, to, icon: Icon, category, accent }) {
  return (
    <Link
      to={to}
      className="group flex h-full min-h-56 flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/50 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="flex items-start justify-between">
        <span className={`flex size-12 items-center justify-center rounded-2xl ring-1 transition duration-200 group-hover:scale-105 ${accent || 'bg-indigo-50 text-indigo-700 ring-indigo-100'}`}>
          {Icon ? <Icon aria-hidden="true" size={21} /> : null}
        </span>
        {category && (
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-100">
            {category}
          </span>
        )}
      </div>
      <h2 className="mt-5 font-semibold tracking-tight text-slate-950 transition group-hover:text-indigo-800">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-indigo-700">
        <span>Open tool</span>
        <span className="flex size-8 items-center justify-center rounded-full bg-indigo-50 transition duration-200 group-hover:translate-x-0.5 group-hover:bg-indigo-600 group-hover:text-white">
          <ArrowUpRight aria-hidden="true" size={16} />
        </span>
      </span>
    </Link>
  )
}
