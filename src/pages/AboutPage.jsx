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
    title: 'Image Cropper',
    description: 'Crop, rotate, and flip JPG, PNG, or WebP images to a preset or custom size.',
    to: '/image-cropper',
  },
  {
    title: 'HEIC to JPG Converter',
    description: 'Convert HEIC and HEIF images to JPG in your browser and download them individually or as a ZIP.',
    to: '/heic-to-jpg',
  },
  {
    title: 'PNG to JPG Converter',
    description: 'Convert PNG images to JPG and choose how transparent areas are filled.',
    to: '/png-to-jpg',
  },
  {
    title: 'JPG to PNG Converter',
    description: 'Convert JPG and JPEG images to PNG without changing their pixel dimensions.',
    to: '/jpg-to-png',
  },
  {
    title: 'JSON Formatter',
    description: 'Format, minify, validate, and copy JSON text.',
    to: '/json-formatter',
  },
  {
    title: 'JSON to CSV Converter',
    description: 'Convert arrays of JSON objects into CSV with flattened nested fields.',
    to: '/json-to-csv',
  },
  {
    title: 'CSV to JSON Converter',
    description: 'Convert CSV rows to formatted JSON with support for delimiters and quoted fields.',
    to: '/csv-to-json',
  },
  {
    title: 'Base64 Encoder & Decoder',
    description: 'Encode or decode text, including Unicode, in your browser.',
    to: '/base64-encoder-decoder',
  },
  {
    title: 'XML Formatter & Validator',
    description: 'Format, minify, and validate XML in your browser.',
    to: '/xml-formatter',
  },
  {
    title: 'Markdown Editor & Preview',
    description: 'Write Markdown and preview it safely in your browser.',
    to: '/markdown-editor',
  },
  {
    title: 'SQL Formatter',
    description: 'Format or minify SQL with configurable indentation and keyword case.',
    to: '/sql-formatter',
  },
  {
    title: 'Regex Tester',
    description: 'Test JavaScript regular expressions and inspect highlighted matches and capture groups.',
    to: '/regex-tester',
  },
  {
    title: 'Text Diff Checker',
    description: 'Compare text versions locally and inspect added, removed, and modified lines.',
    to: '/text-diff-checker',
  },
  {
    title: 'Color Picker & Palette Generator',
    description: 'Convert HEX, RGB, and HSL values, generate color palettes, and check WCAG contrast.',
    to: '/color-picker',
  },
  {
    title: 'PDF Merger',
    description: 'Combine multiple PDF files into one document.',
    to: '/pdf-merger',
  },
  {
    title: 'PDF Splitter',
    description: 'Extract selected pages or page ranges into a new PDF.',
    to: '/pdf-splitter',
  },
  {
    title: 'PDF Rotator',
    description: 'Rotate individual or selected PDF pages locally and preview the results.',
    to: '/pdf-rotator',
  },
  {
    title: 'PDF Page Numberer',
    description: 'Add page numbers to every page and customize their position, format, size, and color.',
    to: '/pdf-page-numberer',
  },
  {
    title: 'PDF Watermark',
    description: 'Add customizable text watermarks to every PDF page or selected page ranges locally.',
    to: '/pdf-watermark',
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
  {
    title: 'Character Counter',
    description: 'Count characters with and without spaces, words, sentences, paragraphs, and lines.',
    to: '/character-counter',
  },
  {
    title: 'Text Case Converter',
    description: 'Convert text to uppercase, title case, camelCase, snake_case, and more.',
    to: '/text-case-converter',
  },
  {
    title: 'URL Encoder & Decoder',
    description: 'Encode or decode URL text, query strings, Unicode, and special characters in your browser.',
    to: '/url-encoder-decoder',
  },
  {
    title: 'HTML Encoder & Decoder',
    description: 'Encode HTML special characters and decode named entities or numeric character references.',
    to: '/html-encoder-decoder',
  },
  {
    title: 'Age Calculator',
    description: 'Calculate exact age, total days, and the next birthday date locally in your browser.',
    to: '/age-calculator',
  },
  {
    title: 'Percentage Calculator',
    description: 'Calculate percentages, compare values, and find percentage changes.',
    to: '/percentage-calculator',
  },
  {
    title: 'Unit Converter',
    description: 'Convert length, weight, temperature, area, volume, time, speed, and data units.',
    to: '/unit-converter',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageMetadata
        title="About"
        description="QuickTools provides browser-based utilities for image cropping, resizing and compression, HEIC-to-JPG conversion, PDF watermarks, page numbering, rotation, splitting, merging and compression, text difference checking, color picking and palette generation, regular expression testing, SQL formatting, Markdown editing and preview, text case conversion and counting, XML formatting and validation, Base64 encoding and decoding, unit and percentage conversions, age calculations, PDF conversion, JSON formatting and CSV conversion, QR codes, and passwords."
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
              Image cropping, compression and resizing, HEIC-to-JPG conversion, PDF rotation, splitting, compression,
              merging, page numbering, watermarking, and PDF/image conversion process files in your browser. Regex testing, SQL formatting, text case conversion, word counting, JSON
              formatting, Markdown editing and preview, XML formatting and validation, JSON-to-CSV and CSV-to-JSON conversion, URL, HTML, and Base64 encoding and
              decoding, QR code generation, password generation, color picking and WCAG contrast checks, percentage and age
              calculations and unit conversions also run in the browser. Character counting and word counting
              work locally as you type. Generated passwords
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
