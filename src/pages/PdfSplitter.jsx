import { PDFDocument } from 'pdf-lib'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Scissors,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, validatePdfFile } from '../utils/pdfValidation.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const THUMBNAIL_MAX_WIDTH = 220
const THUMBNAIL_MAX_HEIGHT = 280

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const isInfo = status.type === 'info'
  const Icon = isError ? AlertCircle : isInfo ? LoaderCircle : CheckCircle2

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : isInfo
            ? 'border-indigo-100 bg-indigo-50 text-indigo-900'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <Icon
        aria-hidden="true"
        size={18}
        className={`mt-0.5 shrink-0 ${isInfo ? 'animate-spin' : ''}`}
      />
      <p>{status.message}</p>
    </div>
  )
}

function renderPageToThumbnail(pdf, pageNumber, renderTasksRef) {
  return pdf.getPage(pageNumber).then(async (page) => {
    const baseViewport = page.getViewport({ scale: 1 })
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_WIDTH / baseViewport.width,
      THUMBNAIL_MAX_HEIGHT / baseViewport.height,
    )
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      page.cleanup()
      throw new Error('This browser could not create a page preview.')
    }

    canvas.width = Math.max(1, Math.ceil(viewport.width))
    canvas.height = Math.max(1, Math.ceil(viewport.height))
    const renderTask = page.render({ canvas, canvasContext: context, viewport })
    renderTasksRef.current.add(renderTask)

    try {
      await renderTask.promise
    } finally {
      renderTasksRef.current.delete(renderTask)
      page.cleanup()
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        canvas.width = 0
        canvas.height = 0
        if (blob) resolve(blob)
        else reject(new Error('The browser could not create a page preview.'))
      }, 'image/jpeg', 0.65)
    })
  })
}

function getPdfLoadError(error) {
  if (error?.name === 'PasswordException' || /password/i.test(error?.message || '')) {
    return 'This PDF is password-protected. Remove its password and try again.'
  }
  if (error?.name === 'InvalidPDFException') {
    return 'This file could not be opened as a valid PDF.'
  }
  return error instanceof Error
    ? `Could not open this PDF: ${error.message}`
    : 'Could not open this PDF. Check the file and try again.'
}

function parsePageRanges(value, pageCount) {
  if (!value.trim()) {
    return { pages: [], error: 'Enter one or more page numbers or ranges.' }
  }

  const pages = []
  const seenPages = new Set()

  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) {
      return { pages: [], error: 'Use page numbers and ranges such as 1-3, 5, 8-10.' }
    }

    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return { pages: [], error: 'Page numbers must be whole numbers.' }
    }
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return { pages: [], error: `Enter page numbers from 1 to ${pageCount}.` }
    }
    if (start > end) {
      return { pages: [], error: 'In each range, the first page must be less than or equal to the last.' }
    }

    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
      if (!seenPages.has(pageNumber)) {
        pages.push(pageNumber)
        seenPages.add(pageNumber)
      }
    }
  }

  return { pages, error: null }
}

function getSplitFilename(filename) {
  const baseName = filename.replace(/\.pdf$/i, '') || 'document'
  return `${baseName}-split.pdf`
}

export default function PdfSplitter() {
  const fileInputRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const operationIdRef = useRef(0)
  const renderTasksRef = useRef(new Set())
  const previewUrlsRef = useRef(new Set())
  const splittingRef = useRef(false)

  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewPages, setPreviewPages] = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [pageRange, setPageRange] = useState('')
  const [outputPdf, setOutputPdf] = useState(null)
  const [outputPdfUrl, setOutputPdfUrl] = useState('')
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSplitting, setIsSplitting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!outputPdf) {
      setOutputPdfUrl('')
      return undefined
    }

    const url = URL.createObjectURL(outputPdf)
    setOutputPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [outputPdf])

  useEffect(() => () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) loadingTaskRef.current.destroy()
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }, [])

  const clearOutput = () => setOutputPdf(null)

  const cancelDocumentWork = () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()

    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy()
      loadingTaskRef.current = null
    }

    pdfDocumentRef.current = null
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
    setPdfFile(null)
    setPageCount(0)
    setPreviewPages([])
    setSelectedPages([])
    setPageRange('')
    setOutputPdf(null)
    setProgress(0)
    setStatus(null)
    setIsLoading(false)
    setIsSplitting(false)
    splittingRef.current = false
    return operationIdRef.current
  }

  const loadPdf = async (file) => {
    const operationId = cancelDocumentWork()
    setIsLoading(true)
    setStatus({ type: 'info', message: 'Validating and opening your PDF locally…' })

    try {
      const validationError = await validatePdfFile(file)
      if (operationIdRef.current !== operationId) return
      if (validationError) {
        setStatus({ type: 'error', message: validationError })
        return
      }

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (operationIdRef.current !== operationId) return

      const loadingTask = getDocument({ data: bytes, isEvalSupported: false })
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (operationIdRef.current !== operationId) return

      pdfDocumentRef.current = pdf
      setPdfFile(file)
      setPageCount(pdf.numPages)
      setStatus({ type: 'info', message: 'Creating page previews…' })

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const thumbnail = await renderPageToThumbnail(pdf, pageNumber, renderTasksRef)
        if (operationIdRef.current !== operationId) return

        const previewUrl = URL.createObjectURL(thumbnail)
        previewUrlsRef.current.add(previewUrl)
        setPreviewPages((currentPages) => [...currentPages, { pageNumber, previewUrl }])
        setProgress(Math.round((pageNumber / pdf.numPages) * 100))
      }

      if (operationIdRef.current === operationId) {
        setStatus({
          type: 'success',
          message: `Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Select pages to include in the new PDF.`,
        })
      }
    } catch (error) {
      if (operationIdRef.current !== operationId) return

      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
      pdfDocumentRef.current = null
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
      setPdfFile(null)
      setPageCount(0)
      setPreviewPages([])
      setSelectedPages([])
      setStatus({ type: 'error', message: getPdfLoadError(error) })
    } finally {
      if (operationIdRef.current === operationId) setIsLoading(false)
    }
  }

  const handleFileSelection = (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length !== 1) {
      setStatus({ type: 'error', message: 'Choose one PDF file at a time.' })
      return
    }
    void loadPdf(files[0])
  }

  const handleFileInput = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    handleFileSelection(files)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (!isLoading && !isSplitting) handleFileSelection(event.dataTransfer.files)
  }

  const resetPdf = () => {
    if (isSplitting) return
    cancelDocumentWork()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateSelection = (nextPages, clearRange = true) => {
    setSelectedPages(nextPages)
    if (clearRange) setPageRange('')
    clearOutput()
    setStatus(null)
  }

  const togglePageSelection = (pageNumber) => {
    updateSelection(selectedPages.includes(pageNumber)
      ? selectedPages.filter((number) => number !== pageNumber)
      : [...selectedPages, pageNumber].sort((first, second) => first - second))
  }

  const selectAllPages = () => updateSelection(
    Array.from({ length: pageCount }, (_, index) => index + 1),
  )

  const deselectAllPages = () => updateSelection([])

  const applyPageRange = () => {
    const result = parsePageRanges(pageRange, pageCount)
    if (result.error) {
      setStatus({ type: 'error', message: result.error })
      return
    }
    updateSelection(result.pages, false)
    setStatus({
      type: 'success',
      message: `Selected ${result.pages.length} page${result.pages.length === 1 ? '' : 's'} in the order entered.`,
    })
  }

  const splitSelectedPages = async () => {
    if (splittingRef.current) return
    if (!pdfFile || !pdfDocumentRef.current) {
      setStatus({ type: 'error', message: 'Choose a valid PDF before splitting pages.' })
      return
    }
    if (!selectedPages.length) {
      setStatus({ type: 'error', message: 'Select at least one page to include in the new PDF.' })
      return
    }

    splittingRef.current = true
    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    setIsSplitting(true)
    setProgress(0)
    clearOutput()
    setStatus(null)

    try {
      const sourceBytes = await pdfFile.arrayBuffer()
      if (operationIdRef.current !== operationId) return
      const sourcePdf = await PDFDocument.load(sourceBytes)
      if (operationIdRef.current !== operationId) return
      setProgress(30)

      const newPdf = await PDFDocument.create()
      const pages = await newPdf.copyPages(
        sourcePdf,
        selectedPages.map((pageNumber) => pageNumber - 1),
      )
      if (operationIdRef.current !== operationId) return
      pages.forEach((page) => newPdf.addPage(page))
      setProgress(75)

      const bytes = await newPdf.save()
      if (operationIdRef.current !== operationId) return
      const result = new Blob([bytes], { type: 'application/pdf' })
      if (!result.size) throw new Error('The new PDF is empty.')

      setOutputPdf(result)
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Created a PDF with ${selectedPages.length} selected page${selectedPages.length === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      const reason = error instanceof Error ? error.message : ''
      setStatus({
        type: 'error',
        message: /encrypt|password/i.test(reason)
          ? 'This PDF is password-protected and cannot be split. Remove its password and try again.'
          : /memory|allocation|array buffer/i.test(reason)
            ? 'The browser ran out of memory while splitting this PDF. Try a smaller document or fewer pages.'
            : reason
              ? `Could not split this PDF: ${reason}`
              : 'Could not split this PDF. Check the file and try again.',
      })
      setProgress(0)
    } finally {
      if (operationIdRef.current === operationId) {
        splittingRef.current = false
        setIsSplitting(false)
      }
    }
  }

  const selectedPageSet = new Set(selectedPages)
  const isBusy = isLoading || isSplitting
  const progressMessage = isLoading ? 'Preparing PDF page previews…' : 'Creating your new PDF…'

  return (
    <>
      <PageMetadata
        title="PDF Splitter - Split PDF Pages Online"
        description="Split PDF pages online by selecting individual pages or entering page ranges. Preview pages and download a new PDF; all processing stays in your browser."
      />
      <div className="mx-auto max-w-5xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">PDF Splitter</h1>
        </header>

        <section aria-label="PDF splitter" className="mx-auto max-w-4xl space-y-5">
          <section aria-labelledby="pdf-upload-heading" className="tool-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <FilePlus2 aria-hidden="true" size={20} />
                </span>
                <div>
                  <h2 id="pdf-upload-heading" className="font-semibold text-slate-950">
                    Choose a PDF
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select or drop one PDF file, up to 25 MB.
                  </p>
                </div>
              </div>
              {(pdfFile || isLoading) && (
                <button
                  type="button"
                  onClick={resetPdf}
                  disabled={isSplitting}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  Remove PDF
                </button>
              )}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault()
                if (!isBusy) setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`tool-dropzone mt-5 p-5 text-center sm:p-7 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : ''
              } ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileInput}
                disabled={isBusy}
                className="sr-only"
                aria-label="Select a PDF file"
              />
              <Upload aria-hidden="true" size={23} className="mx-auto text-indigo-700" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Drag and drop your PDF here
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileText aria-hidden="true" size={17} />
                Select PDF
              </button>
              <p className="mt-2 text-xs text-slate-500">PDF files only · Maximum 25 MB</p>
            </div>

            {pdfFile && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-800" title={pdfFile.name}>
                  {pdfFile.name}
                </span>
                <span className="shrink-0 text-slate-500">
                  {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {formatFileSize(pdfFile.size)}
                </span>
              </div>
            )}
          </section>

          {isBusy && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm text-indigo-900">
                <span className="inline-flex items-center gap-2 font-medium">
                  <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                  {progressMessage}
                </span>
                <span>{progress}%</span>
              </div>
              <progress
                aria-label="PDF processing progress"
                value={progress}
                max="100"
                className="mt-2 h-2 w-full accent-indigo-600"
              />
            </div>
          )}

          {status && <StatusMessage status={status} />}

          {pdfFile && previewPages.length > 0 && (
            <section aria-labelledby="page-selection-heading" className="tool-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="page-selection-heading" className="font-semibold text-slate-950">
                    Select pages to include
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose thumbnails or enter page numbers and ranges.
                  </p>
                </div>
                <p className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-800">
                  {selectedPages.length} of {pageCount} selected
                </p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label htmlFor="pdf-page-ranges" className="text-sm font-medium text-slate-800">
                    Custom page ranges
                  </label>
                  <input
                    id="pdf-page-ranges"
                    type="text"
                    inputMode="text"
                    value={pageRange}
                    onChange={(event) => {
                      setPageRange(event.target.value)
                      clearOutput()
                      setStatus(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyPageRange()
                    }}
                    placeholder="Example: 1-3, 5, 8-10"
                    disabled={isBusy}
                    className="tool-field mt-2"
                    aria-describedby="pdf-page-ranges-help"
                  />
                  <p id="pdf-page-ranges-help" className="mt-1 text-xs text-slate-500">
                    Separate pages and ranges with commas. Ranges stay in the order entered.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applyPageRange}
                  disabled={isBusy}
                  className="tool-secondary-button"
                >
                  Apply ranges
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllPages}
                  disabled={isBusy || selectedPages.length === pageCount}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAllPages}
                  disabled={isBusy || selectedPages.length === 0}
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Deselect all
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {previewPages.map(({ pageNumber, previewUrl }) => {
                  const isSelected = selectedPageSet.has(pageNumber)
                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => togglePageSelection(pageNumber)}
                      disabled={isBusy}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} page ${pageNumber}`}
                      className={`group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <span className="flex h-48 items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/60 p-2">
                        <img
                          src={previewUrl}
                          alt={`Preview of PDF page ${pageNumber}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                      <span className="flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-800">
                        <span>Page {pageNumber}</span>
                        <span
                          aria-hidden="true"
                          className={`flex size-5 items-center justify-center rounded-md border ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          <Check size={14} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={splitSelectedPages}
                  disabled={isBusy}
                  className="tool-primary-button flex-1 disabled:cursor-wait"
                >
                  {isSplitting
                    ? <><LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> Splitting PDF…</>
                    : <><Scissors aria-hidden="true" size={17} /> Split selected pages</>}
                </button>
                <button
                  type="button"
                  onClick={resetPdf}
                  disabled={isBusy}
                  className="tool-secondary-button"
                >
                  <RotateCcw aria-hidden="true" size={16} />
                  Start again
                </button>
              </div>
            </section>
          )}

          {outputPdf && (
            <section
              aria-labelledby="split-result-heading"
              className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-lg shadow-emerald-100/70 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <CheckCircle2 aria-hidden="true" size={21} />
                  </span>
                  <div className="min-w-0">
                    <h2 id="split-result-heading" className="font-semibold text-slate-950">
                      Your split PDF is ready
                    </h2>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {getSplitFilename(pdfFile.name)} · {selectedPages.length} {selectedPages.length === 1 ? 'page' : 'pages'} · {formatFileSize(outputPdf.size)}
                    </p>
                  </div>
                </div>
                {outputPdfUrl && (
                  <a
                    href={outputPdfUrl}
                    download={getSplitFilename(pdfFile.name)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <Download aria-hidden="true" size={17} />
                    Download PDF
                  </a>
                )}
              </div>
            </section>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="pdf-splitter-explanation">
            <h2 id="pdf-splitter-explanation" className="text-2xl font-bold tracking-tight text-slate-950">
              Split PDF pages in your browser
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use this PDF splitter to extract the pages you need into a new document. Upload a PDF, select pages
              from their previews or enter a range such as 1-3, 5, 8-10, then download the resulting file. Thumbnail
              selections follow the document order, while custom ranges follow the order entered. Your document is
              processed locally and is not uploaded to a server.
            </p>
          </section>

          <section aria-labelledby="pdf-splitter-faq">
            <h2 id="pdf-splitter-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200">
              {[
                ['How do I split a PDF?', 'Choose or drop one PDF, select the pages you want from the thumbnails or enter page numbers and ranges, then choose Split selected pages and download the new PDF.'],
                ['Can I extract specific page ranges?', 'Yes. Enter comma-separated pages and ranges, for example 1-3, 5, 8-10. Ranges are checked against the document page count and included in the order entered.'],
                ['Can I select pages individually?', 'Yes. Click any page thumbnail to select or deselect it. Select all and Deselect all are also available.'],
                ['Are my PDF files uploaded?', 'No. The file is opened and split in your browser. The PDF and extracted pages are not sent to a processing server.'],
                ['Which PDFs are supported?', 'Valid PDFs up to 25 MB are supported. Password-protected or corrupted files cannot be processed; remove the password or use a valid copy and try again.'],
              ].map(([question, answer]) => (
                <details key={question} className="py-4">
                  <summary className="cursor-pointer font-semibold text-slate-900 marker:text-indigo-600">
                    {question}
                  </summary>
                  <p className="mt-3 leading-7 text-slate-600">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
