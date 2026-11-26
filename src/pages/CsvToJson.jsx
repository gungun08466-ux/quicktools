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

const DELIMITERS = [
  { value: ',', label: 'Comma (,)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe (|)' },
]

function parseCsv(source, delimiter) {
  const input = source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source
  if (!input.length) return { error: 'Paste or upload CSV content before converting.' }

  const records = []
  let row = []
  let field = ''
  let insideQuotes = false
  let afterQuote = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (insideQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          insideQuotes = false
          afterQuote = true
        }
      } else {
        field += character
      }
      continue
    }

    if (afterQuote) {
      if (character === delimiter) {
        row.push(field)
        field = ''
        afterQuote = false
        continue
      }
      if (character === '\r' || character === '\n') {
        row.push(field)
        records.push(row)
        row = []
        field = ''
        afterQuote = false
        if (character === '\r' && input[index + 1] === '\n') index += 1
        continue
      }
      return {
        error: `Unexpected character after a closing quote at row ${records.length + 1}, column ${row.length + 1}. Only a delimiter or line break may follow a quoted field.`,
      }
    }

    if (character === '"') {
      if (field.length) {
        return {
          error: `Unexpected quote in an unquoted field at row ${records.length + 1}, column ${row.length + 1}.`,
        }
      }
      insideQuotes = true
      continue
    }

    if (character === delimiter) {
      row.push(field)
      field = ''
      continue
    }

    if (character === '\r' || character === '\n') {
      row.push(field)
      records.push(row)
      row = []
      field = ''
      if (character === '\r' && input[index + 1] === '\n') index += 1
      continue
    }

    field += character
  }

  if (insideQuotes) {
    return {
      error: `Unclosed quoted field at row ${records.length + 1}, column ${row.length + 1}.`,
    }
  }

  if (row.length || field.length || afterQuote) {
    row.push(field)
    records.push(row)
  }

  if (!records.length) return { error: 'No CSV header row was found.' }

  return { records, error: null }
}

function normalizeHeaders(rawHeaders) {
  const reserved = new Set(rawHeaders.filter((header) => header !== ''))
  const rawSeen = new Set()
  const used = new Set()
  let duplicateCount = 0
  let emptyCount = 0

  const headers = rawHeaders.map((header, index) => {
    const isEmpty = header === ''
    if (isEmpty) {
      emptyCount += 1
    } else if (rawSeen.has(header)) {
      duplicateCount += 1
    }
    rawSeen.add(header)

    const base = isEmpty ? `column_${index + 1}` : header
    let uniqueHeader = base
    if (used.has(uniqueHeader) || (isEmpty && reserved.has(uniqueHeader))) {
      let suffix = 2
      do {
        uniqueHeader = `${base}_${suffix}`
        suffix += 1
      } while (used.has(uniqueHeader) || reserved.has(uniqueHeader))
    }
    used.add(uniqueHeader)
    return uniqueHeader
  })

  return { headers, duplicateCount, emptyCount }
}

function parseCsvToJson(source, delimiter) {
  const parsedCsv = parseCsv(source, delimiter)
  if (parsedCsv.error) return parsedCsv

  const [rawHeaders, ...records] = parsedCsv.records
  const normalized = normalizeHeaders(rawHeaders)
  const rows = []

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (record.length !== normalized.headers.length) {
      return {
        error: `Row ${index + 2} has ${record.length} fields; the header row has ${normalized.headers.length}. Check for a missing delimiter or an unescaped quote.`,
      }
    }

    const row = Object.create(null)
    normalized.headers.forEach((header, columnIndex) => {
      row[header] = record[columnIndex]
    })
    rows.push(row)
  }

  return {
    headers: normalized.headers,
    rows,
    duplicateCount: normalized.duplicateCount,
    emptyCount: normalized.emptyCount,
    json: JSON.stringify(rows, null, 2),
    error: null,
  }
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

export default function CsvToJson() {
  const [input, setInput] = useState('')
  const [delimiter, setDelimiter] = useState(',')
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

  const loadCsvFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setResult(null)
      setStatus({ type: 'error', message: 'Choose a file with the .csv extension.' })
      return
    }

    setIsReading(true)
    try {
      const contents = await file.text()
      setInput(contents)
      setResult(null)
      setFileName(file.name)
      setStatus({ type: 'success', message: `Loaded ${file.name}. Select Convert to JSON to continue.` })
    } catch (error) {
      setResult(null)
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not read the file: ${error.message}`
          : 'Could not read this CSV file. Please try another file.',
      })
    } finally {
      setIsReading(false)
    }
  }

  const convert = () => {
    const converted = parseCsvToJson(input, delimiter)
    if (converted.error) {
      setResult(null)
      setStatus({ type: 'error', message: converted.error })
      return
    }

    setResult(converted)
    const headerNotes = [
      converted.duplicateCount
        ? `${converted.duplicateCount} duplicate header${converted.duplicateCount === 1 ? '' : 's'} renamed`
        : '',
      converted.emptyCount
        ? `${converted.emptyCount} empty header${converted.emptyCount === 1 ? '' : 's'} renamed`
        : '',
    ].filter(Boolean)

    setStatus({
      type: 'success',
      message: `Converted ${converted.rows.length} rows and ${converted.headers.length} columns.${headerNotes.length ? ` ${headerNotes.join('; ')}.` : ''}`,
    })
  }

  const copyJson = async () => {
    if (!result?.json) return
    if (!navigator.clipboard?.writeText) {
      setStatus({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(result.json)
      setStatus({ type: 'success', message: 'JSON copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the JSON. Check clipboard permissions and try again.',
      })
    }
  }

  const downloadJson = () => {
    if (!result?.json) return

    try {
      const blob = new Blob([result.json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'converted.json'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'JSON download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not create the JSON download: ${error.message}`
          : 'Could not create the JSON download. Try copying the output instead.',
      })
    }
  }

  const clearAll = () => {
    setInput('')
    setDelimiter(',')
    setResult(null)
    setStatus(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const changeDelimiter = (value) => {
    setDelimiter(value)
    setResult(null)
    setStatus(null)
  }

  return (
    <>
      <PageMetadata
        title="CSV to JSON Converter - Convert CSV Files to JSON"
        description="Convert CSV rows into formatted JSON objects in your browser. Choose comma, semicolon, tab, or pipe delimiters; quoted fields, multiline text, and Unicode are supported."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">CSV to JSON Converter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Convert CSV rows into JSON objects using the first row as headers.
            Paste text or upload a file, choose the delimiter, and preview the
            formatted result.
          </p>
        </header>

        <section aria-label="CSV to JSON converter" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-950">CSV input</h2>
              <p className="mt-1 break-words text-sm text-slate-500">
                Paste CSV or upload a .csv file.
                {fileName ? ` Loaded: ${fileName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="csv-delimiter" className="mb-1 block text-xs font-medium text-slate-600">
                  Delimiter
                </label>
                <select
                  id="csv-delimiter"
                  value={delimiter}
                  onChange={(event) => changeDelimiter(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {DELIMITERS.map(({ value, label }) => (
                    <option key={label} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={loadCsvFile}
                className="sr-only"
                aria-label="Upload a CSV file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReading}
                className="tool-secondary-button px-3"
              >
                <FileUp aria-hidden="true" size={16} />
                {isReading ? 'Reading file...' : 'Upload CSV'}
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!input && !result && !status && !fileName && delimiter === ','}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="csv-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="csv-input-heading" className="font-semibold text-slate-950">CSV editor</h3>
                <span className="text-xs tabular-nums text-slate-500">{input.length} characters</span>
              </div>
              <label htmlFor="csv-to-json-input" className="sr-only">CSV text editor</label>
              <textarea
                id="csv-to-json-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={'name,age,city\n"Ada Lovelace",36,London\n"Grace Hopper",85,"New York"'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="json-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 id="json-output-heading" className="font-semibold text-slate-950">Formatted JSON</h3>
                  {result && (
                    <p className="mt-1 text-xs text-slate-500">
                      {result.rows.length} rows · {result.headers.length} columns
                    </p>
                  )}
                </div>
                <span className="text-xs tabular-nums text-slate-500">
                  {result?.json.length ?? 0} characters
                </span>
              </div>
              <label htmlFor="csv-to-json-output" className="sr-only">Generated JSON output</label>
              <textarea
                id="csv-to-json-output"
                value={result?.json ?? ''}
                readOnly
                placeholder="Your formatted JSON will appear here..."
                spellCheck="false"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 read-only:cursor-text read-only:focus:border-indigo-500 sm:min-h-80"
              />
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button type="button" onClick={convert} disabled={isReading} className="tool-primary-button">
              Convert to JSON
            </button>
            <button
              type="button"
              onClick={copyJson}
              disabled={!result?.json}
              className="tool-secondary-button"
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy JSON
            </button>
            <button
              type="button"
              onClick={downloadJson}
              disabled={!result?.json}
              className="tool-secondary-button"
            >
              <Download aria-hidden="true" size={16} />
              Download JSON
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Empty cells become empty strings. Duplicate headers receive a numeric suffix (for example, name_2); empty headers become column_N based on their position. Whitespace in headers and cell values is preserved.
          </p>

          {status && (
            <div className="mt-4">
              <StatusMessage status={status} />
            </div>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-csv-to-json">
            <h2 id="about-csv-to-json" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert CSV rows into JSON objects
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              The first CSV record supplies the object property names. Every
              following record becomes one JSON object. Quoted cells may
              contain delimiters, doubled double quotes, and line breaks.
              Choose comma, semicolon, tab, or pipe to match your file.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Duplicate headers are renamed with suffixes such as
              <code className="mx-1 rounded bg-slate-100 px-1 text-sm">name_2</code>,
              while empty headers become position-based names such as
              <code className="mx-1 rounded bg-slate-100 px-1 text-sm">column_2</code>.
              Empty cells remain empty strings. Rows with a different number
              of fields than the header are rejected rather than truncated.
              A leading UTF-8 BOM is ignored.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Your CSV is parsed and converted locally in your browser; the
              generated JSON is shown as formatted text and is never executed
              as markup.
            </p>
          </section>

          <section aria-labelledby="csv-to-json-faq">
            <h2 id="csv-to-json-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How is CSV converted to JSON?', 'The first CSV record is used as headers. Each subsequent record becomes an object with those property names and cell values as strings.'],
                ['Can quoted CSV fields contain commas or newlines?', 'Yes. Delimiters and line breaks inside a quoted field are preserved, and doubled double quotes are read as one literal quote.'],
                ['How are duplicate or blank headers handled?', 'Duplicate names receive suffixes such as name_2 and name_3. Empty headers become column_N using their one-based column position. Existing names are checked to avoid generated-name collisions.'],
                ['What happens to empty cells?', 'An empty cell is kept as an empty string in the JSON output. Trailing empty cells are retained too.'],
                ['Why can a CSV row be rejected?', 'Each data record must have the same number of fields as the header record. Malformed quotes and inconsistent row widths produce an error instead of partial conversion.'],
                ['Are my CSV files uploaded?', 'No. File reading, parsing, conversion, copying, and downloading happen locally in your browser. The tool does not send CSV data to a processing server.'],
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
