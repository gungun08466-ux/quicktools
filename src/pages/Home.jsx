import {
  ArrowDown,
  ArrowRight,
  ArrowLeftRight,
  BadgeCheck,
  CalendarDays,
  Calculator,
  Type,
  Link2,
  Code2,
  Crop,
  FileImage,
  FileInput,
  FileJson,
  FileText,
  Files,
  Image,
  KeyRound,
  MousePointer2,
  Palette,
  QrCode,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
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
    description: 'Reduce an image’s file size before sharing it or using it on a website.',
    to: '/image-compressor',
    icon: Image,
    category: 'Images',
    accent: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  {
    title: 'Image Resizer',
    description: 'Resize JPG, PNG, or WebP images to custom dimensions in your browser.',
    to: '/image-resizer',
    icon: Image,
    category: 'Images',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'Image Cropper',
    description: 'Crop, rotate, and flip JPG, PNG, or WebP images to a preset or custom size.',
    to: '/image-cropper',
    icon: Crop,
    category: 'Images',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'HEIC to JPG Converter',
    description: 'Convert HEIC and HEIF photos to JPG locally, then download images individually or as a ZIP.',
    to: '/heic-to-jpg',
    icon: FileImage,
    category: 'Images',
    accent: 'bg-teal-50 text-teal-700 ring-teal-100',
  },
  {
    title: 'PNG to JPG Converter',
    description: 'Convert PNG images to JPG with adjustable quality and a background color for transparency.',
    to: '/png-to-jpg',
    icon: FileImage,
    category: 'Images',
    accent: 'bg-orange-50 text-orange-700 ring-orange-100',
  },
  {
    title: 'JPG to PNG Converter',
    description: 'Convert JPG and JPEG images to PNG while preserving their original dimensions.',
    to: '/jpg-to-png',
    icon: FileImage,
    category: 'Images',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    title: 'JSON Formatter',
    description: 'Format and validate JSON when working with API responses or configuration data.',
    to: '/json-formatter',
    icon: FileJson,
    category: 'Developer',
    accent: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  {
    title: 'JSON to CSV Converter',
    description: 'Convert JSON arrays into CSV with flattened nested fields and correctly escaped values.',
    to: '/json-to-csv',
    icon: FileJson,
    category: 'Developer',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    title: 'CSV to JSON Converter',
    description: 'Convert CSV rows into formatted JSON with configurable delimiters and quoted-field support.',
    to: '/csv-to-json',
    icon: FileJson,
    category: 'Developer',
    accent: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  },
  {
    title: 'Base64 Encoder & Decoder',
    description: 'Encode or decode text with Unicode support, validation, and local downloads.',
    to: '/base64-encoder-decoder',
    icon: Code2,
    category: 'Developer',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'XML Formatter & Validator',
    description: 'Beautify, minify, and validate XML with helpful parsing errors in your browser.',
    to: '/xml-formatter',
    icon: Code2,
    category: 'Developer',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'Markdown Editor & Preview',
    description: 'Write Markdown with a live, safe preview and copy or download your source.',
    to: '/markdown-editor',
    icon: FileText,
    category: 'Developer',
    accent: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  {
    title: 'SQL Formatter',
    description: 'Format or minify SQL with preserved strings, quoted identifiers, comments, and configurable keyword case.',
    to: '/sql-formatter',
    icon: Code2,
    category: 'Developer',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    title: 'Regex Tester',
    description: 'Test JavaScript regular expressions with live highlighting, positions, and capture groups.',
    to: '/regex-tester',
    icon: Code2,
    category: 'Developer',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'Color Picker & Palette Generator',
    description: 'Convert HEX, RGB, and HSL colors, build palettes, and check WCAG contrast.',
    to: '/color-picker',
    icon: Palette,
    category: 'Design',
    accent: 'bg-pink-50 text-pink-700 ring-pink-100',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple PDF documents, such as reports, into one file.',
    to: '/pdf-merger',
    icon: Files,
    category: 'PDF',
    accent: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  {
    title: 'PDF Splitter',
    description: 'Extract selected pages or page ranges into a new PDF document.',
    to: '/pdf-splitter',
    icon: Scissors,
    category: 'PDF',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'PDF Rotator',
    description: 'Rotate individual or selected PDF pages and preview the changes in your browser.',
    to: '/pdf-rotator',
    icon: RotateCw,
    category: 'PDF',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'QR Code Generator',
    description: 'Turn text or a website URL into a QR code that others can scan.',
    to: '/qr-generator',
    icon: QrCode,
    category: 'Generator',
    accent: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100',
  },
  {
    title: 'Password Generator',
    description: 'Create a strong random password with the character options you choose.',
    to: '/password-generator',
    icon: KeyRound,
    category: 'Security',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  {
    title: 'JPG to PDF Converter',
    description: 'Arrange JPG images and combine them into a single downloadable PDF.',
    to: '/jpg-to-pdf',
    icon: FileImage,
    category: 'PDF',
    accent: 'bg-orange-50 text-orange-700 ring-orange-100',
  },
  {
    title: 'PDF to JPG Converter',
    description: 'Preview PDF pages and convert all or selected pages into JPG images.',
    to: '/pdf-to-jpg',
    icon: FileImage,
    category: 'PDF',
    accent: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  },
  {
    title: 'PDF Compressor',
    description: 'Reduce PDF file size in your browser and compare the result before downloading.',
    to: '/pdf-compressor',
    icon: Files,
    category: 'PDF',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'Word Counter',
    description: 'Count words, characters, sentences, and paragraphs as you type.',
    to: '/word-counter',
    icon: FileText,
    category: 'Text',
    accent: 'bg-teal-50 text-teal-700 ring-teal-100',
  },
  {
    title: 'Character Counter',
    description: 'Count characters with or without spaces, plus words, sentences, paragraphs, and lines.',
    to: '/character-counter',
    icon: FileText,
    category: 'Text',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'Text Case Converter',
    description: 'Convert text between 12 formats, including title case, sentence case, camelCase, and snake_case.',
    to: '/text-case-converter',
    icon: Type,
    category: 'Text',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  {
    title: 'URL Encoder & Decoder',
    description: 'Encode or decode URLs, query strings, and special characters locally in your browser.',
    to: '/url-encoder-decoder',
    icon: Link2,
    category: 'Developer',
    accent: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
  },
  {
    title: 'HTML Encoder & Decoder',
    description: 'Escape HTML special characters and decode entities and numeric character references.',
    to: '/html-encoder-decoder',
    icon: Code2,
    category: 'Developer',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  },
  {
    title: 'Age Calculator',
    description: 'Calculate your exact age and find the date and weekday of your next birthday.',
    to: '/age-calculator',
    icon: CalendarDays,
    category: 'Date & Time',
    accent: 'bg-blue-50 text-blue-700 ring-blue-100',
  },
  {
    title: 'Percentage Calculator',
    description: 'Find percentages, compare values, calculate change, and adjust numbers.',
    to: '/percentage-calculator',
    icon: Calculator,
    category: 'Math',
    accent: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  {
    title: 'Unit Converter',
    description: 'Convert length, weight, temperature, area, volume, time, speed, and data.',
    to: '/unit-converter',
    icon: ArrowLeftRight,
    category: 'Converter',
    accent: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
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
    title: 'Processed in your browser',
    description: 'Images, PDFs, text, QR content, generated passwords, and percentage and age calculations run locally in your browser.',
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
    title: 'Choose the tool you need',
    description: 'Pick the utility that fits your task.',
    icon: Search,
  },
  {
    title: 'Add your text or files',
    description: 'Enter your content or select files, then use the available settings.',
    icon: FileInput,
  },
  {
    title: 'Copy or download your result',
    description: 'Copy the result or download the generated file, depending on the tool.',
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
        description="Use QuickTools' free online tools to compress and resize images, compress PDFs, calculate age, count words, format JSON, merge PDFs, convert JPGs to PDF or PDF pages to JPG, create QR codes, and generate passwords—quickly, with no account required."
      />

      <section className="relative isolate overflow-hidden border-b border-indigo-100/80 bg-gradient-to-br from-slate-50 via-white to-indigo-50/80">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-56 size-[34rem] rounded-full bg-indigo-200/30 blur-3xl" />
          <div className="absolute -right-36 top-8 size-[28rem] rounded-full bg-violet-200/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-200/70 to-transparent" />
        </div>
        <div className={`relative mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-11 ${
          hasActiveSearch
            ? 'lg:grid-cols-1 lg:justify-items-center'
            : 'lg:grid-cols-[1.08fr_0.92fr] lg:items-start lg:gap-12'
        }`}>
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100/90 bg-white/80 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-indigo-700 shadow-sm shadow-indigo-100/70 backdrop-blur">
              <span className="flex size-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                <Sparkles aria-hidden="true" size={12} />
              </span>
              {tools.length} FOCUSED ONLINE TOOLS
            </span>
            <h1 className="mt-5 text-[2.4rem] font-bold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:mt-6 lg:text-[3.65rem]">
              <span className="block">Free Online Tools</span>
              <span className="mt-1 block bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-500 bg-clip-text text-transparent">
                to Make Your Work Easier
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Use a focused browser-based tool for a common task, like preparing an image to share or making API JSON easier to read.
            </p>

            <form
              role="search"
              className="mt-6"
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
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-1.5 pl-4 shadow-lg shadow-indigo-100/60 transition duration-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/80">
                <Search aria-hidden="true" size={20} className="shrink-0 text-indigo-500" />
                <input
                  id="tool-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search for a tool (e.g., Image Compressor, JSON Formatter)"
                  className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition duration-200 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={exploreTools}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-md shadow-slate-300/60 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-950 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Explore all tools
                <ArrowDown aria-hidden="true" size={16} />
              </button>
              <span className="text-sm font-medium text-slate-500">
                Free, simple, and ready when you are
              </span>
            </div>
          </div>

          {!hasActiveSearch && (
            <div className="relative mx-auto w-full max-w-[34rem] rounded-[1.75rem] border border-white/90 bg-white/75 p-4 shadow-2xl shadow-indigo-200/50 ring-1 ring-indigo-100/80 backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 px-1 pb-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
                    <MousePointer2 aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">QuickTools library</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900">Pick a tool and get moving</div>
                  </div>
                </div>
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                  {tools.length} tools
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {tools.map(({ title, icon: Icon, to, category, accent }) => (
                  <Link
                    key={to}
                    to={to}
                    aria-label={`Open ${title}`}
                    className="group flex min-h-[3.75rem] min-w-0 items-center gap-2.5 rounded-2xl border border-slate-100 bg-white/90 px-2.5 py-2 shadow-sm shadow-slate-200/50 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:min-h-[4rem] sm:gap-3 sm:px-3"
                  >
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:scale-105 ${accent}`}>
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold leading-4 text-slate-800 sm:text-[13px]">{title}</span>
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{category}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-50/90 to-violet-50/70 px-3 py-2.5 text-xs text-slate-600">
                <span className="flex items-center gap-2 font-medium">
                  <ShieldCheck aria-hidden="true" size={15} className="text-indigo-600" />
                  Your files stay on your device
                </span>
                <ArrowRight aria-hidden="true" size={15} className="text-indigo-500" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        id="popular-tools"
        aria-labelledby="tools-heading"
        className="scroll-mt-8 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-[4.5rem]"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              Choose a tool
            </p>
            <h2 id="tools-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
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
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tools.map((tool) => <ToolCard key={tool.to} {...tool} />)}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="benefits-heading" className="border-y border-indigo-100/80 bg-gradient-to-b from-white via-indigo-50/50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
              Why QuickTools
            </p>
            <h2 id="benefits-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Useful tools without the fuss
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Get what you need, then get on with your day.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ title, description, icon: Icon }) => (
              <article key={title} className="group rounded-2xl border border-white bg-white/90 p-5 shadow-sm shadow-indigo-100/60 ring-1 ring-indigo-100/80 transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-100/70">
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 transition group-hover:bg-indigo-600 group-hover:text-white">
                  <Icon aria-hidden="true" size={21} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-700">
            How it works
          </p>
          <h2 id="steps-heading" className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Three steps. That’s it.
          </h2>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map(({ title, description, icon: Icon }, index) => (
            <li key={title} className="relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/60 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 ring-1 ring-indigo-100">
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

      <section className="px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 px-6 py-10 text-center shadow-2xl shadow-indigo-200/50 sm:px-10 sm:py-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-40 size-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-20 size-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">
              Ready when you are
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Make your next task a little easier.
            </h2>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-indigo-100/80">
              Browse the tools above to find the right fit for your task.
            </p>
            <button
              type="button"
              onClick={exploreTools}
              className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-950 shadow-lg shadow-black/10 transition duration-200 hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore all tools
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
