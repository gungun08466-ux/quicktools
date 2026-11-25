import { ArrowUpRight, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const tools = [
  {
    title: 'Image Compressor',
    description: 'Reduce the file size of JPG, PNG, or WebP images.',
    to: '/image-compressor',
  },
  {
    title: 'Image Resizer',
    description: 'Resize JPG, PNG, or WebP images to custom dimensions in your browser.',
    to: '/image-resizer',
  },
  {
    title: 'JSON Formatter',
    description: 'Format, minify, validate, and copy JSON text.',
    to: '/json-formatter',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple PDF files into one document.',
    to: '/pdf-merger',
  },
  {
    title: 'QR Code Generator',
    description: 'Create a downloadable QR code from text or a URL.',
    to: '/qr-generator',
  },
  {
    title: 'Password Generator',
    description: 'Create a random password with customizable length and character types.',
    to: '/password-generator',
  },
  {
    title: 'JPG to PDF Converter',
    description: 'Combine JPG images into one PDF document in your browser.',
    to: '/jpg-to-pdf',
  },
  {
    title: 'PDF to JPG Converter',
    description: 'Convert all or selected PDF pages into downloadable JPG images.',
    to: '/pdf-to-jpg',
  },
  {
    title: 'PDF Compressor',
    description: 'Reduce PDF file size locally and review the result before downloading.',
    to: '/pdf-compressor',
  },
  {
    title: 'Word Counter',
    description: 'Count words, characters, sentences, and paragraphs instantly in your browser.',
    to: '/word-counter',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageMetadata
        title="About"
        description="QuickTools provides focused browser-based utilities for image resizing and compression, PDF compression, word counting, JPG-to-PDF and PDF-to-JPG conversion, JSON, PDFs, QR codes, and passwords, with no account required."
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
            QuickTools is a website offering simple, free online utilities to
            help people complete everyday digital tasks more easily. The tools
            are designed to be straightforward to use, with no account required.
          </p>
        </header>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-950">Our Purpose</h2>
            <p className="mt-2 leading-7 text-slate-600">
              Our goal is to make common digital tasks easier with useful tools
              and a simple interface. You can use the available tools without
              creating an account.
            </p>
          </section>

          <section aria-labelledby="about-tools" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="about-tools" className="text-xl font-semibold text-slate-950">
              Our Tools
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {tools.map(({ title, description, to }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="group flex h-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <span>
                      <span className="font-semibold text-slate-950">{title}</span>
                      <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-indigo-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-950">Privacy and Ease of Use</h2>
            <p className="mt-2 leading-7 text-slate-600">
              Image compression and resizing, PDF compression, merging, and PDF/image
              conversion process files in your browser. Word counting, JSON
              formatting, QR code generation, and
              password generation also run in the browser. Generated passwords
              are not stored by the tool. The website itself is delivered over
              the internet, and hosting or browser services may process
              connection information. See our{' '}
              <Link className="font-medium text-indigo-700 underline" to="/privacy">
                Privacy Policy
              </Link>{' '}
              for more details.
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-emerald-900">
              <ShieldCheck aria-hidden="true" size={17} className="mt-1 shrink-0 text-emerald-700" />
              <span>No account is needed to use the available tools.</span>
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-slate-950">Continuous Improvement</h2>
            <p className="mt-2 leading-7 text-slate-600">
              QuickTools aims to improve its existing tools and introduce useful
              new ones over time. If you find an issue or have an idea for a
              tool, please share it through our{' '}
              <Link className="font-medium text-indigo-700 underline" to="/contact">
                Contact page
              </Link>.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
