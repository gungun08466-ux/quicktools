import {
  AlertCircle,
  Check,
  Clipboard,
  Eraser,
  FileJson,
  FileUp,
  ListRestart,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const exampleJson = `{
  "name": "QuickTools",
  "free": true,
  "tools": ["image", "json", "pdf", "qr"]
}`

function getEditorStats(value) {
  return {
    characters: value.length,
    bytes: new TextEncoder().encode(value).length,
    lines: value ? value.split(/\r\n|\r|\n/).length : 0,
  }
}

function parseEditorJson(value) {
  if (!value.trim()) {
    throw new Error('Enter or upload JSON before using this action.')
  }

  return JSON.parse(value)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KB`
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : Check

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

export default function JsonFormatter() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const fileInputRef = useRef(null)
  const stats = useMemo(() => getEditorStats(value), [value])

  const runTransform = (mode) => {
    try {
      const parsed = parseEditorJson(value)
      const result = mode === 'format'
        ? JSON.stringify(parsed, null, 2)
        : JSON.stringify(parsed)

      setValue(result)
      setStatus({
        type: 'success',
        message: mode === 'format' ? 'JSON formatted successfully.' : 'JSON minified successfully.',
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not process this JSON.',
      })
    }
  }

  const validateJson = () => {
    try {
      parseEditorJson(value)
      setStatus({ type: 'success', message: 'Valid JSON.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not validate this JSON.',
      })
    }
  }

  const copyJson = async () => {
    if (!value) {
      setStatus({ type: 'error', message: 'There is no JSON content to copy.' })
      return
    }

    if (!navigator.clipboard?.writeText) {
      setStatus({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(value)
      setStatus({ type: 'success', message: 'Copied editor content to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not access the clipboard. Check browser permissions and try again.',
      })
    }
  }

  const loadJsonFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatus({ type: 'error', message: 'Choose a file with the .json extension.' })
      return
    }

    try {
      const fileContent = await file.text()
      setValue(fileContent)
      setStatus({ type: 'success', message: `Loaded ${file.name} into the editor.` })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not read the file: ${error.message}`
          : 'Could not read this file. Please try another .json file.',
      })
    }
  }

  const clearEditor = () => {
    setValue('')
    setStatus(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <PageMetadata
        title="JSON Formatter"
        description="Format, minify, validate, and copy JSON in your browser. Upload a JSON file or paste text—your data stays on your device."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            JSON Formatter
          </h1>
        </header>

        <section
          aria-labelledby="editor-heading"
          className="tool-surface mx-auto max-w-5xl p-4 sm:p-6"
        >
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="editor-heading" className="font-semibold text-slate-950">
                JSON editor
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Paste JSON or open a .json file to get started.
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
                className="tool-secondary-button px-3"
              >
                <FileUp aria-hidden="true" size={16} />
                Upload JSON
              </button>
              <button
                type="button"
                onClick={clearEditor}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear
              </button>
            </div>
          </div>

          <label htmlFor="json-input" className="sr-only">
            JSON text editor
          </label>
          <textarea
            id="json-input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setStatus(null)
            }}
            placeholder={exampleJson}
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            className="tool-editor mt-5 min-h-72 w-full resize-y p-4 sm:min-h-[26rem]"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runTransform('format')}
              className="tool-primary-button"
            >
              <Sparkles aria-hidden="true" size={16} />
              Format
            </button>
            <button
              type="button"
              onClick={() => runTransform('minify')}
              className="tool-secondary-button"
            >
              <Minimize2 aria-hidden="true" size={16} />
              Minify
            </button>
            <button
              type="button"
              onClick={validateJson}
              className="tool-secondary-button"
            >
              <Check aria-hidden="true" size={16} />
              Validate
            </button>
            <button
              type="button"
              onClick={copyJson}
              className="tool-secondary-button"
            >
              <Clipboard aria-hidden="true" size={16} />
              Copy
            </button>
          </div>

          {status && <div className="mt-4"><StatusMessage status={status} /></div>}

          <div
            aria-label="JSON statistics"
            className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"
          >
            <div className="tool-stat-tile">
              <p className="text-slate-500">Characters</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">{stats.characters}</p>
            </div>
            <div className="tool-stat-tile">
              <p className="text-slate-500">Approx. size</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">{formatBytes(stats.bytes)}</p>
            </div>
            <div className="tool-stat-tile">
              <p className="text-slate-500">Lines</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">{stats.lines}</p>
            </div>
          </div>
        </section>

        {!value && (
          <p className="mx-auto mt-4 flex max-w-5xl items-center gap-2 px-1 text-sm text-slate-500">
            <ListRestart aria-hidden="true" size={16} />
            Your JSON statistics will appear here as you type or upload a file.
          </p>
        )}

        <div className="mx-auto mt-16 max-w-4xl space-y-12 sm:mt-20">
          <section aria-labelledby="what-is-json">
            <h2 id="what-is-json" className="text-2xl font-bold tracking-tight text-slate-950">
              What Is JSON Formatting?
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              JSON (JavaScript Object Notation) is a text format for representing
              structured data, such as objects, lists, and values. APIs often use
              JSON to exchange data, while configuration files and applications
              use it to store settings and information. Formatting adds
              indentation and line breaks so the structure is easier to read,
              inspect, and troubleshoot.
            </p>
          </section>

          <section aria-labelledby="how-to-format-json">
            <h2 id="how-to-format-json" className="text-2xl font-bold tracking-tight text-slate-950">
              How to Format JSON
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Add your JSON', 'Paste JSON into the editor or select Upload JSON to open a file ending in .json.'],
                ['Choose an action', 'Select Format to add readable indentation, or Validate to check whether the input is valid JSON.'],
                ['Copy your result', 'Select Copy to put the current editor contents on your clipboard. Clipboard access depends on your browser.'],
                ['Save if needed', 'There is no built-in download button. To save a file, copy the editor contents and paste them into a text editor, then save it with a .json extension.'],
              ].map(([title, description], index) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-slate-950">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="json-operations">
            <h2 id="json-operations" className="text-2xl font-bold tracking-tight text-slate-950">
              Format vs. Minify vs. Validate
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                ['Format', 'Parses valid JSON and displays it with two-space indentation and line breaks, making nested data easier to scan.'],
                ['Minify', 'Parses valid JSON and writes it without unnecessary whitespace. This can make the text shorter, but does not compress it like a file archive.'],
                ['Validate', 'Checks whether the editor content can be parsed as JSON and reports success or the parsing error. It identifies errors but does not repair them.'],
              ].map(([title, description]) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="json-example">
            <h2 id="json-example" className="text-2xl font-bold tracking-tight text-slate-950">
              JSON Example
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              These two snippets represent the same JSON data. Formatting adds
              whitespace to make the object and its nested list easier to read.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="font-semibold text-slate-950">Before formatting</h3>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-800"><code>{'{"name":"Mira","active":true,"items":["map","book"]}'}</code></pre>
              </article>
              <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h3 className="font-semibold text-slate-950">After formatting</h3>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-800"><code>{`{
  "name": "Mira",
  "active": true,
  "items": [
    "map",
    "book"
  ]
}`}</code></pre>
              </article>
            </div>
          </section>

          <section aria-labelledby="common-json-errors">
            <h2 id="common-json-errors" className="text-2xl font-bold tracking-tight text-slate-950">
              Common JSON Errors
            </h2>
            <ul className="mt-4 space-y-3">
              {[
                ['Missing commas', 'Separate neighboring properties or array items with commas.'],
                ['Trailing commas', 'Do not leave a comma after the last property or item. JSON does not allow trailing commas.'],
                ['Single quotes', 'Use double quotes around strings; single-quoted strings are not valid JSON.'],
                ['Unquoted property names', 'Put double quotes around every property name, for example "name".'],
                ['Unclosed braces or brackets', 'Make sure each opening { and [ has a matching closing } and ] in the correct order.'],
              ].map(([title, description]) => (
                <li key={title} className="rounded-xl border border-slate-200 bg-white p-4 sm:px-5">
                  <h3 className="font-semibold text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="json-faq">
            <h2 id="json-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['What is a JSON formatter?', 'It is a tool that parses JSON and displays it with indentation and line breaks to make its structure easier to read.'],
                ['Is this JSON Formatter free?', 'Yes. You can use it without an account or payment.'],
                ['Does formatting change the actual data?', 'Formatting normally changes only whitespace and indentation, not the intended JSON structure. However, JavaScript can lose precision when it parses and rewrites very large integer values. If an exact large integer matters, preserve it as a string by putting it in double quotes.'],
                ['What is the difference between formatting and minifying?', 'Formatting adds indentation and line breaks for readability. Minifying removes unnecessary whitespace to produce a more compact JSON string.'],
                ['Can I validate invalid JSON?', 'Yes. Select Validate to see whether the input is valid. Invalid JSON produces a parsing error; the tool does not automatically fix it.'],
                ['Is my JSON data uploaded to a server?', 'No. The JSON is processed in your browser and is not sent to a QuickTools processing server.'],
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
