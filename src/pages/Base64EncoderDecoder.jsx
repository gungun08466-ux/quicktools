import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const MODES = [
  {
    id: 'encode',
    label: 'Encode',
    description: 'Convert text to standard Base64 using UTF-8 bytes.',
  },
  {
    id: 'decode',
    label: 'Decode',
    description: 'Convert standard Base64 text back to UTF-8.',
  },
]

const textEncoder = new TextEncoder()
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/

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

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}

function encodeText(value) {
  return bytesToBase64(textEncoder.encode(value))
}

function decodeBase64(value) {
  const compact = value.replace(/[\t\n\f\r ]/g, '')
  if (!compact) return ''

  if (!BASE64_PATTERN.test(compact)) {
    throw new Error('Use only the standard Base64 alphabet (A–Z, a–z, 0–9, +, /) and optional trailing padding (=).')
  }

  const unpadded = compact.replace(/=+$/, '')
  const suppliedPadding = compact.length - unpadded.length
  const remainder = unpadded.length % 4
  if (remainder === 1) {
    throw new Error('This Base64 input has an invalid length. Check for missing or extra characters.')
  }

  const requiredPadding = remainder === 0 ? 0 : 4 - remainder
  if (suppliedPadding && (compact.length % 4 !== 0 || suppliedPadding !== requiredPadding)) {
    throw new Error('The Base64 padding is invalid. Check the trailing equals signs and try again.')
  }

  const padded = unpadded + '='.repeat(requiredPadding)
  let binary
  try {
    binary = atob(padded)
  } catch {
    throw new Error('This is not valid Base64. Check the characters and padding, then try again.')
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (bytesToBase64(bytes) !== padded) {
    throw new Error('This Base64 input is not in a valid canonical form. Check the final characters and padding.')
  }

  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error('The Base64 data is valid, but it does not contain readable UTF-8 text.')
  }
}

function convertValue(value, mode) {
  if (!value) return { output: '', error: null }

  try {
    return {
      output: mode === 'encode' ? encodeText(value) : decodeBase64(value),
      error: null,
    }
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error
        ? error.message
        : 'Could not convert this input. Check the text and try again.',
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

export default function Base64EncoderDecoder() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('encode')
  const [status, setStatus] = useState(null)
  const conversion = useMemo(() => convertValue(input, mode), [input, mode])
  const { output, error } = conversion
  const selectedMode = MODES.find(({ id }) => id === mode)

  const updateInput = (value) => {
    setInput(value)
    setStatus(null)
  }

  const selectMode = (nextMode) => {
    setMode(nextMode)
    setStatus(null)
  }

  const loadExample = () => {
    setInput('Hello, world!')
    setMode('encode')
    setStatus({ type: 'success', message: 'Example loaded. Select Decode to turn the Base64 result back into text.' })
  }

  const copyOutput = async () => {
    if (!output || error) return
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

  const downloadOutput = () => {
    if (!output || error) return

    try {
      const blob = new Blob([output], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'base64-output.txt'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'TXT download started.' })
    } catch (downloadError) {
      setStatus({
        type: 'error',
        message: downloadError instanceof Error
          ? `Could not create the TXT download: ${downloadError.message}`
          : 'Could not create the TXT download. Try copying the output instead.',
      })
    }
  }

  const clearText = () => {
    setInput('')
    setMode('encode')
    setStatus(null)
  }

  const swapInputAndOutput = () => {
    if (!output || error) return
    setInput(output)
    setMode(mode === 'encode' ? 'decode' : 'encode')
    setStatus({ type: 'success', message: 'Input and output swapped; the opposite mode is selected.' })
  }

  const inputCharacters = countCharacters(input)
  const outputCharacters = countCharacters(output)
  const inputBytes = textEncoder.encode(input).length
  const outputBytes = textEncoder.encode(output).length

  return (
    <>
      <PageMetadata
        title="Base64 Encoder and Decoder - Convert Text Online"
        description="Encode text to Base64 or decode Base64 to readable UTF-8, including Hindi and emoji. Validate and convert text privately in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Base64 Encoder &amp; Decoder</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Encode text as Base64 or decode Base64 back into readable text.
            Unicode, Hindi, emoji, and other languages work locally in your browser.
          </p>
        </header>

        <section aria-label="Base64 encoder and decoder" className="tool-surface-raised p-4 sm:p-6">
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

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-6 text-slate-700">
              <span className="font-semibold text-slate-900">Example:</span>{' '}
              <code className="break-all rounded bg-white px-1.5 py-0.5 text-xs text-indigo-800">Hello, world!</code>
              {' → '}
              <code className="break-all rounded bg-white px-1.5 py-0.5 text-xs text-indigo-800">SGVsbG8sIHdvcmxkIQ==</code>
            </p>
            <button type="button" onClick={loadExample} className="tool-secondary-button shrink-0 px-3 py-2">
              Try example
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="base64-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="base64-input-heading" className="font-semibold text-slate-950">Input text</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode' ? 'Enter or paste text to encode.' : 'Enter standard Base64 to decode. Whitespace is ignored.'}
                  </p>
                </div>
                <p className="text-right text-xs tabular-nums text-slate-500" aria-live="polite">
                  {inputCharacters} characters · {inputBytes} bytes
                </p>
              </div>
              <label htmlFor="base64-input" className="sr-only">Base64 input text</label>
              <textarea
                id="base64-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={mode === 'encode' ? 'Paste text to encode...' : 'Paste Base64 text to decode...'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="base64-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="base64-output-heading" className="font-semibold text-slate-950">Output</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === 'encode' ? 'Base64 result' : 'Decoded UTF-8 text'}
                  </p>
                </div>
                <p className="text-right text-xs tabular-nums text-slate-500" aria-live="polite">
                  {outputCharacters} characters · {outputBytes} bytes
                </p>
              </div>
              <label htmlFor="base64-output" className="sr-only">Base64 conversion output</label>
              <textarea
                id="base64-output"
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
              onClick={downloadOutput}
              disabled={!output || Boolean(error)}
              className="tool-secondary-button"
            >
              <Download aria-hidden="true" size={16} />
              Download TXT
            </button>
            <button
              type="button"
              onClick={swapInputAndOutput}
              disabled={!output || Boolean(error)}
              className="tool-secondary-button"
            >
              <ArrowLeftRight aria-hidden="true" size={16} />
              Swap input and output
            </button>
            <button
              type="button"
              onClick={clearText}
              disabled={!input && mode === 'encode' && !status}
              className="tool-secondary-button"
            >
              <Eraser aria-hidden="true" size={16} />
              Clear &amp; reset
            </button>
          </div>

          <StatusMessage status={status} error={error} />
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-base64">
            <h2 id="about-base64" className="text-2xl font-bold tracking-tight text-slate-950">
              Encode and decode Base64 text
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Base64 represents bytes as printable characters; it is an encoding, not encryption.
              This tool first converts text to UTF-8 bytes, so Hindi and other scripts, emoji,
              and accented characters can be encoded correctly. Decoding validates the Base64
              alphabet and padding, then reports data that is not valid UTF-8 instead of silently
              replacing characters.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Whitespace in pasted Base64 input is ignored, and valid unpadded Base64 is accepted.
              The standard Base64 alphabet is supported. Input, output, character and byte counts,
              copying, and downloads are handled in your browser; your text is not sent to a server.
            </p>
          </section>

          <section aria-labelledby="base64-faq">
            <h2 id="base64-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I encode text to Base64?', 'Choose Encode and enter or paste text. The tool converts the text to UTF-8 bytes before encoding, so non-English characters and emoji are supported.'],
                ['How do I decode Base64?', 'Choose Decode and paste standard Base64. The tool checks its characters and padding, then decodes the bytes as UTF-8 text.'],
                ['Can Base64 encode Hindi or emoji?', 'Yes. Text is converted to UTF-8 bytes before encoding, and decoded UTF-8 is restored to text.'],
                ['Why did decoding show an error?', 'The input may contain characters outside the standard Base64 alphabet, invalid padding, or bytes that are not valid UTF-8 text. Whitespace is ignored, and omitted padding is accepted when the length is valid.'],
                ['Is Base64 encryption?', 'No. Base64 only changes how bytes are represented and does not protect or encrypt the contents. Do not use it to conceal sensitive information.'],
                ['Is my text uploaded?', 'No. Encoding, decoding, counts, copying, and TXT downloads happen locally in your browser.'],
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
