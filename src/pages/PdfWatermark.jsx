import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib'
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
const MAX_FONT_SIZE = 120
const MAX_TEXT_LENGTH = 120

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

function parsePageRanges(value, pageCount) {
  if (!value.trim()) return { pages: [], error: 'Enter at least one page number or range.' }

  const pages = new Set()
  for (const rawRange of value.split(',')) {
    const range = rawRange.trim()
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/u.exec(range)
    if (!match) {
      return { pages: [], error: `“${range || 'empty range'}” is not a valid page number or range.` }
    }

    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end > pageCount) {
      return { pages: [], error: `Page ranges must be between 1 and ${pageCount}.` }
    }
    if (start > end) {
      return { pages: [], error: `The range ${range} ends before it starts.` }
    }
    for (let page = start; page <= end; page += 1) pages.add(page)
  }

  return { pages: [...pages].sort((a, b) => a - b), error: '' }
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

function getWatermarkPlacement(font, text, fontSize, pageWidth, pageHeight, position, rotationAngle, pageNumber) {
  const textWidth = font.widthOfTextAtSize(text, fontSize)
  const textHeight = font.heightAtSize(fontSize)
  const radians = (rotationAngle * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const corners = [
    [0, 0],
    [textWidth, 0],
    [0, textHeight],
    [textWidth, textHeight],
  ].map(([x, y]) => [x * cosine - y * sine, x * sine + y * cosine])
  const minX = Math.min(...corners.map(([x]) => x))
  const maxX = Math.max(...corners.map(([x]) => x))
  const minY = Math.min(...corners.map(([, y]) => y))
  const maxY = Math.max(...corners.map(([, y]) => y))
  const boundsWidth = maxX - minX
  const boundsHeight = maxY - minY
  const margin = Math.min(32, Math.max(12, Math.min(pageWidth, pageHeight) * 0.04))

  if (boundsWidth + margin * 2 > pageWidth || boundsHeight + margin * 2 > pageHeight) {
    throw new Error(`The watermark is too large to fit page ${pageNumber}. Reduce its font size or rotation.`)
  }

  const centerX = pageWidth / 2
  let centerY = pageHeight / 2
  if (position === 'top') centerY = pageHeight - margin - boundsHeight / 2
  if (position === 'bottom') centerY = margin + boundsHeight / 2

  return {
    x: centerX - (minX + maxX) / 2,
    y: centerY - (minY + maxY) / 2,
  }
}

function getPdfLoadError(error) {
  const reason = error instanceof Error ? error.message : ''
  if (error?.name === 'PasswordException' || /password|encrypt/iu.test(reason)) {
    return 'This PDF is password-protected. Remove its password and try again.'
  }
  if (/invalid|malformed|corrupt|unexpected end|failed to parse|pdf structure|no pdf header|trailer|xref|cannot read properties/iu.test(reason)) {
    return 'This file could not be opened as a valid PDF. Check that it is not corrupted and try again.'
  }
  return reason ? `Could not open this PDF: ${reason}` : 'Could not open this PDF. Check the file and try again.'
}

function getWatermarkError(error) {
  const reason = error instanceof Error ? error.message : ''
  if (/winansi|cannot encode|could not encode/iu.test(reason)) {
    return 'The built-in PDF font cannot display some characters in this text. Try using basic Latin characters.'
  }
  if (/memory|allocation|array buffer/iu.test(reason)) {
    return 'The browser ran out of memory while saving this PDF. Try a smaller document.'
  }
  return reason ? `Could not add the watermark: ${reason}` : 'Could not add the watermark. Check the PDF and try again.'
}

function getWatermarkedFilename(filename) {
  const baseName = filename
    .replace(/\.pdf$/iu, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
    .trim()
    .replace(/[. ]+$/u, '')
  return `${baseName || 'document'}-watermarked.pdf`
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

export default function PdfWatermark() {
  const [pdfFile, setPdfFile] = useState(null)
  const [sourceBytes, setSourceBytes] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [preview, setPreview] = useState(null)
  const [outputPdf, setOutputPdf] = useState(null)
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL')
  const [fontSize, setFontSize] = useState('48')
  const [textColor, setTextColor] = useState('#dc2626')
  const [colorInput, setColorInput] = useState('#dc2626')
  const [colorError, setColorError] = useState('')
  const [opacity, setOpacity] = useState('30')
  const [rotation, setRotation] = useState('45')
  const [position, setPosition] = useState('diagonal')
  const [pageMode, setPageMode] = useState('all')
  const [pageRanges, setPageRanges] = useState('1')
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

  const fontSizeValue = Number(fontSize)
  const opacityValue = Number(opacity)
  const rotationValue = Number(rotation)
  const fontSizeError = Number.isInteger(fontSizeValue)
    && fontSizeValue >= MIN_FONT_SIZE
    && fontSizeValue <= MAX_FONT_SIZE
    ? ''
    : `Enter a whole number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE} points.`
  const opacityError = Number.isFinite(opacityValue) && opacityValue >= 0 && opacityValue <= 100
    ? ''
    : 'Choose an opacity between 0% and 100%.'
  const rotationError = rotation.trim() !== ''
    && Number.isInteger(rotationValue)
    && rotationValue >= -180
    && rotationValue <= 180
    ? ''
    : 'Enter a whole-number angle from -180° to 180°.'
  const textError = watermarkText.trim()
    ? watermarkText.length <= MAX_TEXT_LENGTH
      ? ''
      : `Watermark text must be ${MAX_TEXT_LENGTH} characters or fewer.`
    : 'Enter the text to use as a watermark.'
  const rangeResult = pageCount > 0
    ? parsePageRanges(pageRanges, pageCount)
    : { pages: [], error: 'Upload a PDF to set page ranges.' }
  const rangeError = pageMode === 'selected' ? rangeResult.error : ''
  const parsedTextColor = parseHexColor(textColor)
  const isBusy = isLoading || isProcessing
  const canApplyWatermark = Boolean(
    pdfFile
    && sourceBytes
    && pageCount > 0
    && !isBusy
    && !textError
    && !fontSizeError
    && !opacityError
    && !rotationError
    && !colorError
    && !rangeError,
  )
  const selectedPageCount = pageMode === 'all' ? pageCount : rangeResult.pages.length
  const previewFontSize = Math.max(8, Math.min(42, fontSizeValue * (preview?.scale ?? 1)))
  const previewPageOneSelected = pageMode === 'all' || rangeResult.pages.includes(1)
  const hasCustomOptions = watermarkText !== 'CONFIDENTIAL'
    || fontSize !== '48'
    || textColor !== '#dc2626'
    || opacity !== '30'
    || rotation !== '45'
    || position !== 'diagonal'
    || pageMode !== 'all'
    || pageRanges !== '1'

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

      const editablePdf = await PDFDocument.load(bytes.slice())
      if (operationIdRef.current !== operationId) return
      const editablePageCount = editablePdf.getPageCount()
      if (editablePageCount < 1) throw new Error('The PDF does not contain any pages.')

      loadingTask = getDocument({ data: bytes.slice(), isEvalSupported: false })
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (operationIdRef.current !== operationId) return
      if (pdf.numPages !== editablePageCount) {
        throw new Error('The PDF preview and editor found different page counts.')
      }

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
        message: `Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Customize the watermark and preview it before downloading.`,
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
    if (isBusy) return
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 1) {
      setStatus({ type: 'error', message: 'Choose one PDF file at a time.' })
      return
    }
    if (files[0]) void loadPdf(files[0])
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

  const applyWatermark = async () => {
    if (!canApplyWatermark || !sourceBytes) return
    const operationId = operationIdRef.current
    const targetPages = pageMode === 'all'
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : rangeResult.pages
    setIsProcessing(true)
    setProgress(0)
    setOutputPdf(null)
    setStatus({ type: 'info', message: 'Adding the watermark to a copy of your PDF…' })

    try {
      const document = await PDFDocument.load(sourceBytes.slice())
      if (operationIdRef.current !== operationId) return
      if (document.getPageCount() !== pageCount) {
        throw new Error('The PDF page count changed while it was being processed. Upload the file again.')
      }

      const font = await document.embedFont(StandardFonts.HelveticaBold)
      const pages = document.getPages()
      const color = parsedTextColor.color

      for (let index = 0; index < targetPages.length; index += 1) {
        if (operationIdRef.current !== operationId) return
        const pageNumber = targetPages[index]
        const page = pages[pageNumber - 1]
        const { width, height } = page.getSize()
        const placement = getWatermarkPlacement(
          font,
          watermarkText,
          fontSizeValue,
          width,
          height,
          position,
          rotationValue,
          pageNumber,
        )

        page.drawText(watermarkText, {
          ...placement,
          size: fontSizeValue,
          font,
          color,
          opacity: opacityValue / 100,
          rotate: degrees(rotationValue),
        })
        setProgress(Math.round(((index + 1) / targetPages.length) * 90))
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
        message: `Added the watermark to ${targetPages.length} page${targetPages.length === 1 ? '' : 's'}. Your original PDF remains unchanged.`,
      })
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      setStatus({ type: 'error', message: getWatermarkError(error) })
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
    anchor.download = getWatermarkedFilename(pdfFile.name)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus({ type: 'success', message: 'Your watermarked PDF download has started.' })
  }

  const reset = () => {
    cancelCurrentWork()
    setWatermarkText('CONFIDENTIAL')
    setFontSize('48')
    setTextColor('#dc2626')
    setColorInput('#dc2626')
    setColorError('')
    setOpacity('30')
    setRotation('45')
    setPosition('diagonal')
    setPageMode('all')
    setPageRanges('1')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const previewStyle = {
    left: '50%',
    top: position === 'top' ? '6%' : position === 'bottom' ? undefined : '50%',
    bottom: position === 'bottom' ? '6%' : undefined,
    transform: `translate(-50%, ${position === 'top' || position === 'bottom' ? '0' : '-50%'}) rotate(${-rotationValue}deg)`,
    color: textColor,
    opacity: opacityValue / 100,
    fontSize: `${previewFontSize}px`,
  }

  return (
    <>
      <PageMetadata
        title="PDF Watermark - Add Text Watermarks to PDF"
        description="Add a customizable text watermark to every PDF page or selected page ranges. Adjust size, color, opacity, rotation, and position, then download your PDF locally."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">PDF Watermark</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Add a customizable text watermark to every page or selected ranges. Preview the design and download a new copy—your original PDF stays on your device.
          </p>
        </header>

        <section
          aria-label="PDF watermark tool"
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
            id="pdf-watermark-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            disabled={isBusy}
            className="sr-only"
            aria-label="Choose a PDF to watermark"
          />

          {!pdfFile && !isLoading && (
            <label
              htmlFor="pdf-watermark-file"
              className="tool-dropzone flex min-h-56 cursor-pointer flex-col items-center justify-center p-6 text-center transition focus-within:ring-4 focus-within:ring-indigo-100 sm:min-h-64"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">Drop a PDF here to add a watermark</span>
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
            <section aria-labelledby="watermark-options-heading" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 id="watermark-options-heading" className="text-lg font-semibold text-slate-950">Watermark settings</h2>
              <p className="mt-1 text-sm text-slate-500">The preview updates as you change the settings.</p>

              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="pdf-watermark-text" className="block text-sm font-semibold text-slate-700">Watermark text</label>
                  <input
                    id="pdf-watermark-text"
                    type="text"
                    maxLength={MAX_TEXT_LENGTH}
                    value={watermarkText}
                    onChange={(event) => {
                      setWatermarkText(event.target.value)
                      invalidateOutput()
                    }}
                    disabled={isBusy}
                    aria-invalid={Boolean(textError)}
                    aria-describedby={textError ? 'pdf-watermark-text-error' : undefined}
                    className="tool-editor mt-1 w-full px-3 py-2"
                  />
                  {textError && <p id="pdf-watermark-text-error" className="mt-1 text-sm text-red-700">{textError}</p>}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pdf-watermark-font-size" className="block text-sm font-semibold text-slate-700">Font size (points)</label>
                    <input
                      id="pdf-watermark-font-size"
                      type="number"
                      min={MIN_FONT_SIZE}
                      max={MAX_FONT_SIZE}
                      step="1"
                      value={fontSize}
                      onChange={(event) => {
                        setFontSize(event.target.value)
                        invalidateOutput()
                      }}
                      disabled={isBusy}
                      aria-invalid={Boolean(fontSizeError)}
                      aria-describedby={fontSizeError ? 'pdf-watermark-font-size-error' : undefined}
                      className="tool-editor mt-1 w-full px-3 py-2"
                    />
                    {fontSizeError && <p id="pdf-watermark-font-size-error" className="mt-1 text-sm text-red-700">{fontSizeError}</p>}
                  </div>
                  <div>
                    <label htmlFor="pdf-watermark-rotation" className="block text-sm font-semibold text-slate-700">Rotation angle</label>
                    <div className="relative mt-1">
                      <input
                        id="pdf-watermark-rotation"
                        type="number"
                        min="-180"
                        max="180"
                        step="1"
                        value={rotation}
                        onChange={(event) => {
                          setRotation(event.target.value)
                          invalidateOutput()
                        }}
                        disabled={isBusy}
                        aria-invalid={Boolean(rotationError)}
                        aria-describedby={rotationError ? 'pdf-watermark-rotation-error' : undefined}
                        className="tool-editor w-full px-3 py-2 pr-9"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">°</span>
                    </div>
                    {rotationError && <p id="pdf-watermark-rotation-error" className="mt-1 text-sm text-red-700">{rotationError}</p>}
                  </div>
                  <div>
                    <label htmlFor="pdf-watermark-position" className="block text-sm font-semibold text-slate-700">Position</label>
                    <select
                      id="pdf-watermark-position"
                      value={position}
                      disabled={isBusy}
                      onChange={(event) => {
                        setPosition(event.target.value)
                        invalidateOutput()
                      }}
                      className="tool-editor mt-1 w-full px-3 py-2"
                    >
                      <option value="center">Center</option>
                      <option value="diagonal">Diagonal</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pdf-watermark-color" className="block text-sm font-semibold text-slate-700">Text color</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        id="pdf-watermark-color-picker"
                        type="color"
                        aria-label="Choose watermark text color"
                        value={textColor}
                        onChange={(event) => updateTextColor(event.target.value)}
                        disabled={isBusy}
                        className="size-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                      />
                      <input
                        id="pdf-watermark-color"
                        type="text"
                        value={colorInput}
                        onChange={(event) => updateTextColor(event.target.value)}
                        onBlur={() => {
                          if (!colorError) setColorInput(textColor)
                        }}
                        disabled={isBusy}
                        aria-invalid={Boolean(colorError)}
                        aria-describedby={colorError ? 'pdf-watermark-color-error' : undefined}
                        className="tool-editor min-w-0 flex-1 px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    {colorError && <p id="pdf-watermark-color-error" className="mt-1 text-sm text-red-700">{colorError}</p>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="pdf-watermark-opacity" className="text-sm font-semibold text-slate-700">Opacity</label>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">{opacity}%</span>
                  </div>
                  <input
                    id="pdf-watermark-opacity"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={opacity}
                    onChange={(event) => {
                      setOpacity(event.target.value)
                      invalidateOutput()
                    }}
                    disabled={isBusy}
                    aria-describedby={opacityError ? 'pdf-watermark-opacity-error' : undefined}
                    className="mt-2 w-full accent-indigo-600"
                  />
                  {opacityError && <p id="pdf-watermark-opacity-error" className="mt-1 text-sm text-red-700">{opacityError}</p>}
                </div>

                <fieldset>
                  <legend className="text-sm font-semibold text-slate-700">Pages to watermark</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                      <input
                        type="radio"
                        name="pdf-watermark-page-mode"
                        value="all"
                        checked={pageMode === 'all'}
                        onChange={() => {
                          setPageMode('all')
                          invalidateOutput()
                        }}
                        disabled={isBusy}
                        className="accent-indigo-600"
                      />
                      All pages
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                      <input
                        type="radio"
                        name="pdf-watermark-page-mode"
                        value="selected"
                        checked={pageMode === 'selected'}
                        onChange={() => {
                          setPageMode('selected')
                          invalidateOutput()
                        }}
                        disabled={isBusy}
                        className="accent-indigo-600"
                      />
                      Page ranges
                    </label>
                  </div>
                  {pageMode === 'selected' && (
                    <div className="mt-3">
                      <label htmlFor="pdf-watermark-ranges" className="block text-sm font-medium text-slate-700">Page numbers or ranges</label>
                      <input
                        id="pdf-watermark-ranges"
                        type="text"
                        value={pageRanges}
                        onChange={(event) => {
                          setPageRanges(event.target.value)
                          invalidateOutput()
                        }}
                        placeholder="1-3, 5, 8-10"
                        disabled={isBusy}
                        aria-invalid={Boolean(rangeError)}
                        aria-describedby={rangeError ? 'pdf-watermark-ranges-error' : 'pdf-watermark-ranges-help'}
                        className="tool-editor mt-1 w-full px-3 py-2"
                      />
                      <p id="pdf-watermark-ranges-help" className="mt-1 text-xs text-slate-500">
                        Example: 1-3, 5, 8-10. {rangeResult.pages.length} page{rangeResult.pages.length === 1 ? '' : 's'} selected.
                      </p>
                      {rangeError && <p id="pdf-watermark-ranges-error" className="mt-1 text-sm text-red-700">{rangeError}</p>}
                    </div>
                  )}
                  {pageMode === 'all' && pageCount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">The watermark will be added to all {pageCount} pages.</p>
                  )}
                </fieldset>
              </div>
            </section>

            <section aria-labelledby="watermark-preview-heading" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="watermark-preview-heading" className="text-lg font-semibold text-slate-950">Page preview</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {preview ? `Page 1 of ${pageCount}` : 'Upload a PDF to preview the watermark.'}
                  </p>
                </div>
                {preview && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">Preview</span>}
              </div>
              {preview ? (
                <>
                  <div className="mt-4 flex justify-center">
                    <div
                      className="relative overflow-hidden border border-slate-300 bg-white shadow-sm"
                      style={{ width: 'min(100%, 360px)', aspectRatio: `${preview.width} / ${preview.height}` }}
                    >
                      <img src={preview.url} alt={`Preview of page 1 from ${pdfFile.name}`} className="absolute inset-0 size-full object-contain" />
                      {watermarkText.trim() && !textError && (
                        <span
                          aria-label={`Watermark preview: ${watermarkText}`}
                          className="absolute whitespace-nowrap font-sans font-bold leading-none"
                          style={previewStyle}
                        >
                          {watermarkText}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                    {previewPageOneSelected
                      ? 'Live appearance preview. The watermark will be applied to page 1.'
                      : 'Appearance preview only. Page 1 is outside the selected page ranges.'}
                  </p>
                </>
              ) : (
                <div className="mt-4 flex min-h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-5 text-center text-sm text-slate-500">
                  Upload a valid PDF to preview the watermark.
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyWatermark} disabled={!canApplyWatermark} className="tool-primary-button disabled:cursor-not-allowed disabled:opacity-50">
              {isProcessing ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> : <FileText aria-hidden="true" size={17} />}
              {isProcessing ? 'Applying watermark…' : 'Apply watermark'}
            </button>
            <button type="button" onClick={downloadOutput} disabled={!outputPdf || isBusy} className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50">
              <Download aria-hidden="true" size={16} />
              Download watermarked PDF
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
            <div aria-label="Watermark progress" className="h-2 overflow-hidden rounded-full bg-indigo-100">
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          <StatusMessage status={status} />
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-pdf-watermark">
            <h2 id="about-pdf-watermark" className="text-2xl font-bold tracking-tight text-slate-950">
              Add a text watermark to a PDF
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Set the watermark text, size, color, opacity, rotation, and position, then apply it to every page or enter specific page ranges. The preview updates as you adjust the settings. A new PDF copy is generated locally in your browser; the uploaded file is never changed or sent to a server.
            </p>
          </section>

          <section aria-labelledby="pdf-watermark-faq">
            <h2 id="pdf-watermark-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Can I watermark only certain pages?', 'Yes. Choose Page ranges and enter individual pages or ranges such as 1-3, 5, 8-10. Page numbers must exist in the uploaded PDF.'],
                ['Can I adjust the watermark appearance?', 'Yes. Set its text, font size, HEX color, opacity, rotation angle, and position. The preview updates before you create the download.'],
                ['Will this change my original PDF?', 'No. The watermark is added to a separate copy in your browser. The uploaded file remains unchanged.'],
                ['Are PDF files uploaded?', 'No. Validation, preview, and watermarking happen locally in your browser. PDFs up to 25 MB are supported.'],
                ['Why are some watermark characters unavailable?', 'This tool uses a built-in PDF font. Some characters, such as emoji or certain non-Latin scripts, may not be supported; the tool reports an error rather than silently replacing them.'],
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
