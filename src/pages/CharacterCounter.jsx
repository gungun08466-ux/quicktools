import { ClipboardCopy, Eraser, FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const wordSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : null
const sentenceSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
  : null
const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function countGraphemes(value) {
  if (!value) return 0
  if (graphemeSegmenter) {
    let count = 0
    for (const _segment of graphemeSegmenter.segment(value)) count += 1
    return count
  }
  return Array.from(value).length
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
  return value.match(/[\p{L}\p{N}\p{M}]+(?:['’\-‐‑‒–][\p{L}\p{N}\p{M}]+)*/gu)?.length ?? 0
}

function countSentences(value) {
  if (!value.trim()) return 0
  if (sentenceSegmenter) {
    let count = 0
    for (const segment of sentenceSegmenter.segment(value)) {
      if (segment.segment.trim()) count += 1
    }
    return count
  }
  return value.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/gu)
    ?.filter((sentence) => sentence.trim()).length ?? 0
}

function getStatistics(value) {
  if (!value) {
    return {
      characters: 0,
      charactersWithoutSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
    }
  }

  const paragraphs = value
    .split(/(?:\r\n|\r|\n)[\t ]*(?:(?:\r\n|\r|\n)[\t ]*)+/u)
    .filter((paragraph) => paragraph.trim()).length

  return {
    characters: countGraphemes(value),
    charactersWithoutSpaces: countGraphemes(value.replace(/\s/gu, '')),
    words: countWords(value),
    sentences: countSentences(value),
    paragraphs,
    lines: value.split(/\r\n|\r|\n/u).length,
  }
}

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'

  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      {status.message}
    </p>
  )
}

export default function CharacterCounter() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(null)
  const statistics = useMemo(() => getStatistics(text), [text])

  const updateText = (nextText) => {
    setText(nextText)
    setStatus(null)
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setStatus({ type: 'success', message: 'Text copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the text. Check clipboard permissions and try again.',
      })
    }
  }

  const stats = [
    { label: 'Characters (with spaces)', note: 'including spaces, tabs, and line breaks', value: statistics.characters },
    { label: 'Characters (without spaces)', note: 'excluding all whitespace', value: statistics.charactersWithoutSpaces },
    { label: 'Words', note: 'in your text', value: statistics.words },
    { label: 'Sentences', note: 'in your text', value: statistics.sentences },
    { label: 'Paragraphs', note: 'separated by blank lines', value: statistics.paragraphs },
    { label: 'Lines', note: 'including blank lines', value: statistics.lines },
  ]

  return (
    <>
      <PageMetadata
        title="Character Counter - Count Characters, Words & Lines"
        description="Use this free character counter to instantly count characters with or without spaces, words, sentences, paragraphs, and lines. Your text stays in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Character Counter</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Count characters, words, sentences, paragraphs, and lines as you type.
            Private, instant, and free to use.
          </p>
        </header>

        <section aria-label="Character counter" className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <div className="tool-surface-raised p-4 sm:p-6">
            <label htmlFor="character-counter-text" className="block font-semibold text-slate-950">
              Your text
            </label>
            <p id="character-counter-help" className="mt-1 text-sm text-slate-500">
              Statistics update instantly. Your text is processed only in this browser.
            </p>
            <textarea
              id="character-counter-text"
              value={text}
              onChange={(event) => updateText(event.target.value)}
              aria-describedby="character-counter-help"
              placeholder="Start typing or paste your text here..."
              spellCheck="true"
              className="tool-editor mt-4 min-h-72 w-full resize-y p-4 text-base leading-7 sm:min-h-96"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateText('')}
                disabled={!text}
                className="tool-secondary-button"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear text
              </button>
              <button
                type="button"
                onClick={copyText}
                disabled={!text}
                className="tool-secondary-button"
              >
                <ClipboardCopy aria-hidden="true" size={16} />
                Copy text
              </button>
            </div>
            <StatusMessage status={status} />
          </div>

          <section aria-labelledby="character-statistics-heading" className="tool-surface p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <FileText aria-hidden="true" size={19} />
              </span>
              <div>
                <h2 id="character-statistics-heading" className="font-semibold text-slate-950">
                  Text statistics
                </h2>
                <p className="mt-1 text-sm text-slate-500">A live breakdown of your text.</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {stats.map(({ label, note, value }) => (
                <div key={`${label}-${note}`} className="tool-stat-tile">
                  <dt className="text-sm font-medium leading-5 text-slate-600">{label}</dt>
                  <dd className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-950" aria-live="polite">
                    {value}
                  </dd>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
                </div>
              ))}
            </dl>
          </section>
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-character-counter">
            <h2 id="about-character-counter" className="text-2xl font-bold tracking-tight text-slate-950">
              A simple, accurate character counter
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use this character counter to check a post, essay, message, or any other draft.
              Counts refresh while you type, with no upload or sign-in required. Character
              totals count visible Unicode characters, including spaces and line breaks;
              the excluding-spaces count omits all whitespace. Words and sentences use
              language-aware browser text segmentation when available.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Lines are separated by line breaks, including blank lines. Paragraphs are
              non-empty blocks separated by one or more blank lines.
            </p>
          </section>

          <section aria-labelledby="character-counter-faq">
            <h2 id="character-counter-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How does this character counter work?', 'It counts text directly in your browser and updates the statistics as you type or paste. Nothing is sent to a text-processing server.'],
                ['Does the character count include spaces?', 'Yes. The first count includes spaces, tabs, and line breaks. The second count excludes all whitespace.'],
                ['How are words counted?', 'The counter uses your browser’s language-aware word segmentation when available, so whitespace and punctuation alone are not treated as words.'],
                ['What counts as a line or paragraph?', 'Every line break starts a new line, including empty lines. A paragraph is a non-empty block of text separated from another block by one or more blank lines.'],
                ['How are sentences counted?', 'Sentence count uses browser sentence segmentation when available and excludes whitespace-only segments.'],
                ['Is my text stored or uploaded?', 'No. The text is counted locally in your browser and is not uploaded or stored by this tool.'],
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
