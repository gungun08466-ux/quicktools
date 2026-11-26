import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import JSZip from 'jszip'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { formatFileSize, MAX_IMAGE_SIZE_BYTES } from '../utils/imageValidation.js'

const MAX_FILES = 20
const MAX_SOURCE_PIXELS = 30_000_000
const JPEG_SIGNATURE_LENGTH = 3
let nextFileId = 0

function validateFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.type.toLowerCase().split(';')[0]

  if (!['jpg', 'jpeg'].includes(extension) || (mimeType && !['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(mimeType))) {
    return `${file.name} is not a JPG or JPEG image. Choose a .jpg or .jpeg file.`
  }
  if (!file.size) return `${file.name} is empty. Choose a valid JPG image.`
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `${file.name} is larger than the ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} per-file limit.`
  }
  return ''
}

async function hasJpegSignature(file) {
  const signature = new Uint8Array(await file.slice(0, JPEG_SIGNATURE_LENGTH).arrayBuffer())
  return signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
}

function createPngName(fileName, existingNames) {
  const baseName = fileName
    .replace(/\.[^.]+$/u, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
    .trim() || 'converted-image'
  let outputName = `${baseName}.png`
  let suffix = 2

  while (existingNames.has(outputName.toLowerCase())) {
    outputName = `${baseName}-${suffix}.png`
    suffix += 1
  }

  existingNames.add(outputName.toLowerCase())
  return outputName
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2
  const colors = isError
    ? 'border-red-200 bg-red-50 text-red-800'
    : status.type === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-900'
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

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function loadImage(sourceUrl) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('This JPG could not be decoded. It may be corrupted or unsupported.'))
    image.src = sourceUrl
  })
}

function getErrorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : 'This image could not be converted. Verify it is a valid JPG or JPEG and try again.'
}

export default function JpgToPng() {
  const fileInputRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const [files, setFiles] = useState([])
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [progress, setProgress] = useState(null)
  const [zipProgress, setZipProgress] = useState(0)

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
  }, [])

  const createObjectUrl = (blob) => {
    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.add(url)
    return url
  }

  const releaseObjectUrl = (url) => {
    if (!url || !objectUrlsRef.current.has(url)) return
    URL.revokeObjectURL(url)
    objectUrlsRef.current.delete(url)
  }

  const addFiles = (fileList) => {
    if (isConverting || isZipping) return
    const selectedFiles = Array.from(fileList || [])
    if (!selectedFiles.length) {
      setStatus({ type: 'error', message: 'Choose one or more JPG or JPEG images.' })
      return
    }

    const accepted = []
    const errors = []
    const existingNames = new Set(files.map(({ outputName }) => outputName.toLowerCase()))
    const availableSlots = Math.max(0, MAX_FILES - files.length)

    selectedFiles.forEach((file) => {
      const error = validateFile(file)
      if (error) {
        errors.push(error)
        return
      }
      if (accepted.length >= availableSlots) {
        errors.push(`${file.name} was not added. A maximum of ${MAX_FILES} images can be converted at once.`)
        return
      }

      nextFileId += 1
      accepted.push({
        id: nextFileId,
        file,
        outputName: createPngName(file.name, existingNames),
        previewUrl: createObjectUrl(file),
        outputBlob: null,
        outputUrl: '',
        dimensions: null,
        previewSupported: true,
        outputPreviewSupported: true,
        conversionStatus: 'ready',
        error: '',
      })
    })

    if (accepted.length) {
      setFiles((currentFiles) => [...currentFiles, ...accepted])
      setProgress(null)
      setZipProgress(0)
    }

    if (errors.length) {
      const displayedErrors = errors.slice(0, 3)
      const remainingErrorCount = errors.length - displayedErrors.length
      setStatus({
        type: 'error',
        message: [
          ...displayedErrors,
          ...(remainingErrorCount ? [`${remainingErrorCount} more file${remainingErrorCount === 1 ? '' : 's'} could not be added.`] : []),
          ...(accepted.length ? [`${accepted.length} valid JPG/JPEG image${accepted.length === 1 ? '' : 's'} added.`] : []),
        ].join(' '),
      })
    } else {
      setStatus({
        type: 'success',
        message: `${accepted.length} JPG/JPEG image${accepted.length === 1 ? '' : 's'} ready to convert.`,
      })
    }
  }

  const handleFileInput = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''
    addFiles(selectedFiles)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const removeFile = (fileId) => {
    if (isConverting || isZipping) return
    const removedFile = files.find(({ id }) => id === fileId)
    if (removedFile) {
      releaseObjectUrl(removedFile.previewUrl)
      releaseObjectUrl(removedFile.outputUrl)
    }
    setFiles((currentFiles) => currentFiles.filter(({ id }) => id !== fileId))
    setStatus(null)
    setProgress(null)
    setZipProgress(0)
  }

  const clearFiles = () => {
    if (isConverting || isZipping) return
    files.forEach(({ previewUrl, outputUrl }) => {
      releaseObjectUrl(previewUrl)
      releaseObjectUrl(outputUrl)
    })
    setFiles([])
    setStatus(null)
    setProgress(null)
    setZipProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const convertFiles = async () => {
    if (isConverting || isZipping) return
    const pendingFiles = files.filter(({ conversionStatus }) => conversionStatus !== 'success')
    if (!pendingFiles.length) return

    setIsConverting(true)
    setProgress({ completed: 0, total: pendingFiles.length, currentFile: pendingFiles[0].file.name })
    setStatus({ type: 'info', message: 'Converting JPG images to PNG locally in your browser…' })

    let successCount = 0
    let failureCount = 0

    try {
      for (let index = 0; index < pendingFiles.length; index += 1) {
        const entry = pendingFiles[index]
        let canvas = null
        let image = null
        setProgress({
          completed: index,
          total: pendingFiles.length,
          currentFile: entry.file.name,
        })
        setFiles((currentFiles) => currentFiles.map((file) => (
          file.id === entry.id
            ? { ...file, conversionStatus: 'converting', error: '' }
            : file
        )))

        try {
          await new Promise((resolve) => window.requestAnimationFrame(resolve))
          if (!await hasJpegSignature(entry.file)) {
            throw new Error('This file does not have a valid JPG/JPEG signature. Choose a valid JPG image.')
          }

          image = await loadImage(entry.previewUrl)
          const width = image.naturalWidth
          const height = image.naturalHeight
          if (!width || !height) throw new Error('This JPG has invalid image dimensions.')
          if (width * height > MAX_SOURCE_PIXELS) {
            throw new Error(`This image exceeds the ${MAX_SOURCE_PIXELS / 1_000_000}-megapixel processing limit. Choose a smaller JPG to protect browser memory.`)
          }

          canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d', { alpha: false })
          if (!context) throw new Error('This browser could not create an image canvas.')
          context.drawImage(image, 0, 0, width, height)

          const outputBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('The browser could not encode this image as PNG.'))
                } else if (blob.type.toLowerCase() !== 'image/png' || !blob.size) {
                  reject(new Error('The browser returned an invalid PNG image.'))
                } else {
                  resolve(blob)
                }
              },
              'image/png',
            )
          })

          const outputUrl = createObjectUrl(outputBlob)
          setFiles((currentFiles) => currentFiles.map((file) => (
            file.id === entry.id
              ? {
                  ...file,
                  outputBlob,
                  outputUrl,
                  dimensions: { width, height },
                  conversionStatus: 'success',
                  error: '',
                }
              : file
          )))
          successCount += 1
        } catch (error) {
          setFiles((currentFiles) => currentFiles.map((file) => (
            file.id === entry.id
              ? { ...file, conversionStatus: 'error', error: getErrorMessage(error) }
              : file
          )))
          failureCount += 1
        } finally {
          if (canvas) {
            canvas.width = 0
            canvas.height = 0
          }
          if (image) {
            image.onload = null
            image.onerror = null
            image.src = ''
          }
        }

        setProgress({
          completed: index + 1,
          total: pendingFiles.length,
          currentFile: '',
        })
      }

      setStatus(failureCount
        ? {
            type: 'error',
            message: `${successCount} image${successCount === 1 ? '' : 's'} converted. ${failureCount} file${failureCount === 1 ? '' : 's'} could not be converted; review the file cards and try another JPG if needed.`,
          }
        : {
            type: 'success',
            message: `${successCount} image${successCount === 1 ? '' : 's'} converted to PNG successfully.`,
          })
    } catch (error) {
      setStatus({
        type: 'error',
        message: `Conversion stopped. ${getErrorMessage(error)}`,
      })
    } finally {
      setIsConverting(false)
      setProgress(null)
    }
  }

  const downloadImage = (entry) => {
    if (!entry.outputBlob || isConverting || isZipping) return
    try {
      triggerDownload(entry.outputBlob, entry.outputName)
      setStatus({ type: 'success', message: `${entry.outputName} download started.` })
    } catch (error) {
      setStatus({ type: 'error', message: `Download failed. ${getErrorMessage(error)}` })
    }
  }

  const downloadZip = async () => {
    const convertedFiles = files.filter(({ outputBlob }) => outputBlob)
    if (!convertedFiles.length || isConverting || isZipping) return

    setIsZipping(true)
    setZipProgress(0)
    setStatus({ type: 'info', message: `Preparing a ZIP with ${convertedFiles.length} converted PNG image${convertedFiles.length === 1 ? '' : 's'}…` })

    try {
      const zip = new JSZip()
      convertedFiles.forEach(({ outputName, outputBlob }) => zip.file(outputName, outputBlob))
      const zipBlob = await zip.generateAsync(
        { type: 'blob' },
        ({ percent }) => setZipProgress(Math.round(percent)),
      )
      if (!zipBlob.size) throw new Error('The ZIP file is empty.')
      triggerDownload(zipBlob, 'converted-jpg-images.zip')
      setStatus({ type: 'success', message: 'ZIP download started.' })
    } catch (error) {
      setStatus({ type: 'error', message: `Could not create the ZIP file. ${getErrorMessage(error)}` })
    } finally {
      setIsZipping(false)
    }
  }

  const convertedCount = files.filter(({ outputBlob }) => outputBlob).length
  const pendingCount = files.length - convertedCount

  return (
    <>
      <PageMetadata
        title="JPG to PNG Converter - Convert JPEG Images to PNG Online"
        description="Convert JPG and JPEG images to PNG in your browser. Preserve original pixel dimensions, preview results, and download individual images or a ZIP. Files stay on your device."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">JPG to PNG Converter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Convert one or more JPG/JPEG images to PNG while keeping their original
            pixel dimensions. Preview each result, then download PNGs individually
            or together as a ZIP — everything stays on your device.
          </p>
        </header>

        <section aria-label="JPG to PNG converter" className="tool-surface-raised p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
            <label
              htmlFor="jpg-png-files"
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`tool-dropzone flex min-h-56 cursor-pointer flex-col items-center justify-center p-6 text-center transition focus-within:ring-4 focus-within:ring-indigo-100 sm:min-h-64 sm:p-9 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : ''
              } ${isConverting || isZipping ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                id="jpg-png-files"
                type="file"
                accept=".jpg,.jpeg,image/jpeg"
                multiple
                disabled={isConverting || isZipping}
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Choose JPG or JPEG images"
              />
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">
                Drop your JPG/JPEG images here
              </span>
              <span className="mt-1 text-sm text-slate-600">or select files from your device</span>
              <span className="tool-primary-button mt-5">
                <ImagePlus aria-hidden="true" size={17} />
                Choose images
              </span>
              <span className="mt-4 text-xs leading-5 text-slate-500">
                Up to {MAX_FILES} images, {formatFileSize(MAX_IMAGE_SIZE_BYTES)} each · .jpg and .jpeg
              </span>
            </label>

            <div className="tool-surface flex flex-col p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">PNG output</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  PNG encoding is lossless and keeps each image at its original pixel dimensions.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Dimensions preserved</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    The converter uses the source image width and height without resizing.
                  </p>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  PNG does not add further lossy compression. It cannot restore detail already lost in a JPG.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-6">
                <button
                  type="button"
                  onClick={convertFiles}
                  disabled={!pendingCount || isConverting || isZipping}
                  className="tool-primary-button w-full"
                >
                  {isConverting
                    ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                    : <FileImage aria-hidden="true" size={17} />}
                  {isConverting
                    ? 'Converting images…'
                    : pendingCount && files.some(({ conversionStatus }) => conversionStatus === 'error')
                      ? 'Retry failed conversions'
                      : pendingCount
                        ? 'Convert to PNG'
                        : files.length
                          ? 'All images converted'
                          : 'Add images to convert'}
                </button>
                <button
                  type="button"
                  onClick={downloadZip}
                  disabled={!convertedCount || isConverting || isZipping}
                  className="tool-secondary-button w-full"
                >
                  {isZipping
                    ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                    : <Download aria-hidden="true" size={17} />}
                  {isZipping ? `Preparing ZIP… ${zipProgress}%` : `Download ${convertedCount || ''} converted PNGs as ZIP`}
                </button>
              </div>
            </div>
          </div>

          {progress && (
            <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-sm font-medium text-indigo-900">
                <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                {progress.currentFile
                  ? `Converting ${progress.completed + 1} of ${progress.total}: ${progress.currentFile}`
                  : `Converted ${progress.completed} of ${progress.total} images`}
              </div>
              <progress
                className="mt-3 h-2 w-full accent-indigo-600"
                value={progress.completed}
                max={progress.total}
                aria-label="Images converted"
              />
            </div>
          )}

          {isZipping && (
            <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm font-medium text-indigo-900">
                <span>Building ZIP archive…</span>
                <span>{zipProgress}%</span>
              </div>
              <progress className="mt-3 h-2 w-full accent-indigo-600" value={zipProgress} max="100" aria-label="ZIP creation progress" />
            </div>
          )}

          {status && <div className="mt-5"><StatusMessage status={status} /></div>}

          {files.length > 0 && (
            <section aria-labelledby="selected-jpgs-heading" className="mt-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="selected-jpgs-heading" className="text-lg font-bold text-slate-950">
                    Your images
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {files.length} selected · {convertedCount} converted
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFiles}
                  disabled={isConverting || isZipping}
                  className="tool-secondary-button"
                >
                  <Trash2 aria-hidden="true" size={16} />
                  Clear all
                </button>
              </div>

              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {files.map((entry) => {
                  const previewSource = entry.outputUrl
                    ? entry.outputPreviewSupported ? entry.outputUrl : ''
                    : entry.previewSupported ? entry.previewUrl : ''
                  return (
                    <li key={entry.id} className="tool-surface overflow-hidden">
                      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                        {previewSource ? (
                          <img
                            src={previewSource}
                            alt={entry.outputUrl ? `Converted PNG preview of ${entry.file.name}` : `Preview of ${entry.file.name}`}
                            loading="lazy"
                            onError={() => setFiles((currentFiles) => currentFiles.map((file) => {
                              if (file.id !== entry.id) return file
                              if (entry.outputUrl && file.outputPreviewSupported) {
                                return { ...file, outputPreviewSupported: false }
                              }
                              if (!entry.outputUrl && file.previewSupported) {
                                return { ...file, previewSupported: false }
                              }
                              return file
                            }))}
                            className="size-full object-contain p-2"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 px-4 text-center text-slate-400">
                            <FileImage aria-hidden="true" size={34} />
                            <span className="text-xs">
                              {entry.previewSupported ? 'Preview unavailable' : 'This image could not be previewed'}
                            </span>
                          </div>
                        )}
                        {entry.conversionStatus === 'converting' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white">
                            <span className="flex items-center gap-2 rounded-full bg-slate-950/70 px-4 py-2 text-sm font-semibold">
                              <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                              Converting
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-all text-sm font-semibold text-slate-950">{entry.file.name}</h3>
                            <p className="mt-1 text-xs text-slate-500">
                              {entry.conversionStatus === 'success'
                                ? `Converted PNG · ${formatFileSize(entry.outputBlob.size)}`
                                : entry.conversionStatus === 'converting'
                                  ? 'Converting image…'
                                  : entry.conversionStatus === 'error'
                                    ? 'Conversion failed'
                                    : `Original · ${formatFileSize(entry.file.size)}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(entry.id)}
                            disabled={isConverting || isZipping}
                            aria-label={`Remove ${entry.file.name}`}
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <X aria-hidden="true" size={17} />
                          </button>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                          <div>
                            <dt className="text-slate-500">Original size</dt>
                            <dd className="mt-1 font-semibold text-slate-800">{formatFileSize(entry.file.size)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Converted PNG</dt>
                            <dd className="mt-1 font-semibold text-slate-800">
                              {entry.outputBlob ? formatFileSize(entry.outputBlob.size) : '—'}
                            </dd>
                          </div>
                        </dl>

                        {entry.dimensions && (
                          <p className="mt-3 text-xs text-slate-500">
                            Output dimensions: <span className="font-semibold text-slate-700">{entry.dimensions.width} × {entry.dimensions.height} px</span>
                          </p>
                        )}

                        {entry.error && (
                          <p role="alert" className="mt-3 text-xs leading-5 text-red-700">{entry.error}</p>
                        )}

                        {entry.outputBlob && (
                          <button
                            type="button"
                            onClick={() => downloadImage(entry)}
                            disabled={isConverting || isZipping}
                            className="tool-secondary-button mt-4 w-full"
                          >
                            <Download aria-hidden="true" size={16} />
                            Download PNG
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-jpg-to-png">
            <h2 id="about-jpg-to-png" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert JPG images to PNG in your browser
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Add one or more JPG or JPEG images to create PNG copies. The browser
              decodes each source and encodes the result at the same pixel width
              and height, without resizing. PNG encoding is lossless for the decoded
              image, though it cannot restore detail that was already lost when the
              source JPG was created. PNG files may be larger than their JPG originals.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Conversion uses the browser Canvas API. Images are never uploaded.
              To help protect browser memory, each source is limited to {formatFileSize(MAX_IMAGE_SIZE_BYTES)}
              {' '}and {MAX_SOURCE_PIXELS / 1_000_000} megapixels, with up to {MAX_FILES} images per batch.
            </p>
          </section>

          <section aria-labelledby="jpg-to-png-faq">
            <h2 id="jpg-to-png-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I convert JPG to PNG?', 'Choose or drop one or more JPG/JPEG images, then select Convert to PNG. Download the results individually or save them together as a ZIP.'],
                ['Are the original image dimensions preserved?', 'Yes. The converter reads each image’s natural pixel width and height, then creates the PNG canvas at exactly those dimensions without resizing.'],
                ['Does PNG improve JPG image quality?', 'PNG stores the converted pixels without adding more lossy compression. It cannot restore detail already lost in the original JPG, and the PNG may be larger.'],
                ['Can I convert multiple JPG files at once?', `Yes. Select or drop up to ${MAX_FILES} JPG/JPEG images. They are converted one at a time, with progress shown for each file.`],
                ['What are the image limits?', `Each JPG can be up to ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} and 30 megapixels. These limits help reduce the risk of high browser memory use.`],
                ['Are my images uploaded?', 'No. Image decoding, Canvas conversion, previews, and ZIP creation run locally in your browser. QuickTools does not send your files to a processing server.'],
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
