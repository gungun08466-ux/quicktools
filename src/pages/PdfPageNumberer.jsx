import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, MAX_PDF_SIZE_BYTES, validatePdfFile } from '../utils/pdfValidation.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const THUMBNAIL_MAX_WIDTH = 420
const THUMBNAIL_MAX_HEIGHT = 520
const MIN_FONT_SIZE = 6
const MAX_FONT_SIZE = 72
const MAX_START_NUMBER = 999999

function parseHexColor(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(value.trim())
  if (!match) return null

  const digits = match[1].length === 3
    ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
    : match[1]
  const channels = [0, 2, 4].map((index) => Number.parseInt(digits.slice(index, index + 2), 16))

  return {
    hex: `#${digits.toLowerCase()}`,
    color: rgb(channels[0] / 255, channels[1] / 255, channels[2] / 255),
  }
}

function formatPageNumber(number, totalPages, numberFormat) {
  if (numberFormat === 'page') return `Page ${number}`
  if (numberFormat === 'page-of') return `Page ${number} of ${totalPages}`
  return String(number)
}

function renderFirstPageThumbnail(pdf, renderTasksRef) {
  return pdf.getPage(1).then(async (page) => {
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
      throw new Error('This browser could not create a PDF preview.')
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
        if (blob) resolve({ blob, width: viewport.width, height: viewport.height, scale })
        else reject(new Error('The browser could not create a PDF preview.'))
      }, 'image/png')
    })
  })
}

function getPdfLoadError(error) {
  const reason = error instanceof Error ? error.message : ''
  if (error?.name === 'PasswordException' || /password|encrypt/i.test(reason)) {
    return 'This PDF is password-protected. Remove its password and try again.'
  }
  if (/invalid|malformed|corrupt|unexpected end|failed to parse|pdf structure|cannot read properties/i.test(reason)) {
    return 'This file could not be opened as a valid PDF. Check that it is not corrupted and try again.'
  }
  return reason ? `Could not open this PDF: ${reason}` : 'Could not open this PDF. Check the file and try again.'
}

function getNumberedFilename(filename) {
  const baseName = filename
    .replace(/\.pdf$/iu, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
    .trim()
    .replace(/[. ]+$/u, '')
  return `${baseName || 'document'}-numbered.pdf`
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const isInfo = status.type === 'info'
  const Icon = isError ? AlertCircle : isInfo ? LoaderCircle : CheckCircle2
  const colors = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : isInfo
      ? 'border-indigo-100 bg-indigo-50 text-indigo-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${colors}`}
    >
      <Icon aria-hidden="true" size={18} className={`mt-0.5 shrink-0 ${isInfo ? 'animate-spin' : ''}`} />
      <p>{status.message}</p>
    </div>
  )
}

export default function PdfPageNumberer() {
  const [pdfFile, setPdfFile] = useState(null)
  const [sourceBytes, setSourceBytes] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [preview, setPreview] = useState(null)
  const [outputPdf, setOutputPdf] = useState(null)
  const [startingNumber, setStartingNumber] = useState('1')
  const [verticalPosition, setVerticalPosition] = useState('bottom')
  const [horizontalPosition, setHorizontalPosition] = useState('center')
  const [fontSize, setFontSize] = useState('12')
  const [textColor, setTextColor] = useState('#111827')
  const [colorInput, setColorInput] = useState('#111827')
  const [colorError, setColorError] = useState('')
  const [numberFormat, setNumberFormat] = useState('number')
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState(null)

  const fileInputRef = useRef(null)
  const operationIdRef = useRef(0)
  const loadingTaskRef = useRef(null)
  const renderTasksRef = useRef(new Set())
  const previewUrlRef = useRef(null)

  const startValue = Number(startingNumber)
  const fontValue = Number(fontSize)
  const startError = /^\d+$/u.test(startingNumber)
    && Number.isSafeInteger(startValue)
    && startValue >= 1
    && startValue <= MAX_START_NUMBER
    ? ''
    : `Enter a whole number from 1 to ${MAX_START_NUMBER}.`
  const fontError = Number.isFinite(fontValue)
    && fontSize.trim() !== ''
    && fontValue >= MIN_FONT_SIZE
    && fontValue <= MAX_FONT_SIZE
    ? ''
    : `Enter a font size from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} points.`
  const isBusy = isLoading || isProcessing
  const canNumberPdf = Boolean(pdfFile && sourceBytes && pageCount > 0 && !isBusy && !startError && !fontError && !colorError)
  const previewNumber = startError ? 1 : startValue
  const previewLabel = formatPageNumber(previewNumber, pageCount, numberFormat)
  const parsedTextColor = parseHexColor(textColor)
  const hasCustomOptions = startingNumber !== '1'
    || verticalPosition !== 'bottom'
    || horizontalPosition !== 'center'
    || fontSize !== '12'
    || textColor !== '#111827'
    || numberFormat !== 'number'

  const revokePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreview(null)
  }

  const cancelCurrentWork = () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) {
      void loadingTaskRef.current.destroy().catch(() => {})
      loadingTaskRef.current = null
    }
    revokePreview()
    setPdfFile(null)
    setSourceBytes(null)
    setPageCount(0)
    setOutputPdf(null)
    setProgress(0)
    setStatus(null)
    setIsLoading(false)
    setIsProcessing(false)
    return operationIdRef.current
  }

  useEffect(() => () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) {
      void loadingTaskRef.current.destroy().catch(() => {})
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
  }, [])

  const loadPdf = async (file) => {
    if (!file) return
    const operationId = cancelCurrentWork()
    setIsLoading(true)
    setStatus({ type: 'info', message: 'Validating and opening your PDF locally…' })

    let loadingTask = null
    try {
      const validationError = await validatePdfFile(file)
      if (operationIdRef.current !== operationId) return
      if (validationError) {
        setStatus({ type: 'error', message: validationError })
        return
      }

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (operationIdRef.current !== operationId) return
      setProgress(25)

      const editablePdf = await PDFDocument.load(bytes.slice())
      if (operationIdRef.current !== operationId) return
      const editablePageCount = editablePdf.getPageCount()
      if (editablePageCount < 1) throw new Error('The PDF does not contain any pages.')
      setProgress(50)

      loadingTask = getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
      })
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (operationIdRef.current !== operationId) return
      if (pdf.numPages !== editablePageCount) {
        throw new Error('The PDF page preview and editor found different page counts.')
      }

      setProgress(75)
      const thumbnail = await renderFirstPageThumbnail(pdf, renderTasksRef)
      if (operationIdRef.current !== operationId) return

      const previewUrl = URL.createObjectURL(thumbnail.blob)
      previewUrlRef.current = previewUrl
      setPreview({ ...thumbnail, url: previewUrl })
      setPdfFile(file)
      setSourceBytes(bytes)
      setPageCount(pdf.numPages)
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Choose the numbering style and add page numbers to every page.`,
      })
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      revokePreview()
      setPdfFile(null)
      setSourceBytes(null)
      setPageCount(0)
      setOutputPdf(null)
      setProgress(0)
      setStatus({ type: 'error', message: getPdfLoadError(error) })
    } finally {
      if (loadingTask && loadingTaskRef.current === loadingTask) {
        loadingTaskRef.current = null
        await loadingTask.destroy().catch(() => {})
      }
      if (operationIdRef.current === operationId) setIsLoading(false)
    }
  }

  const handleFileInput = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void loadPdf(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 1) {
      setStatus({ type: 'error', message: 'Choose one PDF file at a time.' })
      return
    }
    if (files[0]) void loadPdf(files[0])
  }

  const updateStartingNumber = (value) => {
    setStartingNumber(value)
    invalidateOutput()
  }

  const updateFontSize = (value) => {
    setFontSize(value)
    invalidateOutput()
  }

  const invalidateOutput = () => {
    setOutputPdf(null)
    setStatus((currentStatus) => currentStatus?.type === 'success' ? null : currentStatus)
  }

  const updateTextColor = (value) => {
    setColorInput(value)
    invalidateOutput()
    const parsedColor = parseHexColor(value)
    if (!parsedColor) {
      setColorError('Enter a valid 3- or 6-digit HEX color.')
      return
    }
    setTextColor(parsedColor.hex)
    setColorError('')
  }

  const addPageNumbers = async () => {
    if (!canNumberPdf || !sourceBytes) return
    const operationId = operationIdRef.current
    setIsProcessing(true)
    setProgress(0)
    setOutputPdf(null)
    setStatus({ type: 'info', message: 'Adding page numbers to a copy of your PDF…' })

    try {
      const document = await PDFDocument.load(sourceBytes.slice())
      const font = await document.embedFont(StandardFonts.Helvetica)
      const pages = document.getPages()
      const color = parsedTextColor.color

      for (let index = 0; index < pages.length; index += 1) {
        if (operationIdRef.current !== operationId) return
        const page = pages[index]
        const { width, height } = page.getSize()
        const pageNumber = startValue + index
        const label = formatPageNumber(pageNumber, pages.length, numberFormat)
        const textWidth = font.widthOfTextAtSize(label, fontValue)
        const margin = Math.min(36, Math.max(12, Math.min(width, height) * 0.05))
        if (textWidth + margin * 2 > width || fontValue + margin * 2 > height) {
          throw new Error(`The selected font size is too large to fit page ${index + 1}. Reduce the font size and try again.`)
        }

        const x = horizontalPosition === 'left'
          ? margin
          : horizontalPosition === 'right'
            ? width - textWidth - margin
            : (width - textWidth) / 2
        const y = verticalPosition === 'top'
          ? height - fontValue - margin
          : margin

        page.drawText(label, {
          x,
          y,
          size: fontValue,
          font,
          color,
        })
        setProgress(Math.round(((index + 1) / pages.length) * 90))
        if ((index + 1) % 10 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0))
        }
      }

      const bytes = await document.save()
      if (operationIdRef.current !== operationId) return
      setOutputPdf(new Blob([bytes], { type: 'application/pdf' }))
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Added page numbers to all ${pages.length} page${pages.length === 1 ? '' : 's'}. Your original PDF remains unchanged.`,
      })
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      const reason = error instanceof Error ? error.message : ''
      setStatus({
        type: 'error',
        message: reason ? `Could not number this PDF: ${reason}` : 'Could not number this PDF. Check the file and try again.',
      })
      setProgress(0)
    } finally {
      if (operationIdRef.current === operationId) setIsProcessing(false)
    }
  }

  const downloadOutput = () => {
    if (!outputPdf || !pdfFile || isBusy) return
    const url = URL.createObjectURL(outputPdf)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getNumberedFilename(pdfFile.name)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus({ type: 'success', message: 'Your numbered PDF download has started.' })
  }

  const reset = () => {
    cancelCurrentWork()
    setStartingNumber('1')
    setVerticalPosition('bottom')
    setHorizontalPosition('center')
    setFontSize('12')
    setTextColor('#111827')
    setColorInput('#111827')
    setColorError('')
    setNumberFormat('number')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const previewScale = preview?.scale ?? 1
  const previewFontSize = Math.max(10, Math.min(22, fontValue * previewScale))
  const previewPageWidth = preview ? preview.width / preview.scale : 1
  const previewPageHeight = preview ? preview.height / preview.scale : 1
  const previewMargin = preview
    ? Math.min(36, Math.max(12, Math.min(previewPageWidth, previewPageHeight) * 0.05))
    : 0
  const previewHorizontalMargin = `${(previewMargin / previewPageWidth) * 100}%`
  const previewVerticalMargin = `${(previewMargin / previewPageHeight) * 100}%`
  const previewPosition = {
    top: verticalPosition === 'top' ? previewVerticalMargin : undefined,
    bottom: verticalPosition === 'bottom' ? previewVerticalMargin : undefined,
    left: horizontalPosition === 'left' ? previewHorizontalMargin : horizontalPosition === 'center' ? '50%' : undefined,
    right: horizontalPosition === 'right' ? previewHorizontalMargin : undefined,
    transform: horizontalPosition === 'center' ? 'translateX(-50%)' : undefined,
    color: textColor,
    fontSize: `${previewFontSize}px`,
  }

  return (
    <>
      <PageMetadata
        title="PDF Page Numberer - Add Page Numbers to a PDF"
        description="Add page numbers to every page of a PDF. Choose the starting number, position, font size, color, and label format, then download your numbered PDF. Files stay in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">PDF Page Numberer</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Add page numbers to a PDF, customize their appearance, and download a new copy. Your original file is never changed or uploaded.
          </p>
        </header>

        <section
          aria-label="PDF page numberer"
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
          }}
          onDrop={handleDrop}
          className={`tool-surface-raised space-y-5 p-4 transition sm:p-6 ${isDragging ? 'ring-4 ring-indigo-200' : ''}`}
        >
          <input
            ref={fileInputRef}
            id="pdf-page-numberer-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            disabled={isBusy}
            className="sr-only"
            aria-label="Choose a PDF to number"
          />

          {!pdfFile && !isLoading && (
            <label
              htmlFor="pdf-page-numberer-file"
              className="tool-dropzone flex min-h-56 cursor-pointer flex-col items-center justify-center p-6 text-center transition focus-within:ring-4 focus-within:ring-indigo-100 sm:min-h-64"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">Drop a PDF here to add page numbers</span>
              <span className="mt-1 text-sm text-slate-600">or select a PDF from your device</span>
              <span className="tool-primary-button mt-5">
                <FilePlus2 aria-hidden="true" size={17} />
                Choose PDF
              </span>
              <span className="mt-4 text-xs leading-5 text-slate-500">
                One PDF · {formatFileSize(MAX_PDF_SIZE_BYTES)} maximum · processed locally
              </span>
            </label>
          )}

          {isLoading && (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-800" role="status">
              <LoaderCircle aria-hidden="true" size={25} className="animate-spin" />
              <p className="mt-3 text-sm font-medium">Opening PDF and creating a preview…</p>
              {progress > 0 && (
                <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-indigo-100">
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          {pdfFile && !isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <FileText aria-hidden="true" size={21} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-slate-950">{pdfFile.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatFileSize(pdfFile.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="tool-secondary-button"
              >
                <FilePlus2 aria-hidden="true" size={16} />
                Choose another PDF
              </button>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section aria-labelledby="numbering-options-heading" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 id="numbering-options-heading" className="text-lg font-semibold text-slate-950">Numbering options</h2>
              <p className="mt-1 text-sm text-slate-500">The first page uses the starting number you choose.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="pdf-start-number" className="block text-sm font-semibold text-slate-700">Starting page number</label>
                  <input
                    id="pdf-start-number"
                    type="number"
                    min="1"
                    max={MAX_START_NUMBER}
                    step="1"
                    value={startingNumber}
                    onChange={(event) => updateStartingNumber(event.target.value)}
                    disabled={isBusy}
                    aria-invalid={Boolean(startError)}
                    aria-describedby={startError ? 'pdf-start-number-error' : undefined}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  />
                  {startError && <p id="pdf-start-number-error" className="mt-1 text-sm text-red-700">{startError}</p>}
                </div>
                <div>
                  <label htmlFor="pdf-font-size" className="block text-sm font-semibold text-slate-700">Font size (points)</label>
                  <input
                    id="pdf-font-size"
                    type="number"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    step="1"
                    value={fontSize}
                    onChange={(event) => updateFontSize(event.target.value)}
                    disabled={isBusy}
                    aria-invalid={Boolean(fontError)}
                    aria-describedby={fontError ? 'pdf-font-size-error' : undefined}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  />
                  {fontError && <p id="pdf-font-size-error" className="mt-1 text-sm text-red-700">{fontError}</p>}
                </div>
                <div>
                  <label htmlFor="pdf-vertical-position" className="block text-sm font-semibold text-slate-700">Vertical position</label>
                  <select
                    id="pdf-vertical-position"
                    value={verticalPosition}
                    disabled={isBusy}
                    onChange={(event) => {
                      setVerticalPosition(event.target.value)
                      invalidateOutput()
                    }}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pdf-horizontal-position" className="block text-sm font-semibold text-slate-700">Horizontal alignment</label>
                  <select
                    id="pdf-horizontal-position"
                    value={horizontalPosition}
                    disabled={isBusy}
                    onChange={(event) => {
                      setHorizontalPosition(event.target.value)
                      invalidateOutput()
                    }}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pdf-number-format" className="block text-sm font-semibold text-slate-700">Number format</label>
                  <select
                    id="pdf-number-format"
                    value={numberFormat}
                    disabled={isBusy}
                    onChange={(event) => {
                      setNumberFormat(event.target.value)
                      invalidateOutput()
                    }}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  >
                    <option value="number">1</option>
                    <option value="page">Page 1</option>
                    <option value="page-of">Page 1 of 10</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="pdf-text-color" className="block text-sm font-semibold text-slate-700">Text color</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Choose page number text color"
                      value={textColor}
                      onChange={(event) => updateTextColor(event.target.value)}
                      disabled={isBusy}
                      className="size-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <input
                      id="pdf-text-color"
                      type="text"
                      value={colorInput}
                      onChange={(event) => updateTextColor(event.target.value)}
                      disabled={isBusy}
                      onBlur={() => {
                        if (!colorError) setColorInput(textColor)
                      }}
                      aria-invalid={Boolean(colorError)}
                      aria-describedby={colorError ? 'pdf-text-color-error' : undefined}
                      className="tool-editor min-w-0 flex-1 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  {colorError && <p id="pdf-text-color-error" className="mt-1 text-sm text-red-700">{colorError}</p>}
                </div>
              </div>
            </section>

            <section aria-labelledby="page-preview-heading" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="page-preview-heading" className="text-lg font-semibold text-slate-950">Page preview</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {preview ? `Page 1 of ${pageCount}` : 'Upload a PDF to preview the numbering.'}
                  </p>
                </div>
                {preview && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">Preview</span>}
              </div>
              {preview ? (
                <div className="mt-4 flex justify-center">
                  <div
                    className="relative overflow-hidden border border-slate-300 bg-white shadow-sm"
                    style={{ width: 'min(100%, 360px)', aspectRatio: `${preview.width} / ${preview.height}` }}
                  >
                    <img src={preview.url} alt={`Preview of page 1 from ${pdfFile.name}`} className="absolute inset-0 size-full object-contain" />
                    <span
                      aria-label={`Page number preview: ${previewLabel}`}
                      className="absolute whitespace-nowrap font-sans font-medium leading-none"
                      style={previewPosition}
                    >
                      {previewLabel}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 text-center text-sm text-slate-500">
                  Upload a valid PDF to see a page preview.
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addPageNumbers} disabled={!canNumberPdf} className="tool-primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {isProcessing ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <FileText aria-hidden="true" size={17} />}
              {isProcessing ? 'Adding page numbers…' : 'Add page numbers'}
            </button>
            <button type="button" onClick={downloadOutput} disabled={!outputPdf || isBusy} className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              <Download aria-hidden="true" size={16} />
              Download numbered PDF
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!pdfFile && !status && !outputPdf && !hasCustomOptions}
              className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw aria-hidden="true" size={16} />
              Reset
            </button>
          </div>

          {isProcessing && (
            <div aria-label="Numbering progress" className="h-2 overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <StatusMessage status={status} />
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-pdf-page-numberer">
            <h2 id="about-pdf-page-numberer" className="text-2xl font-bold tracking-tight text-slate-950">
              Add page numbers to a PDF
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Choose a starting number, position, font size, text color, and one of three label styles. The preview shows the first page; numbering is applied to every page in the downloaded copy. Your original PDF remains untouched, and processing happens locally in your browser.
            </p>
          </section>

          <section aria-labelledby="pdf-page-numberer-faq">
            <h2 id="pdf-page-numberer-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How are the page numbers added?', 'A new numbered copy is created in your browser. The uploaded source file is not modified, and the number is drawn on every page.'],
                ['Can numbering start at a number other than 1?', 'Yes. Set the starting page number before adding numbers. Each following PDF page increments it by one.'],
                ['Which number formats are available?', 'Use a plain number such as 1, a label such as Page 1, or a label with the document total such as Page 1 of 10.'],
                ['Can I change the position and appearance?', 'Choose top or bottom, left, center, or right alignment, a font size from 6 to 72 points, and a text color.'],
                ['Is my PDF uploaded?', 'No. The PDF is read, previewed, and numbered locally in your browser. Files up to 25 MB are accepted.'],
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
