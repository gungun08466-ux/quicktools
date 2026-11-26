import { PDFDocument, degrees } from 'pdf-lib'
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
  RotateCw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, MAX_PDF_SIZE_BYTES, validatePdfFile } from '../utils/pdfValidation.js'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const THUMBNAIL_MAX_WIDTH = 240
const THUMBNAIL_MAX_HEIGHT = 300

function normalizeRotation(angle) {
  return ((angle % 360) + 360) % 360
}

function renderPageThumbnail(pdf, pageNumber, rotationDelta, renderTasksRef) {
  return pdf.getPage(pageNumber).then(async (page) => {
    const rotation = normalizeRotation(page.rotate + rotationDelta)
    const baseViewport = page.getViewport({ scale: 1, rotation })
    const scale = Math.min(
      1,
      THUMBNAIL_MAX_WIDTH / baseViewport.width,
      THUMBNAIL_MAX_HEIGHT / baseViewport.height,
    )
    const viewport = page.getViewport({ scale, rotation })
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
      }, 'image/jpeg', 0.7)
    })
  })
}

function getPdfLoadError(error) {
  const reason = error instanceof Error ? error.message : ''
  if (error?.name === 'PasswordException' || /password|encrypt/i.test(reason)) {
    return 'This PDF is password-protected. Remove its password and try again.'
  }
  if (error?.name === 'InvalidPDFException' || /invalid pdf|malformed|file is corrupted/i.test(reason)) {
    return 'This file could not be opened as a valid PDF. Check that it is not corrupted and try again.'
  }
  return reason
    ? `Could not open this PDF: ${reason}`
    : 'Could not open this PDF. Check the file and try again.'
}

function getExportError(error) {
  const reason = error instanceof Error ? error.message : ''
  if (/encrypt|password/i.test(reason)) {
    return 'This PDF is password-protected and cannot be rotated. Remove its password and try again.'
  }
  if (/memory|allocation|array buffer/i.test(reason)) {
    return 'The browser ran out of memory while saving this PDF. Try a smaller document.'
  }
  return reason ? `Could not save this PDF: ${reason}` : 'Could not save this PDF. Check the file and try again.'
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

function getRotatedFilename(filename) {
  const baseName = filename.replace(/\.pdf$/iu, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').trim()
  return `${baseName || 'document'}-rotated.pdf`
}

export default function PdfRotator() {
  const fileInputRef = useRef(null)
  const pdfDocumentRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const operationIdRef = useRef(0)
  const renderTasksRef = useRef(new Set())
  const previewUrlsRef = useRef(new Set())
  const rotatingRef = useRef(false)
  const exportingRef = useRef(false)

  const [pdfFile, setPdfFile] = useState(null)
  const [pageCount, setPageCount] = useState(0)
  const [previewPages, setPreviewPages] = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [rotationByPage, setRotationByPage] = useState({})
  const [outputPdf, setOutputPdf] = useState(null)
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdatingPreviews, setIsUpdatingPreviews] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const rotatedPageCount = Object.values(rotationByPage).filter((angle) => angle !== 0).length
  const allPagesSelected = pageCount > 0 && selectedPages.length === pageCount

  useEffect(() => () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) {
      void loadingTaskRef.current.destroy().catch(() => {})
    }
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }, [])

  const revokePreviewUrls = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }

  const cancelDocumentWork = () => {
    operationIdRef.current += 1
    renderTasksRef.current.forEach((task) => task.cancel())
    renderTasksRef.current.clear()
    if (loadingTaskRef.current) {
      void loadingTaskRef.current.destroy().catch(() => {})
      loadingTaskRef.current = null
    }
    pdfDocumentRef.current = null
    revokePreviewUrls()
    setPdfFile(null)
    setPageCount(0)
    setPreviewPages([])
    setSelectedPages([])
    setRotationByPage({})
    setOutputPdf(null)
    setProgress(0)
    setStatus(null)
    setIsLoading(false)
    setIsUpdatingPreviews(false)
    setIsExporting(false)
    rotatingRef.current = false
    exportingRef.current = false
    return operationIdRef.current
  }

  const loadPdf = async (file) => {
    if (rotatingRef.current || exportingRef.current) return
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

      const sourceBytes = await file.arrayBuffer()
      if (operationIdRef.current !== operationId) return

      const editablePdf = await PDFDocument.load(sourceBytes.slice(0))
      if (operationIdRef.current !== operationId) return
      const editablePages = editablePdf.getPages()

      const loadingTask = getDocument({
        data: new Uint8Array(sourceBytes.slice(0)),
        isEvalSupported: false,
      })
      loadingTaskRef.current = loadingTask
      const pdf = await loadingTask.promise
      if (operationIdRef.current !== operationId) return
      if (pdf.numPages !== editablePages.length) {
        throw new Error('The PDF preview and editor found different page counts.')
      }

      pdfDocumentRef.current = pdf
      setPdfFile(file)
      setPageCount(pdf.numPages)
      setSelectedPages([])
      setRotationByPage(Object.fromEntries(
        Array.from({ length: pdf.numPages }, (_, index) => [index + 1, 0]),
      ))
      setStatus({ type: 'info', message: 'Creating page previews…' })

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const thumbnail = await renderPageThumbnail(pdf, pageNumber, 0, renderTasksRef)
        if (operationIdRef.current !== operationId) return

        const previewUrl = URL.createObjectURL(thumbnail)
        previewUrlsRef.current.add(previewUrl)
        setPreviewPages((currentPages) => [...currentPages, { pageNumber, previewUrl }])
        setProgress(Math.round((pageNumber / pdf.numPages) * 100))
      }

      if (operationIdRef.current === operationId) {
        setStatus({
          type: 'success',
          message: `Loaded ${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'}. Select pages to rotate, or use the controls on each thumbnail.`,
        })
      }
    } catch (error) {
      if (operationIdRef.current !== operationId) return
      if (loadingTaskRef.current) {
        void loadingTaskRef.current.destroy().catch(() => {})
        loadingTaskRef.current = null
      }
      pdfDocumentRef.current = null
      revokePreviewUrls()
      setPdfFile(null)
      setPageCount(0)
      setPreviewPages([])
      setSelectedPages([])
      setRotationByPage({})
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
    if (!isLoading && !isUpdatingPreviews && !isExporting) {
      handleFileSelection(event.dataTransfer.files)
    }
  }

  const resetPdf = () => {
    if (isUpdatingPreviews || isExporting) return
    cancelDocumentWork()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const rotatePages = async (pageNumbers, direction) => {
    if (!pdfDocumentRef.current || !pageNumbers.length || rotatingRef.current || exportingRef.current) return
    rotatingRef.current = true
    setIsUpdatingPreviews(true)
    setOutputPdf(null)
    setProgress(0)
    setStatus({
      type: 'info',
      message: `Updating preview for ${pageNumbers.length} page${pageNumbers.length === 1 ? '' : 's'}…`,
    })

    const operationId = operationIdRef.current
    const pdf = pdfDocumentRef.current
    const nextRotations = { ...rotationByPage }
    pageNumbers.forEach((pageNumber) => {
      nextRotations[pageNumber] = normalizeRotation((nextRotations[pageNumber] || 0) + direction)
    })
    setRotationByPage(nextRotations)

    try {
      for (let index = 0; index < pageNumbers.length; index += 1) {
        const pageNumber = pageNumbers[index]
        const delta = nextRotations[pageNumber]
        const thumbnail = await renderPageThumbnail(pdf, pageNumber, delta, renderTasksRef)
        if (operationIdRef.current !== operationId || pdfDocumentRef.current !== pdf) return

        const previewUrl = URL.createObjectURL(thumbnail)
        previewUrlsRef.current.add(previewUrl)
        let previousUrl = ''
        setPreviewPages((currentPages) => currentPages.map((page) => {
          if (page.pageNumber !== pageNumber) return page
          previousUrl = page.previewUrl
          return { ...page, previewUrl }
        }))
        if (previousUrl) {
          window.setTimeout(() => {
            URL.revokeObjectURL(previousUrl)
            previewUrlsRef.current.delete(previousUrl)
          }, 1000)
        }
        setProgress(Math.round(((index + 1) / pageNumbers.length) * 100))
      }

      if (operationIdRef.current === operationId) {
        const count = Object.values(nextRotations).filter((angle) => angle !== 0).length
        setStatus({
          type: 'success',
          message: count
            ? `Preview updated. ${count} page${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} a changed rotation.`
            : 'All pages are back to their original rotation.',
        })
      }
    } catch (error) {
      if (operationIdRef.current === operationId) {
        setStatus({
          type: 'error',
          message: error instanceof Error
            ? `Could not update the page preview: ${error.message}`
            : 'Could not update the page preview. Try loading the PDF again.',
        })
      }
    } finally {
      if (operationIdRef.current === operationId) {
        rotatingRef.current = false
        setIsUpdatingPreviews(false)
      }
    }
  }

  const rotateOnePage = (pageNumber, direction) => {
    void rotatePages([pageNumber], direction)
  }

  const rotateSelectedPages = (direction) => {
    if (!selectedPages.length) {
      setStatus({ type: 'error', message: 'Select at least one page to rotate.' })
      return
    }
    void rotatePages(selectedPages, direction)
  }

  const rotateAllPages = (direction) => {
    void rotatePages(Array.from({ length: pageCount }, (_, index) => index + 1), direction)
  }

  const resetOnePage = (pageNumber) => {
    if (rotationByPage[pageNumber] === 0) return
    void rotatePages([pageNumber], -rotationByPage[pageNumber])
  }

  const resetAllPages = () => {
    const changedPages = Object.entries(rotationByPage)
      .filter(([, angle]) => angle !== 0)
      .map(([pageNumber]) => Number(pageNumber))
    if (!changedPages.length) {
      setStatus({ type: 'info', message: 'All pages are already at their original rotation.' })
      return
    }
    const resetAngles = { ...rotationByPage }
    changedPages.forEach((pageNumber) => { resetAngles[pageNumber] = 0 })
    setRotationByPage(resetAngles)
    void rotatePagesToAngles(changedPages, resetAngles)
  }

  const rotatePagesToAngles = async (pageNumbers, targetRotations) => {
    if (!pdfDocumentRef.current || rotatingRef.current || exportingRef.current) return
    rotatingRef.current = true
    setIsUpdatingPreviews(true)
    setOutputPdf(null)
    setProgress(0)
    setStatus({ type: 'info', message: 'Restoring the original page previews…' })
    const operationId = operationIdRef.current
    const pdf = pdfDocumentRef.current

    try {
      for (let index = 0; index < pageNumbers.length; index += 1) {
        const pageNumber = pageNumbers[index]
        const thumbnail = await renderPageThumbnail(pdf, pageNumber, targetRotations[pageNumber], renderTasksRef)
        if (operationIdRef.current !== operationId || pdfDocumentRef.current !== pdf) return
        const previewUrl = URL.createObjectURL(thumbnail)
        previewUrlsRef.current.add(previewUrl)
        let previousUrl = ''
        setPreviewPages((currentPages) => currentPages.map((page) => {
          if (page.pageNumber !== pageNumber) return page
          previousUrl = page.previewUrl
          return { ...page, previewUrl }
        }))
        if (previousUrl) {
          window.setTimeout(() => {
            URL.revokeObjectURL(previousUrl)
            previewUrlsRef.current.delete(previousUrl)
          }, 1000)
        }
        setProgress(Math.round(((index + 1) / pageNumbers.length) * 100))
      }
      if (operationIdRef.current === operationId) {
        setStatus({ type: 'success', message: 'Selected page rotation has been reset.' })
      }
    } catch (error) {
      if (operationIdRef.current === operationId) {
        setStatus({
          type: 'error',
          message: error instanceof Error ? `Could not reset the page preview: ${error.message}` : 'Could not reset the page preview.',
        })
      }
    } finally {
      if (operationIdRef.current === operationId) {
        rotatingRef.current = false
        setIsUpdatingPreviews(false)
      }
    }
  }

  const togglePageSelection = (pageNumber) => {
    setSelectedPages((currentPages) => currentPages.includes(pageNumber)
      ? currentPages.filter((number) => number !== pageNumber)
      : [...currentPages, pageNumber].sort((first, second) => first - second))
    setStatus(null)
  }

  const selectAllPages = () => {
    setSelectedPages(Array.from({ length: pageCount }, (_, index) => index + 1))
    setStatus(null)
  }

  const deselectAllPages = () => {
    setSelectedPages([])
    setStatus(null)
  }

  const downloadRotatedPdf = async () => {
    if (!pdfFile || !rotatedPageCount || exportingRef.current || rotatingRef.current) return
    exportingRef.current = true
    setIsExporting(true)
    setProgress(0)
    setOutputPdf(null)
    setStatus({ type: 'info', message: 'Applying page rotations and preparing your PDF…' })

    const operationId = operationIdRef.current
    try {
      const bytes = await pdfFile.arrayBuffer()
      if (operationIdRef.current !== operationId) return
      const outputDocument = await PDFDocument.load(bytes)
      if (operationIdRef.current !== operationId) return
      const pages = outputDocument.getPages()

      pages.forEach((page, index) => {
        const delta = rotationByPage[index + 1] || 0
        if (delta !== 0) {
          const currentAngle = normalizeRotation(page.getRotation().angle)
          page.setRotation(degrees(normalizeRotation(currentAngle + delta)))
        }
      })
      setProgress(45)

      const outputBytes = await outputDocument.save()
      if (operationIdRef.current !== operationId) return
      const result = new Blob([outputBytes], { type: 'application/pdf' })
      if (!result.size) throw new Error('The rotated PDF is empty.')
      setOutputPdf(result)
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Rotated ${rotatedPageCount} page${rotatedPageCount === 1 ? '' : 's'}. The original page order and page content are preserved.`,
      })
    } catch (error) {
      if (operationIdRef.current === operationId) {
        setStatus({ type: 'error', message: getExportError(error) })
        setProgress(0)
      }
    } finally {
      if (operationIdRef.current === operationId) {
        exportingRef.current = false
        setIsExporting(false)
      }
    }
  }

  const downloadOutput = () => {
    if (!outputPdf || isExporting) return
    const url = URL.createObjectURL(outputPdf)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = getRotatedFilename(pdfFile?.name || 'document.pdf')
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const canEdit = Boolean(pdfFile && pageCount && previewPages.length === pageCount && !isLoading)
  const controlsDisabled = isLoading || isUpdatingPreviews || isExporting

  return (
    <>
      <PageMetadata
        title="PDF Rotator - Rotate PDF Pages Online"
        description="Rotate individual or selected PDF pages clockwise or counterclockwise, preview changes, and download your PDF. Files are processed locally in your browser."
      />
      <div className="mx-auto max-w-7xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">PDF Rotator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Rotate PDF pages clockwise or counterclockwise, preview every change,
            and download the updated document. Your PDF stays on your device.
          </p>
        </header>

        <section
          aria-label="PDF rotator"
          onDragEnter={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
          }}
          onDrop={handleDrop}
          className={`tool-surface-raised p-4 transition sm:p-6 ${isDragging ? 'ring-4 ring-indigo-200' : ''}`}
        >
          <input
            ref={fileInputRef}
            id="pdf-rotator-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInput}
            disabled={controlsDisabled}
            className="sr-only"
            aria-label="Choose a PDF to rotate"
          />

          {!pdfFile && !isLoading && (
            <label
              htmlFor="pdf-rotator-file"
              className="tool-dropzone flex min-h-72 cursor-pointer flex-col items-center justify-center p-6 text-center transition focus-within:ring-4 focus-within:ring-indigo-100 sm:min-h-80 sm:p-9"
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">Drop a PDF here to rotate its pages</span>
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
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-800" role="status">
              <LoaderCircle aria-hidden="true" size={25} className="animate-spin" />
              <p className="mt-3 text-sm font-medium">Opening PDF and creating previews…</p>
              {progress > 0 && (
                <div className="mt-4 h-2 w-56 overflow-hidden rounded-full bg-indigo-100">
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          {pdfFile && !isLoading && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <FileText aria-hidden="true" size={21} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-slate-950">{pdfFile.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatFileSize(pdfFile.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={controlsDisabled}
                  className="tool-secondary-button"
                >
                  <FilePlus2 aria-hidden="true" size={16} />
                  Choose another PDF
                </button>
              </div>

              <div className="tool-surface flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Rotate pages</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPages.length
                        ? `${selectedPages.length} page${selectedPages.length === 1 ? '' : 's'} selected`
                        : 'Select pages to rotate them together, or use individual page controls.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={allPagesSelected ? deselectAllPages : selectAllPages}
                      disabled={controlsDisabled}
                      className="tool-secondary-button"
                    >
                      {allPagesSelected ? <Check aria-hidden="true" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
                      {allPagesSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      onClick={resetAllPages}
                      disabled={controlsDisabled || !rotatedPageCount}
                      className="tool-secondary-button"
                    >
                      <RotateCcw aria-hidden="true" size={16} />
                      Reset all
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => rotateSelectedPages(-90)}
                    disabled={controlsDisabled || !selectedPages.length}
                    className="tool-secondary-button"
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    Rotate selected left
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateSelectedPages(90)}
                    disabled={controlsDisabled || !selectedPages.length}
                    className="tool-secondary-button"
                  >
                    <RotateCw aria-hidden="true" size={16} />
                    Rotate selected right
                  </button>
                  <span className="hidden self-center text-sm text-slate-400 sm:inline" aria-hidden="true">|</span>
                  <button
                    type="button"
                    onClick={() => rotateAllPages(-90)}
                    disabled={controlsDisabled}
                    className="tool-secondary-button"
                  >
                    <RotateCcw aria-hidden="true" size={16} />
                    Rotate all left
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateAllPages(90)}
                    disabled={controlsDisabled}
                    className="tool-secondary-button"
                  >
                    <RotateCw aria-hidden="true" size={16} />
                    Rotate all right
                  </button>
                </div>
              </div>

              {isUpdatingPreviews && (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900" role="status">
                  <LoaderCircle aria-hidden="true" size={18} className="animate-spin" />
                  <span>Updating preview… {progress}%</span>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {previewPages.map(({ pageNumber, previewUrl }) => {
                  const selected = selectedPages.includes(pageNumber)
                  const rotation = rotationByPage[pageNumber] || 0
                  return (
                    <article
                      key={pageNumber}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                        selected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Select page ${pageNumber}`}
                        onClick={() => togglePageSelection(pageNumber)}
                        disabled={controlsDisabled}
                        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-indigo-50/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600 disabled:cursor-not-allowed"
                      >
                        <span className="text-sm font-semibold text-slate-900">Page {pageNumber}</span>
                        <span className={`flex size-5 items-center justify-center rounded-md border ${
                          selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}>
                          <Check aria-hidden="true" size={14} />
                        </span>
                      </button>
                      <div className="flex min-h-64 items-center justify-center bg-slate-100 p-4">
                        <img
                          src={previewUrl}
                          alt={`Preview of page ${pageNumber}${rotation ? ` rotated ${rotation} degrees clockwise` : ''}`}
                          className="max-h-64 max-w-full rounded-sm bg-white object-contain shadow-md"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 py-3">
                        <div className="min-w-0 text-xs text-slate-500">
                          {rotation ? <span className="font-semibold text-indigo-700">{rotation}° clockwise</span> : 'Original rotation'}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            aria-label={`Rotate page ${pageNumber} counterclockwise`}
                            title="Rotate counterclockwise"
                            onClick={() => rotateOnePage(pageNumber, -90)}
                            disabled={controlsDisabled}
                            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RotateCcw aria-hidden="true" size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Rotate page ${pageNumber} clockwise`}
                            title="Rotate clockwise"
                            onClick={() => rotateOnePage(pageNumber, 90)}
                            disabled={controlsDisabled}
                            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RotateCw aria-hidden="true" size={16} />
                          </button>
                          {rotation !== 0 && (
                            <button
                              type="button"
                              aria-label={`Reset rotation for page ${pageNumber}`}
                              title="Reset page rotation"
                              onClick={() => resetOnePage(pageNumber)}
                              disabled={controlsDisabled}
                              className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <RotateCcw aria-hidden="true" size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="tool-surface-raised flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <p className="font-semibold text-slate-950">
                    {rotatedPageCount
                      ? `${rotatedPageCount} page${rotatedPageCount === 1 ? '' : 's'} rotated`
                      : 'No page rotations yet'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Original page order and content remain unchanged.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadRotatedPdf}
                    disabled={!canEdit || !rotatedPageCount || controlsDisabled}
                    className="tool-primary-button"
                  >
                    {isExporting
                      ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                      : <FileText aria-hidden="true" size={17} />}
                    {isExporting ? 'Preparing PDF…' : 'Prepare rotated PDF'}
                  </button>
                  {outputPdf && (
                    <button type="button" onClick={downloadOutput} className="tool-primary-button">
                      <Download aria-hidden="true" size={17} />
                      Download PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={resetPdf}
                    disabled={controlsDisabled}
                    className="tool-secondary-button"
                  >
                    Clear PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {isExporting && (
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-indigo-100" role="progressbar" aria-label="Preparing rotated PDF" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {status && <div className="mt-5"><StatusMessage status={status} /></div>}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-pdf-rotator">
            <h2 id="about-pdf-rotator" className="text-2xl font-bold tracking-tight text-slate-950">
              Rotate PDF pages online
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Select one or more page thumbnails and rotate them clockwise or
              counterclockwise, or use the controls on an individual page. Page
              previews update before you export. The PDF Rotator changes page
              rotation metadata in a local copy, keeping the original document
              untouched and retaining the page content and order.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              PDF pages are processed in your browser. Valid PDFs up to
              {' '}{formatFileSize(MAX_PDF_SIZE_BYTES)} are supported. Password-protected or corrupted
              files cannot be processed; remove the password or choose a valid
              copy to continue.
            </p>
          </section>

          <section aria-labelledby="pdf-rotator-faq">
            <h2 id="pdf-rotator-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I rotate a PDF page?', 'Upload a PDF and use the clockwise or counterclockwise button on a page thumbnail. The preview updates to show the rotation before you prepare the output PDF.'],
                ['Can I rotate multiple pages at once?', 'Yes. Select the page thumbnails you want, then choose Rotate selected left or Rotate selected right. Select all to rotate every page together.'],
                ['Can I reset a page rotation?', 'Use the reset button on an individual rotated page, or choose Reset all to restore every page to the original orientation.'],
                ['Will rotating pages change their order or content?', 'No. The output keeps the source page order and contents. Only the page rotation metadata is changed; the original uploaded file remains untouched.'],
                ['Are my PDF files uploaded?', 'No. PDF previews and rotation run locally in your browser. QuickTools does not send your PDF to a processing server.'],
                ['Can I rotate password-protected PDFs?', 'No. Remove the password first and upload an unlocked copy. Corrupted or invalid PDFs also cannot be processed.'],
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
