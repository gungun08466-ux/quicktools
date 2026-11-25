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

const SAMPLE_TEXT = `Clear writing starts with clear ideas. A quick word count can help you plan an article, check an assignment, or prepare a speech.

Paste or type your text here, and the statistics update as you write. Numbers, punctuation, and common Unicode characters are counted right in your browser.`

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

function countParagraphs(value) {
  if (!value.trim()) return 0
  return value
    .trim()
    .split(/\r?\n(?:[ \t]*\r?\n)+/u)
    .filter((paragraph) => paragraph.trim()).length
}

function getStatistics(value) {
  const words = countWords(value)
  return {
    words,
    characters: countGraphemes(value),
    charactersWithoutSpaces: countGraphemes(value.replace(/\s/gu, '')),
    sentences: countSentences(value),
    paragraphs: countParagraphs(value),
    readingTime: words === 0 ? 0 : Math.ceil((words / 200) * 60),
    speakingTime: words === 0 ? 0 : Math.ceil((words / 130) * 60),
  }
}

function formatTime(seconds) {
  if (seconds === 0) return '0 min'
  if (seconds < 60) return '<1 min'
  return `${Math.ceil(seconds / 60)} min`
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

export default function WordCounter() {
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
    { label: 'Words', value: statistics.words },
    { label: 'Characters (with spaces)', value: statistics.characters },
    { label: 'Characters (without spaces)', value: statistics.charactersWithoutSpaces },
    { label: 'Sentences', value: statistics.sentences },
    { label: 'Paragraphs', value: statistics.paragraphs },
    { label: 'Reading time', value: formatTime(statistics.readingTime) },
    { label: 'Speaking time', value: formatTime(statistics.speakingTime) },
  ]

  return (
    <>
      <PageMetadata
        title="Word Counter - Count Words, Characters, and Sentences"
        description="Count words, characters, sentences, and paragraphs instantly with this free online word counter. Estimate reading and speaking time; your text stays in your browser."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <FileText aria-hidden="true" size={16} />
            Private, browser-based text counting
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Word Counter
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Count words, characters, sentences, and paragraphs as you type.
            Estimate reading and speaking time without sending your text anywhere.
          </p>
        </header>

        <section aria-label="Word counter" className="mx-auto mt-8 max-w-4xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <label htmlFor="word-counter-text" className="block font-semibold text-slate-950">
              Enter or paste your text
            </label>
            <p id="word-counter-help" className="mt-1 text-sm text-slate-500">
              Statistics update instantly. Your text is processed only in this browser.
            </p>
            <textarea
              id="word-counter-text"
              value={text}
              onChange={(event) => updateText(event.target.value)}
              aria-describedby="word-counter-help"
              placeholder="Start typing or paste your text here…"
              spellCheck="true"
              className="mt-4 min-h-72 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 text-base leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:min-h-96"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateText('')}
                disabled={!text}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear text
              </button>
              <button
                type="button"
                onClick={copyText}
                disabled={!text}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardCopy aria-hidden="true" size={16} />
                Copy text
              </button>
              <button
                type="button"
                onClick={() => updateText(SAMPLE_TEXT)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <FileText aria-hidden="true" size={16} />
                Sample text
              </button>
            </div>
            <StatusMessage status={status} />
          </div>

          <section aria-labelledby="word-statistics-heading" className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="word-statistics-heading" className="font-semibold text-slate-950">
                  Text statistics
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Counts refresh as you type.
                </p>
              </div>
              <p className="text-sm text-slate-500" aria-live="polite">
                {statistics.characters} {statistics.characters === 1 ? 'character typed' : 'characters typed'}
              </p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {stats.map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <dt className="text-sm leading-5 text-slate-500">{label}</dt>
                  <dd className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-word-counter">
            <h2 id="about-word-counter" className="text-2xl font-bold tracking-tight text-slate-950">
              Count words and characters as you write
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use the word counter to check a draft, assignment, article, or speech. Words are identified with your browser’s language-aware text segmentation, while character totals count visible Unicode characters, including spaces and line breaks. Paragraphs are separated by blank lines.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Reading time is estimated at 200 words per minute and speaking time at 130 words per minute. These are general averages; actual pace varies by reader, speaker, and subject.
            </p>
          </section>

          <section aria-labelledby="word-counter-faq">
            <h2 id="word-counter-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How does this word counter count words?', 'It uses the browser’s language-aware word segmentation when available, so punctuation and common Unicode writing systems are handled more reliably than simply splitting on spaces.'],
                ['Do multiple spaces or newlines count as words?', 'No. Whitespace by itself is not a word. Newlines and spaces count as characters, but blank lines separate paragraphs.'],
                ['What is the difference between the character counts?', 'The “with spaces” count includes spaces, tabs, and line breaks. The “without spaces” count excludes whitespace. Both count visible Unicode characters rather than UTF-16 code units.'],
                ['How are sentences and paragraphs counted?', 'Sentence count uses browser sentence segmentation. Paragraphs are non-empty text blocks separated by one or more blank lines.'],
                ['How accurate are the time estimates?', 'Reading time uses 200 words per minute and speaking time uses 130 words per minute. These estimates are approximate and do not account for pauses or individual pace.'],
                ['Is my text uploaded or stored?', 'No. Counting and text actions run in your browser. The tool does not send or store your text on a QuickTools processing server.'],
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
