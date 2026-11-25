import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument } from 'pdf-lib'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, validatePdfFile } from '../utils/pdfValidation.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const COMPRESSION_LEVELS = {
  low: { label: 'Low', scale: 1.5, quality: 0.9 },
  medium: { label: 'Medium', scale: 1.15, quality: 0.75 },
  high: { label: 'High', scale: 0.85, quality: 0.55 },
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const isWarning = status.type === 'warning'
  const Icon = isError || isWarning ? AlertCircle : CheckCircle2
  const colors = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : isWarning
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${colors}`}
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
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
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

export default function PdfCompressor() {
  const fileInputRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const outputLoadingTaskRef = useRef(null)
  const operationIdRef = useRef(0)
  const renderTasksRef = useRef(new Set())
  const previewUrlsRef = useRef(new Set())
  const resultUrlsRef = useRef(new Set())
  const compressionInProgressRef = useRef(false)

  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState('')
  const [compressionLevel, setCompressionLevel] = useState('medium')
  const [result, setResult] = useState(null)
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [progress, setProgress] = useState(0)

  const revokeUrls = (urls) => {
    urls.forEach((url) => URL.revokeObjectURL(url))
    urls.clear()
  }

  const makeObjectUrl = (blob, urls) => {
    const url = URL.createObjectURL(blob)
    urls.add(url)
    return url
  }

  const clearResult = () => {
    revokeUrls(resultUrlsRef.current)
    setResult(null)
  }

  const cancelDocumentWork = () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) {
      loadingTaskRef.current.destroy()
      loadingTaskRef.current = null
    }
    if (outputLoadingTaskRef.current) {
      outputLoadingTaskRef.current.destroy()
      outputLoadingTaskRef.current = null
    }
    pdfDocumentRef.current = null
    revokeUrls(previewUrlsRef.current)
    revokeUrls(resultUrlsRef.current)
    setSourcePreviewUrl('')
    setResult(null)
    setPdfFile(null)
    setPageCount(0)
    setProgress(0)
    setStatus(null)
    setIsLoading(false)
    setIsCompressing(false)
    compressionInProgressRef.current = false
    return operationIdRef.current
  }

  useEffect(() => () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) loadingTaskRef.current.destroy()
    if (outputLoadingTaskRef.current) outputLoadingTaskRef.current.destroy()
    revokeUrls(previewUrlsRef.current)
    revokeUrls(resultUrlsRef.current)
  }, [])

  const resetPdf = () => {
    cancelDocumentWork()
    setCompressionLevel('medium')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const loadPdf = async (file) => {
    const operationId = cancelDocumentWork()
    setIsLoading(true)
    setProgress(10)
    setStatus({ type: 'success', message: 'Validating and opening your PDF locally…' })

    try {
      const validationError = await validatePdfFile(file)
      if (operationIdRef.current !== operationId) return
      if (validationError) {
        setProgress(0)
        setStatus({ type: 'error', message: validationError })
        return
      }

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (operationIdRef.current !== operationId) return
      setProgress(30)

      const loadingTask = getDocument({ data: bytes, isEvalSupported: false })
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (operationIdRef.current !== operationId) return

      pdfDocumentRef.current = pdf
      setPdfFile(file)
      setPageCount(pdf.numPages)
      setProgress(65)
      const preview = await renderPageToJpeg(pdf, 1, 0.65, 0.8, renderTasksRef)
      if (operationIdRef.current !== operationId) return

      setSourcePreviewUrl(makeObjectUrl(preview.blob, previewUrlsRef.current))
      setProgress(100)
      setStatus(null)
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      pdfDocumentRef.current = null
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy()
        loadingTaskRef.current = null
      }
      setPdfFile(null)
      setPageCount(0)
      setSourcePreviewUrl('')
      setProgress(0)
      setStatus({ type: 'error', message: getPdfLoadError(error) })
    } finally {
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
    const file = event.dataTransfer.files?.[0]
    if (file) void loadPdf(file)
    else setStatus({ type: 'error', message: 'Drop one PDF file to continue.' })
  }

  const compressPdf = async () => {
    if (compressionInProgressRef.current || !pdfFile || !pdfDocumentRef.current) return

    compressionInProgressRef.current = true
    const operationId = operationIdRef.current
    const sourcePdf = pdfDocumentRef.current
    const settings = COMPRESSION_LEVELS[compressionLevel]
    clearResult()
    setIsCompressing(true)
    setProgress(5)
    setStatus({ type: 'success', message: 'Optimizing and comparing PDF output locally…' })

    let losslessBytes = null
    let losslessOptimizationFailed = false

    try {
      try {
        const sourceBytes = new Uint8Array(await pdfFile.arrayBuffer())
        const losslessDocument = await PDFDocument.load(sourceBytes)
        losslessBytes = await losslessDocument.save({ useObjectStreams: true })
      } catch {
        losslessOptimizationFailed = true
      }
      if (operationIdRef.current !== operationId) return
      setProgress(10)

      const losslessReducesSize = losslessBytes && losslessBytes.length < pdfFile.size
      let rasterBytes = null
      if (!losslessReducesSize) {
        const rasterDocument = await PDFDocument.create()
        for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
          const page = await sourcePdf.getPage(pageNumber)
          const pageViewport = page.getViewport({ scale: 1 })
          page.cleanup()
          const renderedPage = await renderPageToJpeg(
            sourcePdf,
            pageNumber,
            settings.scale,
            settings.quality,
            renderTasksRef,
          )
          if (operationIdRef.current !== operationId) return

          const image = await rasterDocument.embedJpg(
            new Uint8Array(await renderedPage.blob.arrayBuffer()),
          )
          const outputPage = rasterDocument.addPage([pageViewport.width, pageViewport.height])
          outputPage.drawImage(image, {
            x: 0,
            y: 0,
            width: pageViewport.width,
            height: pageViewport.height,
          })
          setProgress(10 + Math.round((pageNumber / sourcePdf.numPages) * 70))
        }

        rasterBytes = await rasterDocument.save({ useObjectStreams: true })
        if (operationIdRef.current !== operationId) return
      }

      const useLossless = losslessReducesSize
        || (losslessBytes && (!rasterBytes || losslessBytes.length <= rasterBytes.length))
      const outputBytes = useLossless ? losslessBytes : rasterBytes
      setProgress(90)

      const outputLoadingTask = getDocument({
        data: outputBytes.slice(),
        isEvalSupported: false,
      })
      outputLoadingTaskRef.current = outputLoadingTask
      let outputPdf
      let outputPreview
      try {
        outputPdf = await outputLoadingTask.promise
        if (operationIdRef.current !== operationId) return
        if (outputPdf.numPages !== sourcePdf.numPages) {
          throw new Error('The generated PDF did not preserve the original page count.')
        }
        outputPreview = await renderPageToJpeg(outputPdf, 1, 0.65, 0.8, renderTasksRef)
      } finally {
        if (outputLoadingTaskRef.current === outputLoadingTask) {
          outputLoadingTaskRef.current = null
        }
        await outputLoadingTask.destroy()
      }
      if (operationIdRef.current !== operationId) return

      const outputBlob = new Blob([outputBytes], { type: 'application/pdf' })
      const isSmaller = outputBlob.size < pdfFile.size
      const previewUrl = makeObjectUrl(outputPreview.blob, resultUrlsRef.current)
      const downloadUrl = isSmaller
        ? makeObjectUrl(outputBlob, resultUrlsRef.current)
        : ''
      setResult({
        size: outputBlob.size,
        pageCount: outputPdf.numPages,
        previewUrl,
        downloadUrl,
        method: useLossless ? 'Lossless PDF optimization' : 'Re-rendered page images',
        isRasterized: !useLossless,
        isSmaller,
      })
      setProgress(100)

      if (isSmaller) {
        const savedBytes = pdfFile.size - outputBlob.size
        const percentage = (savedBytes / pdfFile.size) * 100
        const rasterNote = useLossless
          ? ''
          : ' The pages were converted to images, so text and interactive elements may no longer be selectable.'
        const fallbackNote = losslessOptimizationFailed
          ? ' Lossless optimization was unavailable for this file.'
          : ''
        setStatus({
          type: 'success',
          message: `PDF size reduced by ${percentage.toFixed(1)}% (${formatFileSize(savedBytes)} saved).${rasterNote}${fallbackNote}`,
        })
      } else {
        const growth = outputBlob.size - pdfFile.size
        const growthMessage = growth > 0
          ? ` The best result was ${formatFileSize(growth)} larger than the original.`
          : ' The best result was the same size as the original.'
        setStatus({
          type: 'warning',
          message: `This PDF could not be made smaller, so no compressed download is offered.${growthMessage}`,
        })
      }
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not compress this PDF: ${error.message}`
          : 'Could not compress this PDF. Try another file or a lower compression level.',
      })
    } finally {
      if (operationIdRef.current === operationId) {
        setIsCompressing(false)
        compressionInProgressRef.current = false
      }
    }
  }

  const changeCompressionLevel = (event) => {
    clearResult()
    setStatus(null)
    setCompressionLevel(event.target.value)
  }

  const savedBytes = result && result.isSmaller ? pdfFile.size - result.size : 0
  const savedPercentage = result && result.isSmaller
    ? ((savedBytes / pdfFile.size) * 100).toFixed(1)
    : '0.0'
  const progressMessage = isLoading
    ? 'Opening PDF preview…'
    : 'Compressing and verifying PDF…'

  return (
    <>
      <PageMetadata
        title="PDF Compressor - Reduce PDF File Size"
        description="Compress a PDF online in your browser. Compare file sizes, preview the result, choose a compression level, and download only when the PDF is smaller."
      />
      <div className="mx-auto max-w-5xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            PDF Compressor
          </h1>
        </header>

        <section aria-label="PDF compression" className="mx-auto max-w-4xl space-y-5">
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
              {(pdfFile || isLoading || isCompressing) && (
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
                if (!isLoading && !isCompressing) setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`tool-dropzone mt-5 p-5 text-center sm:p-7 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : ''
              } ${(isLoading || isCompressing) ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleFileInput}
                disabled={isLoading || isCompressing}
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
                disabled={isLoading || isCompressing}
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

          {(isLoading || isCompressing) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm text-indigo-900">
                <span className="inline-flex items-center gap-2 font-medium">
                  <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                  {progressMessage}
                </span>
                <span>{progress}%</span>
              </div>
              <progress
                aria-label="PDF compression progress"
                value={progress}
                max="100"
                className="mt-2 h-2 w-full accent-indigo-600"
              />
            </div>
          )}

          {status && <StatusMessage status={status} />}

          {pdfFile && (
            <section aria-labelledby="compression-settings-heading" className="tool-surface-raised p-4 sm:p-6">
              <div>
                <h2 id="compression-settings-heading" className="font-semibold text-slate-950">
                  Compression level
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  The tool first tries a lossless optimization. If it reduces the size, it keeps the original PDF content; otherwise the selected level controls a page-image version.
                </p>
              </div>
              <label htmlFor="compression-level" className="mt-4 block text-sm font-medium text-slate-800">
                Choose a level
              </label>
              <select
                id="compression-level"
                value={compressionLevel}
                onChange={changeCompressionLevel}
                disabled={isLoading || isCompressing}
                className="tool-field mt-2 sm:max-w-xs"
              >
                {Object.entries(COMPRESSION_LEVELS).map(([value, level]) => (
                  <option key={value} value={value}>{level.label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Low preserves more detail; High prioritizes a smaller file and may reduce clarity. These levels apply when page images are needed.
              </p>
              <button
                type="button"
                onClick={compressPdf}
                disabled={isLoading || isCompressing || !sourcePreviewUrl}
                className="tool-primary-button mt-5 w-full sm:w-auto"
              >
                {isCompressing
                  ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                  : <FileImage aria-hidden="true" size={17} />}
                {result ? 'Compress again' : 'Compress PDF'}
              </button>
            </section>
          )}

          {pdfFile && sourcePreviewUrl && (
            <section aria-labelledby="preview-heading" className="tool-surface p-4 sm:p-6">
              <h2 id="preview-heading" className="font-semibold text-slate-950">
                {result ? 'Compression preview' : 'PDF preview'}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Original</h3>
                    <span className="text-xs text-slate-500">{formatFileSize(pdfFile.size)}</span>
                  </div>
                  <img
                    src={sourcePreviewUrl}
                    alt={`Preview of the first page of ${pdfFile.name}`}
                    className="mx-auto mt-3 max-h-80 max-w-full rounded-md border border-slate-200 bg-white object-contain"
                  />
                </div>
                {result ? (
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/60 p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">Result preview</h3>
                      <span className="text-xs text-slate-500">{formatFileSize(result.size)}</span>
                    </div>
                    <img
                      src={result.previewUrl}
                      alt="Preview of the first page of the compressed PDF"
                      className="mx-auto mt-3 max-h-80 max-w-full rounded-md border border-slate-200 bg-white object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-gradient-to-br from-white to-indigo-50/60 p-4 text-center text-sm text-slate-500">
                    The result preview will appear here after compression.
                  </div>
                )}
              </div>
            </section>
          )}

          {result && (
            <section aria-labelledby="compression-results-heading" className="tool-surface-raised p-4 sm:p-6">
              <h2 id="compression-results-heading" className="font-semibold text-slate-950">
                Compression results
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="tool-stat-tile">
                  <dt className="text-sm text-slate-500">Original size</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatFileSize(pdfFile.size)}</dd>
                </div>
                <div className="tool-stat-tile">
                  <dt className="text-sm text-slate-500">Result size</dt>
                  <dd className="mt-1 font-semibold text-slate-950">{formatFileSize(result.size)}</dd>
                </div>
                <div className="tool-stat-tile">
                  <dt className="text-sm text-slate-500">{result.isSmaller ? 'Size reduction' : 'Space saved'}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {result.isSmaller
                      ? `${savedPercentage}% · ${formatFileSize(savedBytes)}`
                      : '0% · 0 B'}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Method: {result.method}. {result.pageCount} {result.pageCount === 1 ? 'page' : 'pages'} verified.
              </p>
              {result.isRasterized && (
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  This result uses page images. Text, links, forms, and other interactive PDF content may no longer be selectable or interactive.
                </p>
              )}
              {result.downloadUrl ? (
                <a
                  href={result.downloadUrl}
                  download={`${pdfFile.name.replace(/\.pdf$/i, '')}-compressed.pdf`}
                  className="tool-primary-button mt-5 w-full sm:w-auto"
                >
                  <Download aria-hidden="true" size={17} />
                  Download compressed PDF
                </a>
              ) : (
                <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No download is available because the output was not smaller than the original.
                </p>
              )}
            </section>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-pdf-compression">
            <h2 id="about-pdf-compression" className="text-2xl font-bold tracking-tight text-slate-950">
              How PDF compression works
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This PDF compressor first tries a lossless PDF optimization that keeps the document content intact. If that reduces the file size, it uses the lossless result. Otherwise, it creates a page-image version using your selected compression level and compares the actual output sizes. If neither candidate is smaller, the tool reports the result without offering a misleading compressed download.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              A page-image result can reduce file size, especially for image-heavy documents, but it may flatten text and remove selectable or interactive content. Low, Medium, and High settings balance image detail against file size. All processing happens locally in your browser.
            </p>
          </section>

          <section aria-labelledby="pdf-compressor-faq">
            <h2 id="pdf-compressor-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I compress a PDF?', 'Choose or drop one PDF, select Low, Medium, or High, and choose Compress PDF. Review the original and result previews and size comparison before downloading.'],
                ['What do the compression levels mean?', 'Low prioritizes image detail, Medium balances detail and size, and High prioritizes a smaller rasterized output. The levels apply when lossless optimization does not already reduce the file size.'],
                ['Will compression always make my PDF smaller?', 'No. The tool compares the actual output size with the original. If the best result is the same size or larger, it explains that no reduction was achieved and does not offer a compressed download.'],
                ['Will text remain selectable?', 'It remains intact when the lossless optimized PDF is selected. If a smaller page-image version is selected, text and interactive elements may be flattened and no longer selectable. The result method is shown before download.'],
                ['Are my files uploaded?', 'No. Your PDF is processed locally in your browser and is not sent to a processing server.'],
                ['Which PDFs can I use?', 'The tool accepts valid PDFs up to 25 MB. Password-protected PDFs cannot be opened; remove the password before using the compressor.'],
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
