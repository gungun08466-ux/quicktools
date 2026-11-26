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
    label: 'Encode',
    description: 'Encode input with encodeURIComponent.',
  },
  {
    id: 'decode',
    label: 'Decode',
    description: 'Decode percent-encoded input with decodeURIComponent.',
  },
]

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

function convertValue(value, mode) {
  if (!value) return { output: '', error: null }

  try {
    return {
      output: mode === 'encode' ? encodeURIComponent(value) : decodeURIComponent(value),
      error: null,
    }
  } catch (error) {
    if (mode === 'decode') {
      return {
        output: '',
        error: 'Could not decode this input. Check that each percent sign is followed by two hexadecimal digits and that encoded bytes form valid UTF-8.',
      }
    }
    return {
      output: '',
      error: error instanceof URIError
        ? 'Could not encode this input because it contains an incomplete Unicode character. Replace it and try again.'
        : 'Could not encode this input. Check the text and try again.',
    }
  }
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

export default function UrlEncoderDecoder() {
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
        title="URL Encoder Decoder - Encode and Decode URL Text"
        description="Encode or decode URLs and text with native encodeURIComponent and decodeURIComponent. Handle query strings, special characters, and Unicode privately in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">URL Encoder &amp; Decoder</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Encode or decode URL text, query strings, and special characters.
            Results update instantly, and your text stays in this browser.
          </p>
        </header>

        <section aria-label="URL encoder and decoder" className="tool-surface-raised p-4 sm:p-6">
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
                  className={`min-h-10 rounded-lg px-5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
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
            <section aria-labelledby="url-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="url-input-heading" className="font-semibold text-slate-950">Input text</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode' ? 'Enter text or a URL component to encode.' : 'Enter percent-encoded text to decode.'}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {inputCharacters} characters
                </p>
              </div>
              <label htmlFor="url-encoder-input" className="sr-only">URL text input</label>
              <textarea
                id="url-encoder-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={mode === 'encode' ? 'Paste a URL or text to encode...' : 'Paste percent-encoded text to decode...'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="url-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="url-output-heading" className="font-semibold text-slate-950">Output</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode' ? 'Encoded component' : 'Decoded text'}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {outputCharacters} characters
                </p>
              </div>
              <label htmlFor="url-encoder-output" className="sr-only">URL conversion output</label>
              <textarea
                id="url-encoder-output"
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
          <section aria-labelledby="about-url-encoder">
            <h2 id="about-url-encoder" className="text-2xl font-bold tracking-tight text-slate-950">
              Encode and decode URL components
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This URL encoder decoder uses JavaScript’s native
              {' '}<code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">encodeURIComponent</code>
              {' '}and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-800">decodeURIComponent</code>
              {' '}functions. It works with Unicode text, spaces, punctuation,
              complete URLs, and query strings. The input is processed exactly as
              entered; line breaks and whitespace are not trimmed.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Encoding treats the entire input as one URI component, so reserved
              URL delimiters such as <code className="rounded bg-slate-100 px-1 text-sm">/</code>,
              {' '}<code className="rounded bg-slate-100 px-1 text-sm">?</code>,
              {' '}<code className="rounded bg-slate-100 px-1 text-sm">&amp;</code>, and
              {' '}<code className="rounded bg-slate-100 px-1 text-sm">=</code> are encoded too.
              A plus sign is preserved as a plus sign when decoding; it is not
              treated as a space.
            </p>
          </section>

          <section aria-labelledby="url-encoder-faq">
            <h2 id="url-encoder-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I encode text for a URL?', 'Choose Encode and enter your text. The output uses JavaScript encodeURIComponent, converting spaces, Unicode characters, and reserved punctuation into percent-encoded form.'],
                ['How do I decode percent-encoded text?', 'Choose Decode and enter the encoded value. The output uses decodeURIComponent to restore the original URI component. Invalid percent escapes or invalid encoded UTF-8 are reported instead of being silently changed.'],
                ['Can I encode a complete URL or query string?', 'Yes. The tool encodes the whole input as one URI component, as encodeURIComponent does. This means URL structure characters such as slashes, question marks, ampersands, and equals signs are encoded.'],
                ['Why does a plus sign not decode to a space?', 'decodeURIComponent follows URI component rules: a literal plus sign stays a plus sign. In form-encoded query data, plus is sometimes used for spaces, which is a different convention.'],
                ['Does encoding change spaces or line breaks in my input?', 'The input is not trimmed or edited. The output represents spaces and line breaks using percent encoding, and decoding restores them.'],
                ['Is my text uploaded or stored?', 'No. Encoding, decoding, character counts, and clipboard actions run locally in your browser. The tool does not send your input to a processing server.'],
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
