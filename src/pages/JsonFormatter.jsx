import {
  AlertCircle,
  Braces,
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
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <Braces aria-hidden="true" size={16} />
            JSON tools, right in your browser
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            JSON Formatter
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Format, minify, and validate JSON in seconds. Your content is processed
            locally in your browser and is never uploaded.
          </p>
        </header>

        <section
          aria-labelledby="editor-heading"
          className="mx-auto mt-8 max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <FileUp aria-hidden="true" size={16} />
                Upload JSON
              </button>
              <button
                type="button"
                onClick={clearEditor}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
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
            className="mt-5 min-h-80 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 sm:min-h-[26rem]"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runTransform('format')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Sparkles aria-hidden="true" size={16} />
              Format
            </button>
            <button
              type="button"
              onClick={() => runTransform('minify')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Minimize2 aria-hidden="true" size={16} />
              Minify
            </button>
            <button
              type="button"
              onClick={validateJson}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Check aria-hidden="true" size={16} />
              Validate
            </button>
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Clipboard aria-hidden="true" size={16} />
              Copy
            </button>
          </div>

          {status && <div className="mt-4"><StatusMessage status={status} /></div>}

          <div
            aria-label="JSON statistics"
            className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 text-sm"
          >
            <div>
              <p className="text-slate-500">Characters</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">{stats.characters}</p>
            </div>
            <div>
              <p className="text-slate-500">Approx. size</p>
              <p className="mt-1 font-semibold tabular-nums text-slate-900">{formatBytes(stats.bytes)}</p>
            </div>
            <div>
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
      </div>
    </>
  )
}
