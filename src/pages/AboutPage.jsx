import { ShieldCheck, Wrench } from 'lucide-react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

export default function AboutPage() {
  return (
    <>
      <PageMetadata
        title="About"
        description="QuickTools provides focused browser-based utilities for images, JSON, PDFs, and QR codes, with no account required."
      />
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <Wrench aria-hidden="true" size={16} />
            Simple tools, right in your browser
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            About QuickTools
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            QuickTools is a collection of free utilities designed to help with
            everyday tasks without requiring an account.
          </p>
        </header>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-slate-950">Tools that work locally</h2>
          <p className="mt-2 leading-7 text-slate-600">
            Image compression, PDF merging, JSON formatting, and QR generation run
            in your browser. The app does not upload the input content to a
            QuickTools processing server.
          </p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-emerald-900">
            <ShieldCheck aria-hidden="true" size={17} className="mt-1 shrink-0 text-emerald-700" />
            <span>Use the tools without signing in or creating an account.</span>
          </p>
        </section>
      </article>
    </>
  )
}
