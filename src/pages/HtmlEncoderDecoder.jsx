import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Eraser,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const MODES = [
  {
    id: 'encode',
    label: 'HTML Encode',
    description: 'Escape special characters so they display as text in HTML.',
  },
  {
    id: 'decode',
    label: 'HTML Decode',
    description: 'Decode named entities and numeric character references.',
  },
]

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function countCharacters(value) {
  if (!value) return 0
  if (graphemeSegmenter) {
    let count = 0
    for (const _segment of graphemeSegmenter.segment(value)) count += 1
    return count
  }
  return Array.from(value).length
}

function encodeHtml(value) {
  return value.replace(/[&<>"']/gu, (character) => HTML_ENTITIES[character])
}

function findInvalidNumericReference(value) {
  const references = value.matchAll(/&#(?:x[^;\s<>]*|[^;\s<>]*);?/giu)

  for (const [reference] of references) {
    const match = reference.match(/^&#(?:[xX]([0-9a-fA-F]+)|(\d+));?$/u)
    if (!match) {
      return `Malformed numeric character reference "${reference}". Use decimal digits or hexadecimal digits after &#x.`
    }

    const codePoint = Number.parseInt(match[1] || match[2], match[1] ? 16 : 10)
    if (
      codePoint === 0
      || codePoint > 0x10FFFF
      || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ) {
      return `The numeric character reference "${reference}" is not a valid Unicode character.`
    }
  }

  return null
}

function decodeHtmlFragment(value) {
  const textarea = document.createElement('textarea')
  // Escaping literal "<" keeps parsing text-only while still decoding character references.
  textarea.innerHTML = value.replace(/</gu, '&lt;')
  return textarea.value
}

function isUnrecognizedNamedReference(reference) {
  const decodedReference = decodeHtmlFragment(reference)
  if (decodedReference === reference) return true

  const name = reference.slice(1, -1)
  if (name.length > 64) return true

  for (let prefixLength = 1; prefixLength < name.length; prefixLength += 1) {
    const prefix = name.slice(0, prefixLength)
    const decodedPrefix = decodeHtmlFragment(`&${prefix};`)
    const suffix = `${name.slice(prefixLength)};`
    if (decodedPrefix !== `&${prefix};` && decodedReference === `${decodedPrefix}${suffix}`) {
      return true
    }
  }

  return false
}

function decodeHtml(value) {
  const numericError = findInvalidNumericReference(value)
  if (numericError) return { output: '', error: numericError }

  try {
    const output = decodeHtmlFragment(value)
    const unknownReference = Array.from(value.matchAll(/&[A-Za-z][A-Za-z0-9]*;/gu))
      .find(([reference]) => isUnrecognizedNamedReference(reference))

    if (unknownReference) {
      return {
        output: '',
        error: `Unrecognized HTML entity "${unknownReference[0]}". Check its spelling or use a numeric character reference.`,
      }
    }

    return { output, error: null }
  } catch {
    return {
      output: '',
      error: 'Could not decode this input. Check the character references and try again.',
    }
  }
}

function convertValue(value, mode) {
  if (!value) return { output: '', error: null }
  return mode === 'encode'
    ? { output: encodeHtml(value), error: null }
    : decodeHtml(value)
}

function StatusMessage({ status, error }) {
  const message = error || status?.message
  if (!message) return null

  const isError = Boolean(error) || status?.type === 'error'
  const Icon = isError ? AlertCircle : Check
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{message}</p>
    </div>
  )
}

export default function HtmlEncoderDecoder() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('encode')
  const [status, setStatus] = useState(null)
  const conversion = useMemo(() => convertValue(input, mode), [input, mode])
  const { output, error } = conversion

  const updateInput = (value) => {
    setInput(value)
    setStatus(null)
  }

  const selectMode = (nextMode) => {
    setMode(nextMode)
    setStatus(null)
  }

  const copyOutput = async () => {
    if (!output) return
    if (!navigator.clipboard?.writeText) {
      setStatus({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      setStatus({ type: 'success', message: 'Output copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the output. Check clipboard permissions and try again.',
      })
    }
  }

  const clearText = () => {
    setInput('')
    setStatus(null)
  }

  const swapOutputIntoInput = () => {
    if (!output || error) return
    setInput(output)
    setStatus({ type: 'success', message: 'Output moved into the input without changing its text.' })
  }

  const inputCharacters = countCharacters(input)
  const outputCharacters = countCharacters(output)
  const selectedMode = MODES.find(({ id }) => id === mode)

  return (
    <>
      <PageMetadata
        title="HTML Encoder Decoder - Encode and Decode HTML Entities"
        description="Encode HTML special characters and decode named entities or numeric character references. Process Unicode text safely and privately in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">HTML Encoder &amp; Decoder</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Escape HTML special characters or decode character references.
            Results update instantly, and decoded markup is shown only as text.
          </p>
        </header>

        <section aria-label="HTML encoder and decoder" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Choose an operation</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedMode.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
              {MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => selectMode(id)}
                  className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    mode === id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="html-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="html-input-heading" className="font-semibold text-slate-950">Input text</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode'
                      ? 'Enter text with HTML special characters to escape.'
                      : 'Enter text containing named or numeric HTML entities.'}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {inputCharacters} characters
                </p>
              </div>
              <label htmlFor="html-encoder-input" className="sr-only">HTML text input</label>
              <textarea
                id="html-encoder-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={mode === 'encode'
                  ? 'Paste text or HTML markup to encode...'
                  : 'Paste HTML entities to decode...'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="html-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="html-output-heading" className="font-semibold text-slate-950">Output</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode' ? 'Encoded HTML text' : 'Decoded text (not rendered as HTML)'}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {outputCharacters} characters
                </p>
              </div>
              <label htmlFor="html-encoder-output" className="sr-only">HTML conversion output</label>
              <textarea
                id="html-encoder-output"
                value={output}
                readOnly
                placeholder={error ? 'Output unavailable until the input can be decoded...' : 'Your result will appear here...'}
                spellCheck="false"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 read-only:cursor-text read-only:focus:border-indigo-500 sm:min-h-80"
              />
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button
              type="button"
              onClick={copyOutput}
              disabled={!output || Boolean(error)}
              className="tool-primary-button"
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy output
            </button>
            <button
              type="button"
              onClick={swapOutputIntoInput}
              disabled={!output || Boolean(error)}
              className="tool-secondary-button"
            >
              <ArrowLeftRight aria-hidden="true" size={16} />
              Use output as input
            </button>
            <button
              type="button"
              onClick={clearText}
              disabled={!input}
              className="tool-secondary-button"
            >
              <Eraser aria-hidden="true" size={16} />
              Clear
            </button>
          </div>

          <StatusMessage status={status} error={error} />
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-html-encoder">
            <h2 id="about-html-encoder" className="text-2xl font-bold tracking-tight text-slate-950">
              Encode and decode HTML entities
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              HTML encoding replaces ampersands, angle brackets, quotation marks,
              and apostrophes with character references. Decoding recognizes
              browser-supported named entities such as <code className="rounded bg-slate-100 px-1 text-sm">&amp;copy;</code>,
              decimal references such as <code className="rounded bg-slate-100 px-1 text-sm">&amp;#169;</code>,
              and hexadecimal references such as <code className="rounded bg-slate-100 px-1 text-sm">&amp;#x1F600;</code>.
              Unicode text is preserved.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Decoded results are placed in a plain text field, never interpreted
              or run as markup. Processing happens locally in your browser.
            </p>
          </section>

          <section aria-labelledby="html-encoder-faq">
            <h2 id="html-encoder-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Which characters are encoded?', 'The encoder escapes ampersand (&), less-than (<), greater-than (>), double quote (") and apostrophe (\'). Ampersands are encoded first so the generated entities are not double-escaped.'],
                ['Which HTML entities can be decoded?', 'The browser HTML parser handles common named entities and decimal or hexadecimal numeric character references. Unknown named entities and invalid numeric references show an error.'],
                ['Does this execute decoded HTML?', 'No. The decoded output is kept as text in a read-only textarea. It is never inserted as page markup or executed.'],
                ['Are Unicode characters supported?', 'Yes. Unicode text is preserved during encoding and decoding, including characters represented by numeric references.'],
                ['Why might an unknown entity show an error?', 'A named reference that the browser does not recognize cannot be reliably decoded. Check its spelling or use a valid decimal or hexadecimal numeric reference.'],
                ['Is my text uploaded?', 'No. Encoding, decoding, counts, and clipboard actions run in your browser; the tool does not send your text to a processing server.'],
              ].map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer font-semibold text-slate-900 marker:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                    {question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
