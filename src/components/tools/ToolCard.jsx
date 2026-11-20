import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ToolCard({ title, description, to, icon: Icon }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
          {Icon ? <Icon aria-hidden="true" size={21} /> : null}
        </span>
        <ArrowUpRight
          aria-hidden="true"
          size={18}
          className="text-slate-400 transition group-hover:text-indigo-600"
        />
      </div>
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
        Open tool
        <ArrowUpRight aria-hidden="true" size={15} />
      </span>
    </Link>
  )
}
