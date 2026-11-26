import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  FileUp,
} from 'lucide-react'
import { useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const PREVIEW_ROW_LIMIT = 12

function escapeKeySegment(key) {
  if (key === '') return '\\e'
  return key.replace(/\\/gu, '\\\\').replace(/\./gu, '\\.')
}

function flattenRecord(record) {
  const flattened = Object.create(null)
  const pending = [{ value: record, path: [] }]

  while (pending.length) {
    const { value, path } = pending.pop()
    const columnName = path.map(escapeKeySegment).join('.')

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value)
      if (!entries.length) {
        flattened[columnName || 'value'] = '{}'
        continue
      }

      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, nestedValue] = entries[index]
        pending.push({ value: nestedValue, path: [...path, key] })
      }
      continue
    }

    flattened[columnName || 'value'] = Array.isArray(value)
      ? JSON.stringify(value)
      : value === null
        ? 'null'
        : String(value)
  }

  return flattened
}

function escapeCsvField(value) {
  const startsWithFormula = /^[\u0000-\u0020\uFEFF]*[=+\-@]/u.test(value)
    || /^[\t\r\n]/u.test(value)
  const spreadsheetSafeValue = startsWithFormula ? `'${value}` : value
  const escapedQuotes = spreadsheetSafeValue.replace(/"/gu, '""')

  return /[",\r\n]/u.test(spreadsheetSafeValue)
    ? `"${escapedQuotes}"`
    : escapedQuotes
}

function convertJsonToCsv(source) {
  if (!source.trim()) {
    return { error: 'Paste or upload a JSON array before converting.' }
  }

  let parsed
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    return {
      error: error instanceof Error
        ? `Invalid JSON: ${error.message}`
        : 'Invalid JSON. Check the syntax and try again.',
    }
  }

  if (!Array.isArray(parsed)) {
    return { error: 'The JSON root must be an array of objects.' }
  }
  if (!parsed.length) {
    return { headers: [], rows: [], csv: '', empty: true }
  }

  const invalidIndex = parsed.findIndex((record) => (
    record === null || typeof record !== 'object' || Array.isArray(record)
  ))
  if (invalidIndex !== -1) {
    return {
      error: `Item ${invalidIndex + 1} is not an object. Conversion stopped so no JSON data is silently omitted.`,
    }
  }

  const rows = parsed.map(flattenRecord)
  const headers = []
  const knownHeaders = new Set()

  rows.forEach((row) => {
    Object.keys(row).forEach((header) => {
      if (!knownHeaders.has(header)) {
        knownHeaders.add(header)
        headers.push(header)
      }
    })
  })

  const csvRows = [
    headers.map(escapeCsvField).join(','),
    ...rows.map((row) => headers.map((header) => (
      Object.prototype.hasOwnProperty.call(row, header)
        ? escapeCsvField(row[header])
        : ''
    )).join(',')),
  ]

  return { headers, rows, csv: csvRows.join('\r\n'), empty: false }
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const isInfo = status.type === 'info'
  const Icon = isError ? AlertCircle : Check
  const colorClasses = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : isInfo
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${colorClasses}`}
    >
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

export default function JsonToCsv() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef(null)

  const updateInput = (value) => {
    setInput(value)
    setResult(null)
    setStatus(null)
    setFileName('')
  }

  const loadJsonFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.json')) {
      setResult(null)
      setStatus({ type: 'error', message: 'Choose a file with the .json extension.' })
      return
    }

    setIsReading(true)
    try {
      const contents = await file.text()
      setInput(contents)
      setResult(null)
      setFileName(file.name)
      setStatus({ type: 'success', message: `Loaded ${file.name}. Select Convert to CSV to continue.` })
    } catch (error) {
      setResult(null)
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not read the file: ${error.message}`
          : 'Could not read this JSON file. Please try another file.',
      })
    } finally {
      setIsReading(false)
    }
  }

  const convert = () => {
    const converted = convertJsonToCsv(input)
    if (converted.error) {
      setResult(null)
      setStatus({ type: 'error', message: converted.error })
      return
    }

    setResult(converted)
    setStatus(converted.empty
      ? { type: 'info', message: 'The JSON is valid, but the array is empty, so there are no CSV rows to export.' }
      : {
        type: 'success',
        message: `Converted ${converted.rows.length} records into ${converted.headers.length} columns.`,
      })
  }

  const copyCsv = async () => {
    if (!result?.csv) return
    if (!navigator.clipboard?.writeText) {
      setStatus({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(result.csv)
      setStatus({ type: 'success', message: 'CSV copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the CSV. Check clipboard permissions and try again.',
      })
    }
  }

  const downloadCsv = () => {
    if (!result?.csv) return

    try {
      const blob = new Blob([`\uFEFF${result.csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'converted.csv'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'CSV download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not create the CSV download: ${error.message}`
          : 'Could not create the CSV download. Try copying the output instead.',
      })
    }
  }

  const clearAll = () => {
    setInput('')
    setResult(null)
    setStatus(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const previewRows = result?.rows.slice(0, PREVIEW_ROW_LIMIT) ?? []

  return (
    <>
      <PageMetadata
        title="JSON to CSV Converter - Convert JSON Arrays to CSV"
        description="Convert JSON arrays of objects into CSV with flattened nested fields, correct escaping, and spreadsheet formula protection. Upload or paste JSON; files stay in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">JSON to CSV Converter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Turn an array of JSON objects into a downloadable CSV. Nested
            properties become columns, and missing values remain visible as
            empty cells.
          </p>
        </header>

        <section aria-label="JSON to CSV converter" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">JSON input</h2>
              <p className="mt-1 text-sm text-slate-500">
                Paste an array of objects or load a .json file.
                {fileName ? ` Loaded: ${fileName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={loadJsonFile}
                className="sr-only"
                aria-label="Upload a JSON file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReading}
                className="tool-secondary-button px-3"
              >
                <FileUp aria-hidden="true" size={16} />
                {isReading ? 'Reading file...' : 'Upload JSON'}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!input && !result && !status && !fileName}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="json-to-csv-input-heading" className="min-w-0">
              <div className="flex items-end justify-between gap-3">
                <h3 id="json-to-csv-input-heading" className="font-semibold text-slate-950">JSON editor</h3>
                <span className="text-xs tabular-nums text-slate-500">{input.length} characters</span>
              </div>
              <label htmlFor="json-to-csv-input" className="sr-only">JSON input editor</label>
              <textarea
                id="json-to-csv-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={'[\n  { "name": "Ada", "active": true },\n  { "name": "Lin", "active": false }\n]'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="csv-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 id="csv-output-heading" className="font-semibold text-slate-950">CSV output</h3>
                  {result && !result.empty && (
                    <p className="mt-1 text-xs text-slate-500">
                      {result.rows.length} rows · {result.headers.length} columns
                    </p>
                  )}
                </div>
                <span className="text-xs tabular-nums text-slate-500">
                  {result?.csv.length ?? 0} characters
                </span>
              </div>
              <label htmlFor="json-to-csv-output" className="sr-only">Generated CSV output</label>
              <textarea
                id="json-to-csv-output"
                value={result?.csv ?? ''}
                readOnly
                placeholder="Your CSV output will appear here..."
                spellCheck="false"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 read-only:cursor-text read-only:focus:border-indigo-500 sm:min-h-80"
              />
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button type="button" onClick={convert} disabled={isReading} className="tool-primary-button">
              Convert to CSV
            </button>
            <button
              type="button"
              onClick={copyCsv}
              disabled={!result?.csv}
              className="tool-secondary-button"
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy CSV
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!result?.csv}
              className="tool-secondary-button"
            >
              <Download aria-hidden="true" size={16} />
              Download CSV
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            CSV export prefixes formula-leading values and headers with an apostrophe to reduce spreadsheet formula-injection risk. The preview shows original JSON values. Downloads include a UTF-8 BOM for spreadsheet compatibility.
          </p>

          {status && (
            <div className="mt-4">
              <StatusMessage status={status} />
            </div>
          )}

          {result && (
            <section aria-labelledby="csv-preview-heading" className="mt-7 border-t border-slate-200 pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="csv-preview-heading" className="text-lg font-semibold text-slate-950">Table preview</h3>
                {result.rows.length > PREVIEW_ROW_LIMIT && (
                  <p className="text-sm text-slate-500">
                    Showing the first {PREVIEW_ROW_LIMIT} of {result.rows.length} rows. CSV output contains every row.
                  </p>
                )}
              </div>
              {result.empty ? (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This valid JSON array is empty, so there are no columns or rows to preview.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left">
                    <caption className="sr-only">Preview of the converted CSV data</caption>
                    <thead className="bg-slate-50">
                      <tr>
                        {result.headers.map((header) => (
                          <th key={header} scope="col" className="max-w-xs break-words px-3 py-3 text-xs font-semibold text-slate-700 sm:px-4">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {result.headers.map((header) => (
                            <td key={header} className="max-w-xs break-words whitespace-pre-wrap px-3 py-3 align-top text-sm text-slate-700 sm:px-4">
                              {Object.prototype.hasOwnProperty.call(row, header)
                                ? row[header]
                                : <span className="text-slate-400" title="Missing value">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-json-to-csv">
            <h2 id="about-json-to-csv" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert JSON arrays into CSV
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This JSON to CSV converter collects the keys from every object,
              so columns present only in later records are included too. Nested
              object properties are flattened into dot-separated column names;
              dots and backslashes in original keys are escaped, and empty keys
              are marked as <code className="rounded bg-slate-100 px-1 text-sm">\e</code>
              to avoid column name collisions. Arrays inside a record are kept
              as JSON text in their cell.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Missing properties become empty cells, while explicit null values
              are written as <code className="rounded bg-slate-100 px-1 text-sm">null</code>.
              Commas, double quotes, and line breaks are escaped using CSV
              quoting rules. Spreadsheet formula-leading fields are prefixed
              with an apostrophe in the exported CSV; the table preview keeps
              the original values.
            </p>
          </section>

          <section aria-labelledby="json-to-csv-faq">
            <h2 id="json-to-csv-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['What JSON can I convert?', 'Provide a JSON array whose items are objects. The converter unions keys across all rows, so inconsistent object properties become columns and missing cells are left blank. Non-object items are reported instead of being omitted.'],
                ['How are nested objects handled?', 'Nested object properties are flattened into dot-separated column names, such as customer.name. Arrays are preserved as JSON text within one CSV cell.'],
                ['How are null and missing values represented?', 'An absent property produces an empty CSV cell and is marked as missing in the preview. An explicit JSON null is written as the text null.'],
                ['How are commas, quotes, and newlines escaped?', 'CSV fields containing commas, double quotes, or line breaks are quoted, and any double quote inside a field is doubled.'],
                ['Why does the export add apostrophes to some cells?', 'Values beginning with spreadsheet formula characters are prefixed with an apostrophe in the exported CSV to reduce formula-injection risk. The table preview shows original values.'],
                ['Are my JSON files uploaded?', 'No. File reading, parsing, conversion, copying, and downloading happen locally in your browser. The tool does not send JSON data to a processing server.'],
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
