import { Mail } from 'lucide-react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

export default function ContactPage() {
  return (
    <>
      <PageMetadata
        title="Contact"
        description="Contact QuickTools to report a bug, share a suggestion, or ask a question."
      />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
          <Mail aria-hidden="true" size={16} />
          Contact
        </span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Contact QuickTools
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          We’re happy to hear from you. Contact us to report bugs or technical
          issues, let us know about incorrect tool results, suggest a new tool,
          or share a general question or feedback.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">Email support</h2>
          <p className="mt-2 break-words text-base font-medium text-slate-800">
            quicktools.support1 [at] gmail [dot] com
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            To contact us, replace [at] with @ and [dot] with .
          </p>
        </div>
      </section>
    </>
  )
}
