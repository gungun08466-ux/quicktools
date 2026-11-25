import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
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
  const Icon = isError ? AlertCircle : CheckCircle2

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
      <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

function renderPageToJpeg(pdf, pageNumber, scale, quality, renderTasksRef) {
  return pdf.getPage(pageNumber).then(async (page) => {
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      page.cleanup()
      throw new Error('This browser could not create an image canvas.')
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

    const width = canvas.width
    const height = canvas.height
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        canvas.width = 0
        canvas.height = 0
        if (result) resolve(result)
        else reject(new Error('The browser could not encode a JPG image.'))
      }, 'image/jpeg', quality)
    })

    return { blob, width, height }
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

function paddedPageNumber(pageNumber, pageCount) {
  return String(pageNumber).padStart(String(pageCount).length, '0')
}

export default function PdfToJpg() {
  const fileInputRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const operationIdRef = useRef(0)
  const renderTasksRef = useRef(new Set())
  const previewUrlsRef = useRef(new Set())
  const outputUrlsRef = useRef(new Set())
  const processingRef = useRef(false)

  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewPages, setPreviewPages] = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [pageMode, setPageMode] = useState('all')
  const [quality, setQuality] = useState(0.85)
  const [scale, setScale] = useState(1.5)
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [progress, setProgress] = useState(0)
  const [outputImages, setOutputImages] = useState([])
  const [zipBlob, setZipBlob] = useState(null)
  const [zipUrl, setZipUrl] = useState('')

  useEffect(() => {
    if (!zipBlob) {
      setZipUrl('')
      return undefined
    }

    const url = URL.createObjectURL(zipBlob)
    setZipUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [zipBlob])

  useEffect(() => () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) loadingTaskRef.current.destroy()
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
    outputUrlsRef.current.clear()
  }, [])

  const clearOutputImages = () => {
    outputUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    outputUrlsRef.current.clear()
    setOutputImages([])
    setZipBlob(null)
  }

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
    clearOutputImages()
    setPdfFile(null)
    setPageCount(0)
    setPreviewPages([])
    setSelectedPages([])
    setProgress(0)
    setStatus(null)
    setIsLoading(false)
    setIsConverting(false)
    setIsZipping(false)
    processingRef.current = false
    return operationIdRef.current
  }

  const loadPdf = async (file) => {
    const operationId = cancelDocumentWork()
    setIsLoading(true)
    setStatus({ type: 'success', message: 'Validating and opening your PDF locally…' })

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
      if (operationIdRef.current !== operationId) {
        return
      }

      pdfDocumentRef.current = pdf
      setPdfFile(file)
      setPageCount(pdf.numPages)
      setSelectedPages(Array.from({ length: pdf.numPages }, (_, index) => index + 1))
      setPageMode('all')

      const nextPreviewPages = []
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const baseViewport = page.getViewport({ scale: 1 })
        const thumbnailScale = Math.min(
          1,
          THUMBNAIL_MAX_WIDTH / baseViewport.width,
          THUMBNAIL_MAX_HEIGHT / baseViewport.height,
        )
        page.cleanup()
        const thumbnail = await renderPageToJpeg(pdf, pageNumber, thumbnailScale, 0.65, renderTasksRef)
        if (operationIdRef.current !== operationId) return

        const previewUrl = URL.createObjectURL(thumbnail.blob)
        previewUrlsRef.current.add(previewUrl)
        nextPreviewPages.push({ pageNumber, previewUrl })
        setPreviewPages([...nextPreviewPages])
        setProgress(Math.round((pageNumber / pdf.numPages) * 100))
      }

      if (operationIdRef.current === operationId) {
        setStatus({
          type: 'success',
          message: `Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Choose which pages to convert.`,
        })
      }
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      pdfDocumentRef.current = null
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
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
    handleFileSelection(event.dataTransfer.files)
  }

  const resetPdf = () => {
    cancelDocumentWork()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const togglePageSelection = (pageNumber) => {
    setSelectedPages((currentPages) => currentPages.includes(pageNumber)
      ? currentPages.filter((number) => number !== pageNumber)
      : [...currentPages, pageNumber].sort((first, second) => first - second))
    clearOutputImages()
    setStatus(null)
  }

  const convertPages = async () => {
    if (processingRef.current) return
    if (!pdfDocumentRef.current) {
      setStatus({ type: 'error', message: 'Choose a valid PDF before converting pages.' })
      return
    }

    const pagesToConvert = pageMode === 'all'
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : selectedPages

    if (pagesToConvert.length === 0) {
      setStatus({ type: 'error', message: 'Select at least one page to convert.' })
      return
    }

    processingRef.current = true
    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    setIsConverting(true)
    setIsZipping(false)
    setProgress(0)
    clearOutputImages()
    setStatus({ type: 'success', message: 'Rendering JPG images locally…' })
    const createdImages = []

    try {
      const pdf = pdfDocumentRef.current
      for (let index = 0; index < pagesToConvert.length; index += 1) {
        const pageNumber = pagesToConvert[index]
        const image = await renderPageToJpeg(pdf, pageNumber, scale, quality, renderTasksRef)
        if (operationIdRef.current !== operationId) return

        const url = URL.createObjectURL(image.blob)
        outputUrlsRef.current.add(url)
        createdImages.push({
          pageNumber,
          blob: image.blob,
          url,
          name: `page-${paddedPageNumber(pageNumber, pageCount)}.jpg`,
        })
        setProgress(Math.round(((index + 1) / pagesToConvert.length) * 95))
      }

      if (operationIdRef.current === operationId) {
        setOutputImages(createdImages)
        setProgress(100)
        setStatus({
          type: 'success',
          message: `Converted ${createdImages.length} page${createdImages.length === 1 ? '' : 's'} to JPG.`,
        })
      }
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      createdImages.forEach(({ url }) => {
        URL.revokeObjectURL(url)
        outputUrlsRef.current.delete(url)
      })
      setOutputImages([])
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not convert the PDF pages: ${error.message}`
          : 'Could not convert the PDF pages. Try again with a different scale.',
      })
      setProgress(0)
    } finally {
      if (operationIdRef.current === operationId) {
        processingRef.current = false
        setIsConverting(false)
      }
    }
  }

  const createZip = async () => {
    if (processingRef.current || outputImages.length === 0) return

    processingRef.current = true
    const operationId = operationIdRef.current + 1
    operationIdRef.current = operationId
    setIsZipping(true)
    setProgress(0)
    setZipBlob(null)
    setStatus({ type: 'success', message: 'Preparing JPG files for a ZIP download…' })

    try {
      const zip = new JSZip()
      outputImages.forEach(({ blob, name }) => zip.file(name, blob))
      const result = await zip.generateAsync(
        { type: 'blob' },
        (metadata) => {
          if (operationIdRef.current === operationId) {
            setProgress(Math.round(metadata.percent))
          }
        },
      )
      if (operationIdRef.current !== operationId) return

      setZipBlob(result)
      setProgress(100)
      setStatus({ type: 'success', message: 'ZIP archive created and ready to download.' })
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not create the ZIP archive: ${error.message}`
          : 'Could not create the ZIP archive. Try downloading the JPG files individually.',
      })
    } finally {
      if (operationIdRef.current === operationId) {
        processingRef.current = false
        setIsZipping(false)
      }
    }
  }

  const selectedPageSet = new Set(selectedPages)
  const isProcessing = isLoading || isConverting || isZipping
  const progressMessage = isLoading
    ? 'Rendering page previews…'
    : isConverting
      ? 'Converting selected pages…'
      : 'Creating ZIP archive…'

  return (
    <>
      <PageMetadata
        title="PDF to JPG Converter"
        description="Convert PDF pages to JPG images in your browser. Preview pages, select all or choose specific pages, set JPG quality and image scale, then download images or a ZIP."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <ShieldCheck aria-hidden="true" size={16} />
            Private, browser-based conversion
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            PDF to JPG Converter
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Preview a PDF, convert every page or choose specific pages, and download
            the JPG images individually or together as a ZIP. Processing stays in your browser.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-4xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>Your PDF is read and converted on this device. It is not uploaded to a server.</span>
          </p>
        </div>

        <section aria-label="PDF to JPG conversion" className="mx-auto mt-6 max-w-4xl space-y-5">
          <section aria-labelledby="pdf-upload-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
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
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  Remove PDF
                </button>
              )}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault()
                if (!isProcessing) setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`mt-5 rounded-xl border-2 border-dashed p-5 text-center transition sm:p-7 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 bg-slate-50 hover:border-indigo-300'
              } ${isProcessing ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileInput}
                disabled={isProcessing}
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
                disabled={isProcessing}
                className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileImage aria-hidden="true" size={17} />
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

          {isProcessing && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm text-indigo-900">
                <span className="inline-flex items-center gap-2 font-medium">
                  <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                  {progressMessage}
                </span>
                <span>{progress}%</span>
              </div>
              <progress
                aria-label="PDF conversion progress"
                value={progress}
                max="100"
                className="mt-2 h-2 w-full accent-indigo-600"
              />
            </div>
          )}

          {status && <StatusMessage status={status} />}

          {pdfFile && previewPages.length > 0 && (
            <>
              <section aria-labelledby="page-selection-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="page-selection-heading" className="font-semibold text-slate-950">
                      PDF pages
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Preview and choose pages to convert.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPages(Array.from({ length: pageCount }, (_, index) => index + 1))
                        clearOutputImages()
                        setStatus(null)
                      }}
                      disabled={isProcessing}
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPages([])
                        clearOutputImages()
                        setStatus(null)
                      }}
                      disabled={isProcessing}
                      className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>

                <fieldset className="mt-5">
                  <legend className="text-sm font-medium text-slate-800">Pages to convert</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="page-mode"
                        value="all"
                        checked={pageMode === 'all'}
                        onChange={() => {
                          setPageMode('all')
                          clearOutputImages()
                          setStatus(null)
                        }}
                        disabled={isProcessing}
                        className="size-4 accent-indigo-600"
                      />
                      All pages ({pageCount})
                    </label>
                    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="page-mode"
                        value="selected"
                        checked={pageMode === 'selected'}
                        onChange={() => {
                          setPageMode('selected')
                          clearOutputImages()
                          setStatus(null)
                        }}
                        disabled={isProcessing}
                        className="size-4 accent-indigo-600"
                      />
                      Selected pages ({selectedPages.length})
                    </label>
                  </div>
                </fieldset>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {previewPages.map(({ pageNumber, previewUrl }) => (
                    <label
                      key={pageNumber}
                      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-indigo-200"
                    >
                      <span className="flex h-64 items-center justify-center bg-white p-2">
                        <img
                          src={previewUrl}
                          alt={`Preview of PDF page ${pageNumber}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </span>
                      <span className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={selectedPageSet.has(pageNumber)}
                          onChange={() => togglePageSelection(pageNumber)}
                          disabled={isProcessing}
                          aria-label={`Select page ${pageNumber} for JPG conversion`}
                          className="size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        />
                        Page {pageNumber}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section aria-labelledby="jpg-settings-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <h2 id="jpg-settings-heading" className="font-semibold text-slate-950">
                  JPG image settings
                </h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="jpg-quality" className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
                      JPG quality
                      <output htmlFor="jpg-quality" className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                        {Math.round(quality * 100)}%
                      </output>
                    </label>
                    <input
                      id="jpg-quality"
                      type="range"
                      min="0.4"
                      max="1"
                      step="0.05"
                      value={quality}
                      onChange={(event) => {
                        setQuality(Number(event.target.value))
                        clearOutputImages()
                        setStatus(null)
                      }}
                      disabled={isProcessing}
                      className="mt-3 h-2 w-full cursor-pointer accent-indigo-600"
                    />
                    <p className="mt-1 text-xs text-slate-500">Higher quality usually creates larger JPG files.</p>
                  </div>
                  <div>
                    <label htmlFor="jpg-scale" className="text-sm font-medium text-slate-800">
                      Output scale
                    </label>
                    <select
                      id="jpg-scale"
                      value={scale}
                      onChange={(event) => {
                        setScale(Number(event.target.value))
                        clearOutputImages()
                        setStatus(null)
                      }}
                      disabled={isProcessing}
                      className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                    >
                      <option value="1">Standard (1×)</option>
                      <option value="1.5">High (1.5×)</option>
                      <option value="2">Very high (2×)</option>
                      <option value="3">Maximum (3×)</option>
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Higher scales increase image resolution and memory use.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={convertPages}
                  disabled={isProcessing}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-70"
                >
                  {isConverting
                    ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                    : <FileImage aria-hidden="true" size={17} />}
                  {isConverting ? 'Converting pages…' : `Convert ${pageMode === 'all' ? 'all pages' : 'selected pages'} to JPG`}
                </button>
              </section>
            </>
          )}

          {outputImages.length > 0 && (
            <section aria-labelledby="jpg-results-heading" className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="jpg-results-heading" className="font-semibold text-slate-950">
                    Converted JPG images
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Download an image or package all {outputImages.length} in a ZIP file.
                  </p>
                </div>
                {zipUrl ? (
                  <a
                    href={zipUrl}
                    download="pdf-pages.zip"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <Download aria-hidden="true" size={17} />
                    Download ZIP
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={createZip}
                    disabled={isProcessing}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isZipping
                      ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                      : <Download aria-hidden="true" size={17} />}
                    {isZipping ? 'Creating ZIP…' : 'Download all as ZIP'}
                  </button>
                )}
              </div>

              <ul className="mt-4 divide-y divide-slate-200">
                {outputImages.map(({ pageNumber, blob, url, name }) => (
                  <li key={pageNumber} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{formatFileSize(blob.size)}</span>
                    </span>
                    <a
                      href={url}
                      download={name}
                      aria-label={`Download ${name}`}
                      className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <Download aria-hidden="true" size={16} />
                      Download JPG
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="pdf-to-jpg-explanation">
            <h2 id="pdf-to-jpg-explanation" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert PDF pages to JPG images
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              A PDF to JPG converter renders each chosen PDF page as a separate JPEG image. Use the page previews to
              convert the entire document or select only the pages you need. Adjust JPG quality and output scale to
              balance image clarity, file size, and your device’s available memory. All processing happens locally in
              your browser.
            </p>
          </section>

          <section aria-labelledby="pdf-to-jpg-faq">
            <h2 id="pdf-to-jpg-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200">
              {[
                ['How do I convert PDF to JPG?', 'Choose or drop one PDF, wait for the page previews, select all pages or specific pages, set JPG quality and output scale, then convert and download the images.'],
                ['Can I convert only selected pages?', 'Yes. Choose Selected pages and check the page thumbnails you want to convert. The All pages option converts every page, regardless of the thumbnail selections.'],
                ['How does JPG quality affect the result?', 'The quality setting controls JPEG compression. Higher quality generally preserves more detail but creates larger files.'],
                ['What does output scale change?', 'Scale changes the rendered pixel dimensions. Higher scale can make more detail available but increases file size and browser memory use.'],
                ['Can I download all pages together?', 'Yes. Choose Download all as ZIP to package the converted JPG images into one archive, or use Download JPG beside any individual image.'],
                ['Are my PDF pages uploaded?', 'No. The PDF is rendered in your browser. The converter does not send the file or resulting images to a processing server.'],
                ['Which PDFs can I convert?', 'The tool accepts valid PDF files up to 25 MB. Password-protected PDFs cannot be opened here; remove the password before converting.'],
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
