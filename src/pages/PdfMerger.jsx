import { PDFDocument } from 'pdf-lib'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FilePlus2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, MAX_PDF_SIZE_BYTES, validatePdfFile } from '../utils/pdfValidation.js'

let nextFileId = 0

function createFileEntry(file) {
  nextFileId += 1
  return { id: nextFileId, file }
}

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

export default function PdfMerger() {
  const fileInputRef = useRef(null)
  const mergeInProgressRef = useRef(false)
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mergedPdf, setMergedPdf] = useState(null)
  const [mergedPdfUrl, setMergedPdfUrl] = useState('')
  const [downloadMessage, setDownloadMessage] = useState('')

  useEffect(() => {
    if (!mergedPdf) {
      setMergedPdfUrl('')
      return undefined
    }

    const url = URL.createObjectURL(mergedPdf)
    setMergedPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [mergedPdf])

  const addFiles = async (fileList) => {
    if (isMerging) return

    const selectedFiles = Array.from(fileList || [])
    if (!selectedFiles.length) {
      setStatus({ type: 'error', message: 'Choose one or more PDF files.' })
      return
    }

    const accepted = []
    const errors = []

    for (const file of selectedFiles) {
      const validationError = await validatePdfFile(file)
      if (validationError) errors.push(validationError)
      else accepted.push(createFileEntry(file))
    }

    if (accepted.length) {
      setFiles((currentFiles) => [...currentFiles, ...accepted])
      setMergedPdf(null)
      setDownloadMessage('')
    }

    if (errors.length) {
      setStatus({
        type: 'error',
        message: [...errors, ...(accepted.length ? [`${accepted.length} valid PDF${accepted.length === 1 ? '' : 's'} added.`] : [])].join(' '),
      })
    } else {
      setStatus({
        type: 'success',
        message: `${accepted.length} PDF${accepted.length === 1 ? '' : 's'} added. Add at least two PDFs to merge.`,
      })
    }
  }

  const handleFileInput = (event) => {
    const selection = Array.from(event.target.files || [])
    event.target.value = ''
    void addFiles(selection)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  const removeFile = (fileId) => {
    if (isMerging) return
    setFiles((currentFiles) => currentFiles.filter(({ id }) => id !== fileId))
    setMergedPdf(null)
    setStatus(null)
    setDownloadMessage('')
  }

  const moveFile = (index, direction) => {
    if (isMerging) return

    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= files.length) return

    setFiles((currentFiles) => {
      const reordered = [...currentFiles]
      ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
      return reordered
    })
    setMergedPdf(null)
    setStatus(null)
    setDownloadMessage('')
  }

  const mergePdfs = async () => {
    if (mergeInProgressRef.current) return
    if (files.length < 2) {
      setStatus({
        type: 'error',
        message: 'Add at least two valid PDF files before merging.',
      })
      return
    }

    mergeInProgressRef.current = true
    setIsMerging(true)
    setProgress(0)
    setMergedPdf(null)
    setDownloadMessage('')
    setStatus({ type: 'success', message: 'Preparing PDFs for merging locally…' })

    try {
      const outputPdf = await PDFDocument.create()
      let totalPages = 0

      for (let index = 0; index < files.length; index += 1) {
        const { file } = files[index]
        const bytes = await file.arrayBuffer()
        let sourcePdf
        let pages

        try {
          sourcePdf = await PDFDocument.load(bytes)
          pages = await outputPdf.copyPages(sourcePdf, sourcePdf.getPageIndices())
        } catch (loadError) {
          const reason = loadError instanceof Error ? loadError.message : ''
          if (/memory|allocation|array buffer/i.test(reason)) {
            throw loadError
          }
          if (/encrypt|password/i.test(reason)) {
            throw new Error(`${file.name} is password-protected and cannot be merged.`)
          }
          throw new Error(`${file.name} is damaged or could not be opened as a PDF.`)
        }

        pages.forEach((page) => outputPdf.addPage(page))
        totalPages += pages.length
        setProgress(Math.round(((index + 1) / files.length) * 90))
      }

      const mergedBytes = await outputPdf.save()
      setMergedPdf(new Blob([mergedBytes], { type: 'application/pdf' }))
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Successfully merged ${files.length} PDFs into one document.`,
        fileCount: files.length,
        pageCount: totalPages,
        size: mergedBytes.byteLength,
      })
    } catch (mergeError) {
      const message = mergeError instanceof Error ? mergeError.message : ''
      setStatus({
        type: 'error',
        message: /memory|allocation|array buffer/i.test(message)
          ? 'The browser ran out of memory while merging these files. Try fewer or smaller PDFs.'
          : message || 'The PDFs could not be merged. Check the files and try again.',
      })
    } finally {
      mergeInProgressRef.current = false
      setIsMerging(false)
    }
  }

  const reset = () => {
    if (isMerging) return
    setFiles([])
    setMergedPdf(null)
    setStatus(null)
    setProgress(0)
    setDownloadMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadMergedPdf = () => {
    if (!mergedPdf) return

    let downloadUrl
    try {
      downloadUrl = URL.createObjectURL(mergedPdf)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = 'merged-document.pdf'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setDownloadMessage('Download started.')
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch (downloadError) {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
      setDownloadMessage(
        downloadError instanceof Error
          ? `Download failed: ${downloadError.message}`
          : 'Download failed. Please try again.',
      )
    }
  }

  return (
    <>
      <PageMetadata
        title="PDF Merger"
        description="Merge multiple PDF files locally in your browser. Reorder pages, combine documents, and download one PDF without uploading your files."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <ShieldCheck aria-hidden="true" size={16} />
            Private, browser-based processing
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            PDF Merger
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Combine multiple PDF files into one document. Your files are processed
            locally in your browser and are never uploaded.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-4xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-start gap-2">
            <LockKeyhole aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>Files stay on your device. At least two PDFs are required; each file can be up to 25 MB.</span>
          </p>
        </div>

        <section aria-labelledby="pdf-upload-heading" className="mx-auto mt-6 max-w-4xl">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              if (!isMerging) setIsDragging(true)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
            }}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50'
            }`}
          >
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <FilePlus2 aria-hidden="true" size={24} />
            </span>
            <h2 id="pdf-upload-heading" className="mt-4 font-semibold text-slate-950">
              Add PDF files
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Drag and drop PDFs here, or select files from your device.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleFileInput}
              className="sr-only"
              aria-label="Select PDF files"
              disabled={isMerging}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isMerging}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden="true" size={17} />
              Select PDFs
            </button>
            <p className="mt-4 text-xs text-slate-500">
              PDF files only <span aria-hidden="true">·</span> Maximum 25 MB per file
            </p>
          </div>
        </section>

        {status && (
          <div className="mx-auto mt-5 max-w-4xl">
            <StatusMessage status={status} />
          </div>
        )}

        {files.length > 0 && (
          <section aria-labelledby="selected-files-heading" className="mx-auto mt-6 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="selected-files-heading" className="font-semibold text-slate-950">
                  Selected PDFs
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use the arrows to set the order of the merged document.
                </p>
              </div>
              <p className="text-sm text-slate-500">{files.length} selected</p>
            </div>

            <ol className="mt-4 space-y-3">
              {files.map(({ id, file }, index) => (
                <li
                  key={id}
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:gap-4 sm:px-4"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-600 shadow-sm">
                    {index + 1}
                  </span>
                  <FileText aria-hidden="true" size={19} className="hidden shrink-0 text-indigo-700 sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900" title={file.name}>
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveFile(index, -1)}
                      disabled={isMerging || index === 0}
                      aria-label={`Move ${file.name} up`}
                      title="Move up"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowUp aria-hidden="true" size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, 1)}
                      disabled={isMerging || index === files.length - 1}
                      aria-label={`Move ${file.name} down`}
                      title="Move down"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowDown aria-hidden="true" size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(id)}
                      disabled={isMerging}
                      aria-label={`Remove ${file.name}`}
                      title="Remove file"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            {isMerging && (
              <div className="mt-5" role="status" aria-live="polite">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle aria-hidden="true" size={16} className="animate-spin text-indigo-600" />
                    Merging PDFs locally…
                  </span>
                  <span>{progress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="PDF merge progress"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={progress}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {files.length < 2 && !mergedPdf && (
              <p className="mt-4 text-sm text-amber-800">
                Add at least one more valid PDF before merging.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row">
              <button
                type="button"
                onClick={mergePdfs}
                disabled={isMerging}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMerging
                  ? <><LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> Merging PDFs…</>
                  : <><FileText aria-hidden="true" size={17} /> Merge PDFs</>}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={isMerging}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 aria-hidden="true" size={16} />
                Start again
              </button>
            </div>
          </section>
        )}

        {mergedPdf && status?.fileCount && (
          <section aria-labelledby="merge-result-heading" className="mx-auto mt-6 max-w-4xl rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 aria-hidden="true" size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="merge-result-heading" className="font-semibold text-slate-950">
                  Merged PDF is ready
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {status.fileCount} PDFs <span aria-hidden="true">·</span> {status.pageCount} pages
                  <span aria-hidden="true"> · </span>{formatFileSize(status.size)}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={downloadMergedPdf}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <Download aria-hidden="true" size={17} />
                Download merged PDF
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <FilePlus2 aria-hidden="true" size={16} />
                Start again
              </button>
            </div>
            {downloadMessage && <p role="status" className="mt-3 text-center text-sm text-slate-600">{downloadMessage}</p>}
          </section>
        )}

        {!files.length && (
          <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-5 text-slate-500">
            Files up to {formatFileSize(MAX_PDF_SIZE_BYTES)} each are supported. Very large or numerous PDFs may exceed available browser memory.
            No PDF data is sent to a server.
          </p>
        )}
      </div>
    </>
  )
}
