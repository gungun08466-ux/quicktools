import {
  ArrowLeftRight,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  FileDiff,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const MAX_INPUT_CHARS = 100_000
const MAX_LINES = 5_000
const MAX_DIFF_STEPS = 1_000_000
const MAX_TRACE_ENTRIES = 250_000
const MAX_WORD_DIFF_CHARACTERS = 20_000
const MAX_WORD_DIFF_TOKENS = 4_000
const INITIAL_VISIBLE_ROWS = 250

function splitLines(text) {
  return text === '' ? [] : text.split(/\r\n|\n|\r/u)
}

function normalizeValue(value, options) {
  let normalized = value
  if (options.ignoreWhitespace) normalized = normalized.replace(/\s+/gu, '')
  if (options.ignoreCase) normalized = normalized.toLowerCase()
  return normalized
}

function myersDiff(original, modified, equals) {
  const vector = new Map([[1, 0]])
  const trace = []
  let work = 0
  let traceEntries = 0
  let distanceFound = -1

  for (let distance = 0; distance <= original.length + modified.length; distance += 1) {
    traceEntries += vector.size
    if (traceEntries > MAX_TRACE_ENTRIES) return null
    trace.push(new Map(vector))

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      work += 1
      if (work > MAX_DIFF_STEPS) return null

      const moveDown = diagonal === -distance
        || (diagonal !== distance
          && (vector.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY)
            < (vector.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
      let x = moveDown
        ? vector.get(diagonal + 1) ?? 0
        : (vector.get(diagonal - 1) ?? 0) + 1
      let y = x - diagonal

      while (x < original.length && y < modified.length && equals(original[x], modified[y])) {
        x += 1
        y += 1
        work += 1
        if (work > MAX_DIFF_STEPS) return null
      }

      vector.set(diagonal, x)
      if (x >= original.length && y >= modified.length) {
        distanceFound = distance
        break
      }
    }

    if (distanceFound >= 0) break
  }

  if (distanceFound < 0) return null

  const operations = []
  let x = original.length
  let y = modified.length

  for (let distance = distanceFound; distance >= 0; distance -= 1) {
    const previousVector = trace[distance]
    const diagonal = x - y
    const moveDown = diagonal === -distance
      || (diagonal !== distance
        && (previousVector.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY)
          < (previousVector.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY))
    const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1
    const previousX = previousVector.get(previousDiagonal) ?? 0
    const previousY = previousX - previousDiagonal

    while (x > previousX && y > previousY) {
      operations.push({
        type: 'equal',
        original: original[x - 1],
        modified: modified[y - 1],
      })
      x -= 1
      y -= 1
    }

    if (distance === 0) break
    if (x === previousX) {
      operations.push({ type: 'add', modified: modified[y - 1] })
      y -= 1
    } else {
      operations.push({ type: 'remove', original: original[x - 1] })
      x -= 1
    }
  }

  while (x > 0 && y > 0) {
    operations.push({ type: 'equal', original: original[x - 1], modified: modified[y - 1] })
    x -= 1
    y -= 1
  }
  while (x > 0) {
    operations.push({ type: 'remove', original: original[x - 1] })
    x -= 1
  }
  while (y > 0) {
    operations.push({ type: 'add', modified: modified[y - 1] })
    y -= 1
  }

  return operations.reverse()
}

function diffSequences(original, modified, equals) {
  let prefixLength = 0
  while (
    prefixLength < original.length
    && prefixLength < modified.length
    && equals(original[prefixLength], modified[prefixLength])
  ) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < original.length - prefixLength
    && suffixLength < modified.length - prefixLength
    && equals(
      original[original.length - suffixLength - 1],
      modified[modified.length - suffixLength - 1],
    )
  ) {
    suffixLength += 1
  }

  const originalEnd = original.length - suffixLength
  const modifiedEnd = modified.length - suffixLength
  const originalMiddle = original.slice(prefixLength, originalEnd)
  const modifiedMiddle = modified.slice(prefixLength, modifiedEnd)
  let middleOperations
  let simplified = false

  if (originalMiddle.length === 0) {
    middleOperations = modifiedMiddle.map((value) => ({ type: 'add', modified: value }))
  } else if (modifiedMiddle.length === 0) {
    middleOperations = originalMiddle.map((value) => ({ type: 'remove', original: value }))
  } else {
    middleOperations = myersDiff(originalMiddle, modifiedMiddle, equals)
    if (!middleOperations) {
      simplified = true
      middleOperations = [
        ...originalMiddle.map((value) => ({ type: 'remove', original: value })),
        ...modifiedMiddle.map((value) => ({ type: 'add', modified: value })),
      ]
    }
  }

  const prefixOperations = Array.from({ length: prefixLength }, (_, index) => ({
    type: 'equal',
    original: original[index],
    modified: modified[index],
  }))
  const suffixOperations = Array.from({ length: suffixLength }, (_, index) => ({
    type: 'equal',
    original: original[originalEnd + index],
    modified: modified[modifiedEnd + index],
  }))

  return {
    operations: [...prefixOperations, ...middleOperations, ...suffixOperations],
    simplified,
  }
}

function tokenizeWords(line) {
  return line.match(/\s+|[\p{L}\p{N}\p{M}_]+|[^\s]/gu) ?? []
}

function buildDiffRows(operations, options) {
  const rows = []
  let originalLineNumber = 0
  let modifiedLineNumber = 0
  let wordDiffSimplified = false

  for (let index = 0; index < operations.length;) {
    const operation = operations[index]
    if (operation.type === 'equal') {
      originalLineNumber += 1
      modifiedLineNumber += 1
      rows.push({
        type: 'unchanged',
        original: operation.original,
        modified: operation.modified,
        originalLineNumber,
        modifiedLineNumber,
      })
      index += 1
      continue
    }

    const removed = []
    const added = []
    while (index < operations.length && operations[index].type !== 'equal') {
      const edit = operations[index]
      if (edit.type === 'remove') {
        originalLineNumber += 1
        removed.push({ text: edit.original, lineNumber: originalLineNumber })
      } else {
        modifiedLineNumber += 1
        added.push({ text: edit.modified, lineNumber: modifiedLineNumber })
      }
      index += 1
    }

    const pairedCount = Math.min(removed.length, added.length)
    for (let pairIndex = 0; pairIndex < pairedCount; pairIndex += 1) {
      let wordOperations = null
      if (options.highlightWords) {
        const oldLine = removed[pairIndex].text
        const newLine = added[pairIndex].text
        if (oldLine.length + newLine.length > MAX_WORD_DIFF_CHARACTERS) {
          wordDiffSimplified = true
        } else {
          const oldTokens = tokenizeWords(oldLine)
          const newTokens = tokenizeWords(newLine)
          if (oldTokens.length + newTokens.length > MAX_WORD_DIFF_TOKENS) {
            wordDiffSimplified = true
          } else {
            const wordDiff = diffSequences(
              oldTokens,
              newTokens,
              (left, right) => normalizeValue(left, options) === normalizeValue(right, options),
            )
            wordOperations = wordDiff.operations
            wordDiffSimplified ||= wordDiff.simplified
          }
        }
      }
      rows.push({
        type: 'modified',
        original: removed[pairIndex].text,
        modified: added[pairIndex].text,
        originalLineNumber: removed[pairIndex].lineNumber,
        modifiedLineNumber: added[pairIndex].lineNumber,
        wordOperations,
      })
    }

    for (let extraIndex = pairedCount; extraIndex < removed.length; extraIndex += 1) {
      rows.push({
        type: 'removed',
        original: removed[extraIndex].text,
        modified: '',
        originalLineNumber: removed[extraIndex].lineNumber,
        modifiedLineNumber: null,
      })
    }
    for (let extraIndex = pairedCount; extraIndex < added.length; extraIndex += 1) {
      rows.push({
        type: 'added',
        original: '',
        modified: added[extraIndex].text,
        originalLineNumber: null,
        modifiedLineNumber: added[extraIndex].lineNumber,
      })
    }
  }

  return {
    rows,
    wordDiffSimplified,
    statistics: {
      added: rows.filter((row) => row.type === 'added' || row.type === 'modified').length,
      removed: rows.filter((row) => row.type === 'removed' || row.type === 'modified').length,
      unchanged: rows.filter((row) => row.type === 'unchanged').length,
    },
  }
}

function compareTexts(originalText, modifiedText, options) {
  const originalLines = splitLines(originalText)
  const modifiedLines = splitLines(modifiedText)
  if (originalLines.length > MAX_LINES || modifiedLines.length > MAX_LINES) {
    return {
      error: `Each input can contain up to ${MAX_LINES.toLocaleString()} lines. Shorten the text to compare it.`,
      rows: [],
      statistics: { added: 0, removed: 0, unchanged: 0 },
      simplified: false,
      wordDiffSimplified: false,
    }
  }

  const lineDiff = diffSequences(
    originalLines,
    modifiedLines,
    (left, right) => normalizeValue(left, options) === normalizeValue(right, options),
  )
  const result = buildDiffRows(lineDiff.operations, options)
  return {
    ...result,
    error: '',
    simplified: lineDiff.simplified,
  }
}

function formatDiff(rows) {
  return rows.flatMap((row) => {
    if (row.type === 'unchanged') return [`  ${row.original}`]
    if (row.type === 'added') return [`+ ${row.modified}`]
    if (row.type === 'removed') return [`- ${row.original}`]
    return [`- ${row.original}`, `+ ${row.modified}`]
  }).join('\n')
}

function getCellClass(type, side) {
  if (type === 'unchanged') return 'bg-white text-slate-800'
  if (type === 'modified') return side === 'original' ? 'bg-red-50 text-red-950' : 'bg-emerald-50 text-emerald-950'
  if (type === 'removed') return side === 'original' ? 'bg-red-50 text-red-950' : 'bg-slate-50'
  return side === 'modified' ? 'bg-emerald-50 text-emerald-950' : 'bg-slate-50'
}

function renderLineContent(row, side, highlightWords) {
  if (row.type !== 'modified' || !highlightWords || !row.wordOperations) return row[side]

  return row.wordOperations.map((operation, index) => {
    const value = side === 'original' ? operation.original : operation.modified
    if (value === undefined) return null
    const changed = side === 'original' ? operation.type === 'remove' : operation.type === 'add'
    if (!changed) return <Fragment key={index}>{value}</Fragment>
    return (
      <mark
        key={index}
        className={`rounded-sm px-0.5 ${
          side === 'original'
            ? 'bg-red-200 text-red-950'
            : 'bg-emerald-200 text-emerald-950'
        }`}
      >
        {value}
      </mark>
    )
  })
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

export default function TextDiffChecker() {
  const [originalText, setOriginalText] = useState('')
  const [modifiedText, setModifiedText] = useState('')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [ignoreCase, setIgnoreCase] = useState(false)
  const [highlightWords, setHighlightWords] = useState(true)
  const [visibleRowLimit, setVisibleRowLimit] = useState(INITIAL_VISIBLE_ROWS)
  const [status, setStatus] = useState(null)

  const options = { ignoreWhitespace, ignoreCase, highlightWords }
  const analysis = useMemo(
    () => compareTexts(originalText, modifiedText, options),
    [originalText, modifiedText, ignoreWhitespace, ignoreCase, highlightWords],
  )
  const diffText = useMemo(() => formatDiff(analysis.rows), [analysis.rows])
  const visibleRows = analysis.rows.slice(0, visibleRowLimit)

  useEffect(() => {
    setVisibleRowLimit(INITIAL_VISIBLE_ROWS)
  }, [originalText, modifiedText, ignoreWhitespace, ignoreCase, highlightWords])

  const updateOriginalText = (value) => {
    setOriginalText(value)
    setStatus(null)
  }

  const updateModifiedText = (value) => {
    setModifiedText(value)
    setStatus(null)
  }

  const copyDiff = async () => {
    try {
      await navigator.clipboard.writeText(diffText)
      setStatus({ type: 'success', message: 'Diff copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the diff. Check clipboard permissions and try again.',
      })
    }
  }

  const downloadDiff = () => {
    if (!diffText) return
    const blob = new Blob([diffText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'text-diff.txt'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus({ type: 'success', message: 'Your text diff download has started.' })
  }

  const swapTexts = () => {
    setOriginalText(modifiedText)
    setModifiedText(originalText)
    setStatus(null)
  }

  const clearTexts = () => {
    setOriginalText('')
    setModifiedText('')
    setStatus(null)
  }

  const lineLimitReached = analysis.error !== ''

  return (
    <>
      <PageMetadata
        title="Text Diff Checker - Compare Text and Find Differences"
        description="Compare two text versions line by line, highlight added and removed lines and changed words, and ignore whitespace or letter case. Text stays in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Text Diff Checker</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Compare two text versions side by side. Find added, removed, unchanged, and modified words instantly—without sending text anywhere.
          </p>
        </header>

        <section aria-label="Text diff checker" className="tool-surface-raised space-y-5 p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="text-diff-original" className="font-semibold text-slate-950">Original Text</label>
                <span className="text-xs tabular-nums text-slate-500">{originalText.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}</span>
              </div>
              <textarea
                id="text-diff-original"
                value={originalText}
                maxLength={MAX_INPUT_CHARS}
                onChange={(event) => updateOriginalText(event.target.value)}
                placeholder="Paste or type the original text…"
                spellCheck="false"
                className="tool-editor mt-2 min-h-64 w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-80"
                aria-label="Original Text"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="text-diff-modified" className="font-semibold text-slate-950">Modified Text</label>
                <span className="text-xs tabular-nums text-slate-500">{modifiedText.length.toLocaleString()} / {MAX_INPUT_CHARS.toLocaleString()}</span>
              </div>
              <textarea
                id="text-diff-modified"
                value={modifiedText}
                maxLength={MAX_INPUT_CHARS}
                onChange={(event) => updateModifiedText(event.target.value)}
                placeholder="Paste or type the modified text…"
                spellCheck="false"
                className="tool-editor mt-2 min-h-64 w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-80"
                aria-label="Modified Text"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={swapTexts} disabled={!originalText && !modifiedText} className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              <ArrowLeftRight aria-hidden="true" size={16} />
              Swap texts
            </button>
            <button type="button" onClick={clearTexts} disabled={!originalText && !modifiedText} className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              <Eraser aria-hidden="true" size={16} />
              Clear
            </button>
            <span className="mx-1 hidden h-7 border-l border-slate-200 sm:block" aria-hidden="true" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={ignoreWhitespace}
                onChange={(event) => {
                  setIgnoreWhitespace(event.target.checked)
                  setStatus(null)
                }}
                className="size-4 accent-indigo-600"
              />
              Ignore whitespace
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={ignoreCase}
                onChange={(event) => {
                  setIgnoreCase(event.target.checked)
                  setStatus(null)
                }}
                className="size-4 accent-indigo-600"
              />
              Ignore case
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={highlightWords}
                onChange={(event) => {
                  setHighlightWords(event.target.checked)
                  setStatus(null)
                }}
                className="size-4 accent-indigo-600"
              />
              Highlight word changes
            </label>
          </div>
          <p className="-mt-3 text-xs leading-5 text-slate-500">
            Ignore whitespace removes whitespace characters within lines; line breaks remain significant. Each input supports up to 100,000 characters and 5,000 lines.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Added lines', value: analysis.statistics.added, color: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
              { label: 'Removed lines', value: analysis.statistics.removed, color: 'border-red-200 bg-red-50 text-red-900' },
              { label: 'Unchanged lines', value: analysis.statistics.unchanged, color: 'border-slate-200 bg-slate-50 text-slate-900' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl border p-4 ${color}`}>
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="-mt-2 text-xs text-slate-500">A modified line counts as one added line and one removed line.</p>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileDiff aria-hidden="true" size={18} className="text-indigo-700" />
              <h2 className="text-lg font-semibold text-slate-950">Line-by-line diff</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyDiff} disabled={!diffText || lineLimitReached} className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50">
                <ClipboardCopy aria-hidden="true" size={16} />
                Copy diff
              </button>
              <button type="button" onClick={downloadDiff} disabled={!diffText || lineLimitReached} className="tool-primary-button disabled:cursor-not-allowed disabled:opacity-50">
                <Download aria-hidden="true" size={16} />
                Download diff
              </button>
            </div>
          </div>

          {analysis.error ? (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {analysis.error}
            </div>
          ) : (
            <>
              {(analysis.simplified || analysis.wordDiffSimplified) && (
                <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {analysis.simplified
                    ? 'The texts differ substantially, so the comparison simplified this section to added and removed lines to keep the tool responsive.'
                    : 'Some long modified lines were simplified to full-line word changes to keep the tool responsive.'}
                </div>
              )}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100 text-sm font-semibold text-slate-800">
                  <div className="border-r border-slate-200 px-3 py-2.5">Original</div>
                  <div className="px-3 py-2.5">Modified</div>
                </div>
                {visibleRows.length === 0 ? (
                  <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">
                    {originalText || modifiedText ? 'The texts are identical under the selected options.' : 'Enter text in either panel to see the differences.'}
                  </div>
                ) : (
                  <div className="max-h-[34rem] overflow-auto">
                    <div className="grid grid-cols-2">
                      {visibleRows.map((row, index) => (
                        <Fragment key={`${row.type}-${row.originalLineNumber ?? 'x'}-${row.modifiedLineNumber ?? 'x'}-${index}`}>
                          {['original', 'modified'].map((side) => {
                            const lineNumber = side === 'original' ? row.originalLineNumber : row.modifiedLineNumber
                            return (
                              <div
                                key={side}
                                className={`flex min-h-9 min-w-0 items-start border-b border-slate-100 px-2 ${side === 'original' ? 'border-r' : ''} ${getCellClass(row.type, side)}`}
                              >
                                <span aria-hidden="true" className="w-10 shrink-0 select-none py-1 text-right font-mono text-xs text-slate-400">
                                  {lineNumber ?? ''}
                                </span>
                                <div className="min-w-0 flex-1 whitespace-pre-wrap break-words py-1 pl-3 font-mono text-sm leading-6">
                                  {renderLineContent(row, side, highlightWords)}
                                </div>
                              </div>
                            )
                          })}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {analysis.rows.length > visibleRows.length && (
                <div className="text-center">
                  <p className="mb-2 text-xs text-slate-500">
                    Showing {visibleRows.length.toLocaleString()} of {analysis.rows.length.toLocaleString()} diff rows. Copy and download include all rows.
                  </p>
                  <button
                    type="button"
                    onClick={() => setVisibleRowLimit((currentLimit) => Math.min(currentLimit + INITIAL_VISIBLE_ROWS, analysis.rows.length))}
                    className="tool-secondary-button"
                  >
                    Show next {Math.min(INITIAL_VISIBLE_ROWS, analysis.rows.length - visibleRows.length).toLocaleString()} rows
                  </button>
                </div>
              )}
            </>
          )}
          <StatusMessage status={status} />
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-text-diff">
            <h2 id="about-text-diff" className="text-2xl font-bold tracking-tight text-slate-950">
              Compare text and find changes
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Paste an earlier version into Original Text and the new version into Modified Text. The checker aligns lines, marks additions and removals, and can highlight changed words within edited lines. Options let you ignore letter case or whitespace when matching lines. Comparison, copying, and downloads happen in this browser.
            </p>
          </section>

          <section aria-labelledby="text-diff-faq">
            <h2 id="text-diff-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I compare two versions?', 'Paste the earlier version into Original Text and the newer version into Modified Text. Differences update as you type.'],
                ['Can I ignore spaces or letter case?', 'Yes. Ignore whitespace removes whitespace characters within lines for comparison; line breaks remain meaningful. Ignore case compares letters without distinguishing uppercase and lowercase.'],
                ['How are modified lines counted?', 'A modified line is counted as one removed line and one added line. Unchanged lines are counted separately.'],
                ['Can I copy or download the diff?', 'Yes. Copy diff places a plain-text diff with + and - line prefixes on your clipboard. Download diff saves the same content as a text file.'],
                ['Is my text sent to a server?', 'No. The comparison and generated diff stay in your browser.'],
                ['How large can the inputs be?', `Each input accepts up to ${MAX_INPUT_CHARS.toLocaleString()} characters and ${MAX_LINES.toLocaleString()} lines. Very different texts may be simplified to keep comparisons responsive.`],
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
