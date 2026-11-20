import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  FileInput,
  FileJson,
  Files,
  Image,
  LockKeyhole,
  MousePointer2,
  QrCode,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import ToolCard from '../components/tools/ToolCard.jsx'

const tools = [
  {
    title: 'Image Compressor',
    description: 'Make image files smaller while keeping them looking sharp.',
    to: '/image-compressor',
    icon: Image,
    category: 'Images',
  },
  {
    title: 'JSON Formatter',
    description: 'Format, organize, and inspect JSON in a readable layout.',
    to: '/json-formatter',
    icon: FileJson,
    category: 'Developer',
  },
  {
    title: 'PDF Merger',
    description: 'Bring multiple PDF documents together into one file.',
    to: '/pdf-merger',
    icon: Files,
    category: 'PDF',
  },
  {
    title: 'QR Code Generator',
    description: 'Turn text or a link into a QR code you can share.',
    to: '/qr-generator',
    icon: QrCode,
    category: 'Generator',
  },
]

const benefits = [
  {
    title: 'Free to use',
    description: 'Useful everyday tools, available without a subscription.',
    icon: BadgeCheck,
  },
  {
    title: 'No registration',
    description: 'Get started right away—no account or sign-up required.',
    icon: UserRoundCheck,
  },
  {
    title: 'Privacy-minded',
    description: 'Tools are designed to process your files in your browser.',
    icon: ShieldCheck,
  },
  {
    title: 'Simple by design',
    description: 'Clear steps and focused features help you finish quickly.',
    icon: MousePointer2,
  },
]

const steps = [
  {
    title: 'Choose a tool',
    description: 'Pick the utility that fits what you need to do.',
    icon: Search,
  },
  {
    title: 'Add your input',
    description: 'Enter your text or select the file you want to work with.',
    icon: FileInput,
  },
  {
    title: 'Get your result',
    description: 'Review the result and save it when you are ready.',
    icon: ArrowDown,
  },
]

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const location = useLocation()
  const hasActiveSearch = Boolean(searchQuery.trim())
  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return tools

    return tools.filter(({ title, description }) =>
      `${title} ${description}`.toLowerCase().includes(query),
    )
  }, [searchQuery])

  useEffect(() => {
    if (!location.hash) return

    document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash])

  const exploreTools = () => {
    setSearchQuery('')
    window.requestAnimationFrame(() => {
      document.getElementById('popular-tools')?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  return (
    <>
      <PageMetadata
        title="Free Online Tools to Make Your Work Easier"
        description="Use QuickTools' free online tools to compress images, format JSON, merge PDFs, and create QR codes—quickly, with no account required."
      />

      <section className="border-b border-slate-200 bg-white">
        <div className={`mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16 ${
          hasActiveSearch
            ? 'lg:grid-cols-1 lg:justify-items-center'
            : 'lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16'
        }`}>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
              <LockKeyhole aria-hidden="true" size={15} />
              Free tools, no account needed
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Free Online Tools to Make Your Work Easier
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
              Get everyday tasks done faster with simple, free online tools. No account or registration required. Just choose a tool and get started!
            </p>

            <form
              role="search"
              className="mt-8"
              onSubmit={(event) => {
                event.preventDefault()
                document
                  .getElementById(hasActiveSearch ? 'search-results' : 'popular-tools')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <label htmlFor="tool-search" className="sr-only">
                Search available tools
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white p-1.5 pl-4 shadow-sm transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
                <Search aria-hidden="true" size={19} className="shrink-0 text-slate-400" />
                <input
                  id="tool-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search for a tool (e.g., Image Compressor, JSON Formatter)"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Search
                </button>
              </div>
            </form>

            {hasActiveSearch && (
              <section
                id="search-results"
                aria-labelledby="search-results-heading"
                aria-live="polite"
                className="mt-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="search-results-heading" className="text-sm font-semibold text-slate-900">
                    Search results
                  </h2>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-slate-500">
                      {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} found
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <X aria-hidden="true" size={15} />
                      Clear search
                    </button>
                  </div>
                </div>
                {filteredTools.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {filteredTools.map((tool) => <ToolCard key={tool.to} {...tool} />)}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center">
                    <p className="text-sm text-slate-600">
                      No tools found. Try another search.
                    </p>
                  </div>
                )}
              </section>
            )}

            <button
              type="button"
              onClick={exploreTools}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Explore tools
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>

          {!hasActiveSearch && <div
            aria-hidden="true"
            className="relative mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-7"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Your tools, all in one place</div>
                <div className="mt-1 text-xs text-slate-500">Pick up where you need</div>
              </div>
              <span className="flex size-9 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                <MousePointer2 aria-hidden="true" size={17} />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {tools.map(({ title, icon: Icon, to }) => (
                <Link
                  key={to}
                  to={to}
                  aria-label={`Open ${title}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <div className="mt-4 text-xs font-semibold text-slate-800">{title}</div>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs text-slate-600">
              <ShieldCheck aria-hidden="true" size={16} className="text-emerald-600" />
              Private, simple, and ready when you are
            </div>
          </div>}
        </div>
      </section>

      <section
        id="popular-tools"
        aria-labelledby="tools-heading"
        className="scroll-mt-8 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              Get started
            </p>
            <h2 id="tools-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Popular tools
            </h2>
            <p className="mt-2 text-slate-600">
              Handy utilities for the tasks you do every day.
            </p>
          </div>
          <p aria-live="polite" className="text-sm text-slate-500">
            {tools.length} tools available
          </p>
        </div>

        {tools.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((tool) => <ToolCard key={tool.to} {...tool} />)}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="benefits-heading" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              Why QuickTools
            </p>
            <h2 id="benefits-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Useful tools without the fuss
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Get what you need, then get on with your day.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
                  <Icon aria-hidden="true" size={21} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
            How it works
          </p>
          <h2 id="steps-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Three steps. That’s it.
          </h2>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <Icon aria-hidden="true" size={21} />
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-slate-900 px-6 py-12 text-center sm:px-10 sm:py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">
            Ready when you are
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Make your next task a little easier.
          </h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-slate-300">
            Explore free tools designed to help you get things done—no account needed.
          </p>
          <button
            type="button"
            onClick={exploreTools}
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore all tools
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </section>
    </>
  )
}
