import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Eraser,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const CASE_FORMATS = [
  { id: 'upper', label: 'UPPERCASE', description: 'ALL LETTERS IN CAPITALS' },
  { id: 'lower', label: 'lowercase', description: 'all letters in lowercase' },
  { id: 'title', label: 'Title Case', description: 'Capitalize Every Word' },
  { id: 'sentence', label: 'Sentence case', description: 'Capitalize each sentence' },
  { id: 'capitalized', label: 'Capitalized Case', description: 'Capitalize First Letters' },
  { id: 'camel', label: 'camelCase', description: 'wordsJoinTogether' },
  { id: 'pascal', label: 'PascalCase', description: 'WordsJoinTogether' },
  { id: 'snake', label: 'snake_case', description: 'words_join_together' },
  { id: 'kebab', label: 'kebab-case', description: 'words-join-together' },
  { id: 'constant', label: 'CONSTANT_CASE', description: 'WORDS_JOIN_TOGETHER' },
  { id: 'alternating', label: 'aLtErNaTiNg CaSe', description: 'aLtErNaTe LeTtEr CaSe' },
  { id: 'inverse', label: 'InVeRsE CaSe', description: 'sWaP eAcH lEtTeR cAsE' },
]

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null
const wordSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null
const sentenceSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
  : null

function getGraphemes(value) {
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value), ({ segment }) => segment)
  }
  return Array.from(value)
}

function capitalizeWord(value, lowercaseRest) {
  const graphemes = getGraphemes(value)
  const firstLetter = graphemes.findIndex((grapheme) => /\p{L}/u.test(grapheme))
  if (firstLetter < 0) return lowercaseRest ? value.toLocaleLowerCase() : value

  const prefix = graphemes.slice(0, firstLetter).join('')
  const first = graphemes[firstLetter].toLocaleUpperCase()
  const rest = graphemes.slice(firstLetter + 1).join('')
  return `${prefix}${first}${lowercaseRest ? rest.toLocaleLowerCase() : rest}`
}

function mapWordsPreservingPunctuation(value, transform) {
  const transformWord = (word) => word
    .split(/(_+)/u)
    .map((part) => /^_+$/u.test(part) ? part : transform(part))
    .join('')

  if (wordSegmenter) {
    return Array.from(wordSegmenter.segment(value), ({ segment, isWordLike }) => (
      isWordLike ? transformWord(segment) : segment
    )).join('')
  }

  return value.replace(/[\p{L}\p{M}\p{N}]+/gu, transformWord)
}

function toTitleCase(value) {
  return mapWordsPreservingPunctuation(value, (word) => capitalizeWord(word, true))
}

function toCapitalizedCase(value) {
  return mapWordsPreservingPunctuation(value, (word) => capitalizeWord(word, false))
}

function toSentenceCaseLine(line) {
  const applySentenceCase = (sentence) => {
    const lowercase = sentence.toLocaleLowerCase()
    return capitalizeWord(lowercase, false)
  }

  if (sentenceSegmenter) {
    return Array.from(sentenceSegmenter.segment(line), ({ segment }) => applySentenceCase(segment)).join('')
  }

  return line
    .toLocaleLowerCase()
    .replace(/(^|[.!?。！？]+[\s"'’”)}\]]*)(\p{L})/gu, (_, boundary, letter) => (
      `${boundary}${letter.toLocaleUpperCase()}`
    ))
}

function toSentenceCase(value) {
  return value
    .split(/(\r\n|\r|\n)/u)
    .map((part) => (/^(?:\r\n|\r|\n)$/u.test(part) ? part : toSentenceCaseLine(part)))
    .join('')
}

function isLowercase(grapheme) {
  return /\p{Ll}/u.test(grapheme)
}

function isUppercase(grapheme) {
  return /\p{Lu}/u.test(grapheme)
}

function isNumber(grapheme) {
  return /\p{N}/u.test(grapheme)
}

function splitWordBoundaries(word) {
  const graphemes = getGraphemes(word)
  const words = []
  let current = ''

  graphemes.forEach((grapheme, index) => {
    const previous = graphemes[index - 1]
    const next = graphemes[index + 1]
    const startsNewWord = Boolean(previous) && (
      (isUppercase(grapheme) && (isLowercase(previous) || isNumber(previous)))
      || (isUppercase(previous) && isUppercase(grapheme) && next && isLowercase(next))
      || (isNumber(previous) !== isNumber(grapheme))
    )

    if (startsNewWord) {
      if (current) words.push(current)
      current = ''
    }
    current += grapheme
  })

  if (current) words.push(current)
  return words
}

function getIdentifierWords(line) {
  const runs = line.match(/[\p{L}\p{M}\p{N}]+/gu) || []
  return runs.flatMap(splitWordBoundaries)
}

function mapLines(value, transformLine) {
  return value
    .split(/(\r\n|\r|\n)/u)
    .map((part) => (/^(?:\r\n|\r|\n)$/u.test(part) ? part : transformLine(part)))
    .join('')
}

function toIdentifierCase(value, format) {
  return mapLines(value, (line) => {
    const words = getIdentifierWords(line)
    if (!words.length) return line
    const leadingWhitespace = line.match(/^\s*/u)?.[0] || ''
    const trailingWhitespace = line.match(/\s*$/u)?.[0] || ''

    let convertedWords
    switch (format) {
      case 'camel':
        convertedWords = words
          .map((word, index) => index === 0
            ? word.toLocaleLowerCase()
            : capitalizeWord(word.toLocaleLowerCase(), false))
          .join('')
        break
      case 'pascal':
        convertedWords = words.map((word) => capitalizeWord(word.toLocaleLowerCase(), false)).join('')
        break
      case 'snake':
        convertedWords = words.map((word) => word.toLocaleLowerCase()).join('_')
        break
      case 'kebab':
        convertedWords = words.map((word) => word.toLocaleLowerCase()).join('-')
        break
      case 'constant':
        convertedWords = words.map((word) => word.toLocaleUpperCase()).join('_')
        break
      default:
        convertedWords = words.join('')
    }

    return `${leadingWhitespace}${convertedWords}${trailingWhitespace}`
  })
}

function toAlternatingCase(value) {
  let uppercaseNext = false
  return getGraphemes(value).map((grapheme) => {
    if (!/\p{L}/u.test(grapheme)) return grapheme
    const converted = uppercaseNext ? grapheme.toLocaleUpperCase() : grapheme.toLocaleLowerCase()
    uppercaseNext = !uppercaseNext
    return converted
  }).join('')
}

function toInverseCase(value) {
  return getGraphemes(value).map((grapheme) => {
    if (isUppercase(grapheme)) return grapheme.toLocaleLowerCase()
    if (isLowercase(grapheme)) return grapheme.toLocaleUpperCase()
    return grapheme
  }).join('')
}

function convertText(value, format) {
  switch (format) {
    case 'upper':
      return value.toLocaleUpperCase()
    case 'lower':
      return value.toLocaleLowerCase()
    case 'title':
      return toTitleCase(value)
    case 'sentence':
      return toSentenceCase(value)
    case 'capitalized':
      return toCapitalizedCase(value)
    case 'camel':
    case 'pascal':
    case 'snake':
    case 'kebab':
    case 'constant':
      return toIdentifierCase(value, format)
    case 'alternating':
      return toAlternatingCase(value)
    case 'inverse':
      return toInverseCase(value)
    default:
      return value
  }
}

function countCharacters(value) {
  return getGraphemes(value).length
}

function countWords(value) {
  if (!value.trim()) return 0
  if (wordSegmenter) {
    let count = 0
    for (const segment of wordSegmenter.segment(value)) {
      if (segment.isWordLike) count += 1
    }
    return count
  }
  return value.match(/[\p{L}\p{M}\p{N}]+(?:['’\-‐‑‒–][\p{L}\p{M}\p{N}]+)*/gu)?.length ?? 0
}

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'

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
      {isError ? <AlertCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0" /> : <Check aria-hidden="true" size={17} className="mt-0.5 shrink-0" />}
      <p>{status.message}</p>
    </div>
  )
}

function downloadText(value) {
  const blob = new Blob([value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'text-case-converted.txt'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

export default function TextCaseConverter() {
  const [text, setText] = useState('')
  const [format, setFormat] = useState('upper')
  const [status, setStatus] = useState(null)
  const convertedText = useMemo(() => convertText(text, format), [text, format])
  const inputStats = useMemo(() => ({
    characters: countCharacters(text),
    words: countWords(text),
  }), [text])
  const outputStats = useMemo(() => ({
    characters: countCharacters(convertedText),
    words: countWords(convertedText),
  }), [convertedText])

  const updateText = (nextText) => {
    setText(nextText)
    setStatus(null)
  }

  const copyConvertedText = async () => {
    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }
    try {
      await navigator.clipboard.writeText(convertedText)
      setStatus({ type: 'success', message: 'Converted text copied to the clipboard.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the text. Check clipboard permissions and try again.' })
    }
  }

  const downloadConvertedText = () => {
    try {
      downloadText(convertedText)
      setStatus({ type: 'success', message: 'Converted text downloaded as a TXT file.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? `Could not download the text: ${error.message}` : 'Could not download the text file.',
      })
    }
  }

  const swapConvertedText = () => {
    if (!convertedText) return
    setText(convertedText)
    setStatus({ type: 'success', message: 'Converted text moved into the input. It will update using the selected format.' })
  }

  const clearText = () => {
    setText('')
    setStatus(null)
  }

  return (
    <>
      <PageMetadata
        title="Text Case Converter - Change Text to Uppercase, Lowercase & More"
        description="Convert text to uppercase, lowercase, title case, sentence case, camelCase, snake_case and more. Copy or download results instantly; your text stays in your browser."
      />
      <div className="mx-auto max-w-7xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Text Case Converter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Change text to uppercase, lowercase, title case, camelCase, and more.
            Results update instantly as you type, right in your browser.
          </p>
        </header>

        <section aria-label="Text case converter" className="tool-surface-raised p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="case-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="case-input-heading" className="font-semibold text-slate-950">Input text</h2>
                  <p className="mt-1 text-sm text-slate-500">Type or paste text to convert.</p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {inputStats.characters} characters · {inputStats.words} words
                </p>
              </div>
              <label htmlFor="case-converter-input" className="sr-only">Text to convert</label>
              <textarea
                id="case-converter-input"
                value={text}
                onChange={(event) => updateText(event.target.value)}
                placeholder="Type or paste your text here..."
                spellCheck="true"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="case-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="case-output-heading" className="font-semibold text-slate-950">Converted text</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {CASE_FORMATS.find(({ id }) => id === format)?.label}
                  </p>
                </div>
                <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {outputStats.characters} characters · {outputStats.words} words
                </p>
              </div>
              <label htmlFor="case-converter-output" className="sr-only">Converted text output</label>
              <textarea
                id="case-converter-output"
                value={convertedText}
                readOnly
                placeholder="Your converted text will appear here..."
                spellCheck="false"
                className="tool-editor mt-3 min-h-64 w-full resize-y p-4 text-base leading-7 read-only:cursor-text read-only:focus:border-indigo-500 sm:min-h-80"
              />
            </section>
          </div>

          <section aria-labelledby="case-format-heading" className="mt-6 border-t border-indigo-100 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="case-format-heading" className="font-semibold text-slate-950">Choose a text format</h2>
                <p className="mt-1 text-sm text-slate-500">The converted panel updates immediately.</p>
              </div>
              <span className="text-xs font-medium text-indigo-700">
                {CASE_FORMATS.find(({ id }) => id === format)?.description}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {CASE_FORMATS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={format === id}
                  onClick={() => {
                    setFormat(id)
                    setStatus(null)
                  }}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                    format === id
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button
              type="button"
              onClick={copyConvertedText}
              disabled={!convertedText}
              className="tool-primary-button"
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy converted text
            </button>
            <button
              type="button"
              onClick={downloadConvertedText}
              disabled={!convertedText}
              className="tool-secondary-button"
            >
              <ArrowDownToLine aria-hidden="true" size={16} />
              Download TXT
            </button>
            <button
              type="button"
              onClick={swapConvertedText}
              disabled={!convertedText}
              className="tool-secondary-button"
            >
              <ArrowLeftRight aria-hidden="true" size={16} />
              Use output as input
            </button>
            <button
              type="button"
              onClick={clearText}
              disabled={!text}
              className="tool-secondary-button"
            >
              <Eraser aria-hidden="true" size={16} />
              Clear
            </button>
          </div>

          {status && <StatusMessage status={status} />}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-text-case-converter">
            <h2 id="about-text-case-converter" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert text case online
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Change text between uppercase, lowercase, title case, sentence case,
              capitalized case, camelCase, PascalCase, snake_case, kebab-case,
              CONSTANT_CASE, alternating case, and inverse case. Enter text once
              and select a format to see the result immediately. Copy it, download
              a TXT file, or use the converted output as the next input.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Standard case changes preserve punctuation, spaces, and line breaks.
              Identifier formats normalize words and separators within each line,
              while keeping line breaks in place. Unicode letters are case-converted
              using the browser’s locale-aware JavaScript casing.
            </p>
          </section>

          <section aria-labelledby="text-case-faq">
            <h2 id="text-case-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I convert text to uppercase or lowercase?', 'Enter or paste text, then choose UPPERCASE or lowercase. The result changes instantly and keeps the original punctuation and line breaks.'],
                ['What is the difference between Title Case and Capitalized Case?', 'Title Case capitalizes each word and lowercases its remaining letters. Capitalized Case changes only the first letter of each word and leaves the rest of each word as entered.'],
                ['How are camelCase and snake_case created?', 'Words are identified from spaces, punctuation, underscores, hyphens, and common existing camel-case boundaries. camelCase joins them without separators; snake_case joins lowercase words with underscores. Each input line stays on its own line.'],
                ['Does the converter support Unicode?', 'Yes. It uses JavaScript Unicode-aware, locale-sensitive casing and keeps punctuation and non-letter symbols. Some letters can change into more than one character when their uppercase or lowercase form expands.'],
                ['Can I convert multiple lines?', 'Yes. Every format processes multi-line text. Standard case formats keep whitespace as entered, and identifier formats transform each line separately while retaining its line break.'],
                ['Is my text uploaded or stored?', 'No. Conversion, word and character counts, copying, and TXT download are handled in your browser. The tool does not upload your text to a processing server.'],
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
