import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Eraser,
  Regex as RegexIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const FLAGS = [
  { flag: 'g', name: 'Global', description: 'Find every match instead of stopping after the first.' },
  { flag: 'i', name: 'Ignore case', description: 'Match letters without distinguishing uppercase and lowercase.' },
  { flag: 'm', name: 'Multiline', description: 'Make ^ and $ match the beginning and end of each line.' },
  { flag: 's', name: 'DotAll', description: 'Allow . to match line terminators.' },
  { flag: 'u', name: 'Unicode', description: 'Use Unicode-aware matching and code point advancement.' },
  { flag: 'y', name: 'Sticky', description: 'Require a match exactly at the current lastIndex position.' },
]

const EXAMPLES = [
  {
    title: 'Words',
    description: 'Find whole words made of letters, digits, or underscores.',
    pattern: '\\b\\w+\\b',
    flags: ['g'],
    text: 'Regex tools make repeated text checks much easier.',
  },
  {
    title: 'Email-like text',
    description: 'Find common email-shaped strings (not full address validation).',
    pattern: '[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}',
    flags: ['g', 'i'],
    text: 'Contact dev@example.com or support+tools@quick.test.',
  },
  {
    title: 'Named captures',
    description: 'Capture the username and domain in separate named groups.',
    pattern: '(?<user>[\\w.-]+)@(?<domain>[\\w.-]+)',
    flags: ['g', 'i'],
    text: 'Emails: ada@example.com and lee@quick.test',
  },
  {
    title: 'ISO dates',
    description: 'Find dates in YYYY-MM-DD form.',
    pattern: '\\b(\\d{4})-(\\d{2})-(\\d{2})\\b',
    flags: ['g'],
    text: 'Release dates: 2026-11-26 and 2027-01-05.',
  },
  {
    title: 'Lookahead',
    description: 'Find numbers only when followed by a space and USD.',
    pattern: '\\d+(?= USD)',
    flags: ['g'],
    text: 'Prices: 12 USD, 45 EUR, and 300 USD.',
  },
  {
    title: 'Multiline starts',
    description: 'Match non-empty lines using the multiline flag.',
    pattern: '^.+$',
    flags: ['g', 'm'],
    text: 'First line\nSecond line\nThird line',
  },
]

function renderHighlightedText(text, matches) {
  const parts = []
  let cursor = 0

  matches.forEach((match, matchIndex) => {
    const start = Math.max(cursor, Math.min(match.index, text.length))
    const end = Math.max(start, Math.min(match.endIndex, text.length))

    if (start > cursor) {
      parts.push(text.slice(cursor, start))
    }

    if (end > start) {
      parts.push(
        <mark
          key={`match-${matchIndex}`}
          className="rounded bg-amber-200 px-0.5 text-slate-950 decoration-transparent"
        >
          {text.slice(start, end)}
        </mark>,
      )
    } else {
      parts.push(
        <span
          key={`zero-${matchIndex}`}
          aria-label={`Zero-width match at index ${match.index}`}
          className="mx-px inline-block h-[1.1em] align-middle border-l-2 border-fuchsia-600"
        />,
      )
    }

    cursor = Math.max(cursor, end)
  })

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : Check

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

export default function RegexTester() {
  const [pattern, setPattern] = useState('')
  const [testText, setTestText] = useState('')
  const [flags, setFlags] = useState(['g'])
  const [result, setResult] = useState(null)
  const [isTesting, setIsTesting] = useState(false)
  const [status, setStatus] = useState(null)
  const flagString = useMemo(
    () => FLAGS.filter(({ flag }) => flags.includes(flag)).map(({ flag }) => flag).join(''),
    [flags],
  )

  useEffect(() => {
    let worker = null
    let timeoutId = null
    let requestId = 0
    let active = true

    if (pattern === '') {
      setIsTesting(false)
      setResult({ pattern, testText, flagString, matches: [], truncated: false, error: null })
      return undefined
    }

    setIsTesting(true)
    setStatus(null)
    const debounceId = window.setTimeout(() => {
      requestId = Date.now()
      try {
        worker = new Worker(
          new URL('../workers/regexTesterWorker.js', import.meta.url),
          { type: 'module' },
        )
      } catch {
        setResult({
          pattern,
          testText,
          flagString,
          matches: [],
          truncated: false,
          error: 'Could not start the regex worker. Check that your browser allows local workers.',
        })
        setIsTesting(false)
        return
      }

      const finish = (nextResult) => {
        if (!active) return
        active = false
        window.clearTimeout(timeoutId)
        worker?.terminate()
        setResult({ pattern, testText, flagString, ...nextResult })
        setIsTesting(false)
      }

      worker.onmessage = (event) => {
        if (event.data.id !== requestId) return
        finish(event.data)
      }
      worker.onerror = () => {
        finish({
          matches: [],
          truncated: false,
          error: 'The regex worker failed. Try a simpler pattern or reload the page.',
        })
      }
      timeoutId = window.setTimeout(() => {
        finish({
          matches: [],
          truncated: false,
          error: 'This pattern took too long to evaluate. Try simplifying it or using shorter test text.',
        })
      }, 1200)
      worker.postMessage({ id: requestId, pattern, flags: flagString, text: testText })
    }, 120)

    return () => {
      active = false
      window.clearTimeout(debounceId)
      window.clearTimeout(timeoutId)
      worker?.terminate()
    }
  }, [pattern, testText, flagString])

  const currentResult = result
    && result.pattern === pattern
    && result.testText === testText
    && result.flagString === flagString
    ? result
    : null
  const matches = currentResult?.matches ?? []
  const hasPattern = pattern.length > 0
  const matchCountLabel = `${currentResult?.truncated ? 'At least ' : ''}${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`

  const toggleFlag = (flag) => {
    setFlags((currentFlags) =>
      currentFlags.includes(flag)
        ? currentFlags.filter((currentFlag) => currentFlag !== flag)
        : FLAGS.filter(({ flag: availableFlag }) =>
          currentFlags.includes(availableFlag) || availableFlag === flag,
        ).map(({ flag: selectedFlag }) => selectedFlag),
    )
  }

  const loadExample = (example) => {
    setPattern(example.pattern)
    setTestText(example.text)
    setFlags(example.flags)
    setStatus({ type: 'success', message: `${example.title} example loaded.` })
  }

  const clearAll = () => {
    setPattern('')
    setTestText('')
    setFlags(['g'])
    setResult(null)
    setIsTesting(false)
    setStatus(null)
  }

  const copyText = async (value, successMessage) => {
    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setStatus({ type: 'success', message: successMessage })
    } catch {
      setStatus({ type: 'error', message: 'Could not copy to the clipboard. Check browser permissions and try again.' })
    }
  }

  const copyRegex = () => copyText(`/${pattern}/${flagString}`, 'Regular expression copied.')
  const copyMatches = () => copyText(
    JSON.stringify(matches, null, 2),
    'Match results copied as JSON.',
  )

  return (
    <>
      <PageMetadata
        title="Regex Tester - Online Regular Expression Tester"
        description="Test JavaScript regular expressions against multiline text. Inspect matches, positions, capture groups, and flags with safe highlighting in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Regex Tester</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Test JavaScript regular expressions, inspect capture groups, and
            highlight matches in your text. Everything runs locally in your browser.
          </p>
        </header>

        <section aria-label="Regular expression tester" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="regex-pattern" className="font-semibold text-slate-950">
                Regular expression
              </label>
              <div className="mt-2 flex min-w-0 items-center rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
                <span aria-hidden="true" className="pl-3 font-mono text-lg text-slate-400">/</span>
                <input
                  id="regex-pattern"
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  placeholder="Try: (?<user>\\w+)@(?<domain>\\w+\\.\\w+)"
                  spellCheck="false"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="min-w-0 flex-1 border-0 bg-transparent px-2 py-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <span aria-hidden="true" className="pr-1 font-mono text-lg text-slate-400">/</span>
                <span aria-label={`Flags: ${flagString || 'none'}`} className="min-w-8 pr-3 font-mono text-sm font-semibold text-indigo-700">
                  {flagString}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={copyRegex}
              disabled={!hasPattern}
              className="tool-secondary-button px-3"
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy regex
            </button>
          </div>

          <div className="mt-5">
            <h2 className="font-semibold text-slate-950">Flags</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {FLAGS.map(({ flag, name, description }) => {
                const isSelected = flags.includes(flag)
                return (
                  <button
                    key={flag}
                    type="button"
                    aria-label={`${flag} — ${name}: ${description}`}
                    aria-pressed={isSelected}
                    title={description}
                    onClick={() => toggleFlag(flag)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono font-bold">{flag}</span>
                    <span>{name}</span>
                  </button>
                )
              })}
            </div>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              {FLAGS.map(({ flag, name, description }) => (
                <li key={flag}><span className="font-mono font-semibold text-slate-800">{flag}</span> — {name}: {description}</li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="regex-test-text-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <label htmlFor="regex-test-text" id="regex-test-text-heading" className="font-semibold text-slate-950">
                  Test text
                </label>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {testText.length} characters · {testText ? testText.split(/\r\n|\r|\n/).length : 0} lines
                </span>
              </div>
              <textarea
                id="regex-test-text"
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
                placeholder="Paste or type text to test your pattern..."
                spellCheck="false"
                className="tool-editor mt-2 min-h-56 w-full resize-y p-4 sm:min-h-72"
              />
            </section>

            <section aria-labelledby="regex-highlight-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="regex-highlight-heading" className="font-semibold text-slate-950">Highlighted preview</h2>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {currentResult && !currentResult.error
                    ? matchCountLabel
                    : isTesting ? 'Testing…' : '0 matches'}
                </span>
              </div>
              <pre
                aria-label="Highlighted test text"
                className="tool-editor mt-2 min-h-56 max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-sm leading-6 sm:min-h-72"
              >
                {testText || matches.some((match) => match.value === '')
                  ? renderHighlightedText(testText, matches)
                  : <span className="text-slate-400">Your test text will appear here with matches highlighted.</span>}
              </pre>
            </section>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyMatches}
                disabled={!currentResult || Boolean(currentResult.error) || matches.length === 0}
                className="tool-secondary-button"
              >
                <ClipboardCopy aria-hidden="true" size={16} />
                Copy match results
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!pattern && !testText && !status && flags.length === 1 && flags[0] === 'g'}
                className="tool-secondary-button"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
            <span className="text-sm font-medium text-slate-600" aria-live="polite">
              {currentResult && !currentResult.error
                ? matchCountLabel
                : isTesting ? 'Evaluating pattern…' : 'Waiting for a pattern'}
            </span>
          </div>

          {currentResult?.error && (
            <div className="mt-4">
              <StatusMessage status={{ type: 'error', message: currentResult.error }} />
            </div>
          )}
          {status && <div className="mt-4"><StatusMessage status={status} /></div>}

          {currentResult && !currentResult.error && currentResult.truncated && (
            <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Showing the first 5,000 matches to keep the page responsive. Refine the pattern to see fewer results.
            </p>
          )}

          <section aria-labelledby="regex-matches-heading" className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="regex-matches-heading" className="text-lg font-semibold text-slate-950">Match details</h2>
              <span className="text-xs text-slate-500">Index is zero-based; line and column are one-based.</span>
            </div>
            {currentResult?.error ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Fix the pattern to see match details.
              </p>
            ) : matches.length ? (
              <ol className="mt-3 grid gap-3">
                {matches.map((match, index) => (
                  <li key={`${match.index}-${index}`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-slate-950">Match {index + 1}</h3>
                      <p className="text-xs tabular-nums text-slate-500">
                        Index {match.index} · Line {match.position.line}, column {match.position.column}
                      </p>
                    </div>
                    <code className="mt-3 block overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-amber-50 p-3 font-mono text-sm text-slate-900">
                      {match.value === '' ? '(empty string)' : match.value}
                    </code>
                    {(match.captures.length > 0 || match.namedCaptures.length > 0) && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {match.captures.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capture groups</h4>
                            <ul className="mt-1 space-y-1 text-sm">
                              {match.captures.map(({ number, value }) => (
                                <li key={number} className="break-words">
                                  <span className="font-mono text-slate-500">${number}: </span>
                                  <span className="font-mono text-slate-800">{value ?? '(unmatched)'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {match.namedCaptures.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Named groups</h4>
                            <ul className="mt-1 space-y-1 text-sm">
                              {match.namedCaptures.map(({ name, value }) => (
                                <li key={name} className="break-words">
                                  <span className="font-mono text-slate-500">{name}: </span>
                                  <span className="font-mono text-slate-800">{value ?? '(unmatched)'}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {pattern === ''
                  ? 'Enter a pattern to test. A blank pattern is not evaluated.'
                  : isTesting
                    ? 'Checking your pattern and test text…'
                    : 'No matches found.'}
              </p>
            )}
          </section>

          <section aria-label="Regex performance note" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <AlertCircle aria-hidden="true" size={17} className="mt-1 shrink-0" />
            <p>
              Complex patterns can be expensive. Matching runs in a separate worker and is stopped after 1.2 seconds;
              if that happens, simplify the expression or shorten the test text.
            </p>
          </section>
        </section>

        <section aria-labelledby="regex-examples-heading" className="mx-auto mt-10 max-w-5xl">
          <h2 id="regex-examples-heading" className="text-xl font-bold tracking-tight text-slate-950">
            Common regex examples
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLES.map((example) => (
              <article key={example.title} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-semibold text-slate-950">{example.title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">{example.description}</p>
                <code className="mt-3 block break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-indigo-900">
                  {example.pattern}
                </code>
                <button type="button" onClick={() => loadExample(example)} className="tool-secondary-button mt-3 px-3">
                  <RegexIcon aria-hidden="true" size={15} />
                  Load example
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto mt-14 max-w-4xl space-y-10">
          <section aria-labelledby="regex-tester-about">
            <h2 id="regex-tester-about" className="text-2xl font-bold tracking-tight text-slate-950">
              Test JavaScript Regular Expressions
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              A regular expression describes a pattern used to find or inspect text.
              Use the tester to try a JavaScript pattern against sample or pasted
              multiline text, then review each match, its position, and numbered or
              named capture groups. Matching stays in your browser and does not
              validate input for any particular application.
            </p>
          </section>
          <section aria-labelledby="regex-faq">
            <h2 id="regex-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Which regular expression flavor is supported?', 'The tester uses the native JavaScript RegExp engine in your browser. Syntax and flags follow the JavaScript runtime.'],
                ['How are match positions shown?', 'Each match shows a zero-based UTF-16 index and a one-based line and column. Capture groups are listed by number and, when present, by name.'],
                ['What does the global flag do?', 'The g flag finds successive non-overlapping matches. Without it, only the first match is returned. Zero-length global matches advance safely to avoid loops.'],
                ['Can a regular expression freeze the page?', 'Complex patterns may take a long time. Evaluation runs in a separate worker, which is stopped after 1.2 seconds. Simplifying the pattern or reducing test text can help.'],
                ['Does the tester validate or execute matched text?', 'No. It only applies a regular expression to text locally. Highlighted content is rendered as text and is never executed as HTML.'],
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
