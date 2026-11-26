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
const INITIAL_QUALITY = 90
const INITIAL_BACKGROUND = '#ffffff'
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
let nextFileId = 0

function validateFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.type.toLowerCase().split(';')[0]

  if (extension !== 'png' || (mimeType && mimeType !== 'image/png')) {
    return `${file.name} is not a PNG image. Choose a .png file.`
  }
  if (!file.size) return `${file.name} is empty. Choose a valid PNG image.`
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `${file.name} is larger than the ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} per-file limit.`
  }
  return ''
}

async function hasPngSignature(file) {
  const signature = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer())
  return PNG_SIGNATURE.every((byte, index) => signature[index] === byte)
}

function createJpgName(fileName, existingNames) {
  const baseName = fileName
    .replace(/\.[^.]+$/u, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-')
    .trim() || 'converted-image'
  let outputName = `${baseName}.jpg`
  let suffix = 2

  while (existingNames.has(outputName.toLowerCase())) {
    outputName = `${baseName}-${suffix}.jpg`
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
    image.onerror = () => reject(new Error('This PNG could not be decoded. It may be corrupted or unsupported.'))
    image.src = sourceUrl
  })
}

function getErrorMessage(error) {
  return error instanceof Error && error.message
    ? error.message
    : 'This image could not be converted. Verify it is a valid PNG and try again.'
}

export default function PngToJpg() {
  const fileInputRef = useRef(null)
  const objectUrlsRef = useRef(new Set())
  const [files, setFiles] = useState([])
  const [quality, setQuality] = useState(INITIAL_QUALITY)
  const [background, setBackground] = useState(INITIAL_BACKGROUND)
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
      setStatus({ type: 'error', message: 'Choose one or more PNG images.' })
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
        outputName: createJpgName(file.name, existingNames),
        previewUrl: createObjectUrl(file),
        outputBlob: null,
        outputUrl: '',
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
          ...(accepted.length ? [`${accepted.length} valid PNG image${accepted.length === 1 ? '' : 's'} added.`] : []),
        ].join(' '),
      })
    } else {
      setStatus({
        type: 'success',
        message: `${accepted.length} PNG image${accepted.length === 1 ? '' : 's'} ready to convert.`,
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

  const invalidateConvertedFiles = () => {
    files.forEach(({ outputUrl }) => releaseObjectUrl(outputUrl))
    setFiles((currentFiles) => currentFiles.map((file) => ({
      ...file,
      outputBlob: null,
      outputUrl: '',
      outputPreviewSupported: true,
      conversionStatus: 'ready',
      error: '',
    })))
    setProgress(null)
    setZipProgress(0)
  }

  const changeQuality = (event) => {
    const nextQuality = Number(event.target.value)
    invalidateConvertedFiles()
    setQuality(nextQuality)
    setStatus(files.length
      ? { type: 'info', message: 'Quality changed. Convert again to create JPGs with this setting.' }
      : null)
  }

  const changeBackground = (event) => {
    const nextBackground = event.target.value
    invalidateConvertedFiles()
    setBackground(nextBackground)
    setStatus(files.length
      ? { type: 'info', message: 'Background color changed. Convert again to apply it to transparent areas.' }
      : null)
  }

  const convertFiles = async () => {
    if (isConverting || isZipping) return
    const pendingFiles = files.filter(({ conversionStatus }) => conversionStatus !== 'success')
    if (!pendingFiles.length) return

    setIsConverting(true)
    setProgress({ completed: 0, total: pendingFiles.length, currentFile: pendingFiles[0].file.name })
    setStatus({ type: 'info', message: 'Converting PNG images locally in your browser…' })

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
          if (!await hasPngSignature(entry.file)) {
            throw new Error('This file does not have a valid PNG signature. Choose a valid PNG image.')
          }

          image = await loadImage(entry.previewUrl)
          const width = image.naturalWidth
          const height = image.naturalHeight
          if (!width || !height) throw new Error('This PNG has invalid image dimensions.')
          if (width * height > MAX_SOURCE_PIXELS) {
            throw new Error(`This image exceeds the ${MAX_SOURCE_PIXELS / 1_000_000}-megapixel processing limit. Choose a smaller PNG to protect browser memory.`)
          }

          canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const context = canvas.getContext('2d', { alpha: false })
          if (!context) throw new Error('This browser could not create an image canvas.')

          context.fillStyle = background
          context.fillRect(0, 0, width, height)
          context.drawImage(image, 0, 0, width, height)

          const outputBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('The browser could not encode this image as JPG.'))
                } else if (blob.type.toLowerCase() !== 'image/jpeg' || !blob.size) {
                  reject(new Error('The browser returned an invalid JPG image.'))
                } else {
                  resolve(blob)
                }
              },
              'image/jpeg',
              quality / 100,
            )
          })

          const outputUrl = createObjectUrl(outputBlob)
          setFiles((currentFiles) => currentFiles.map((file) => (
            file.id === entry.id
              ? { ...file, outputBlob, outputUrl, conversionStatus: 'success', error: '' }
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
            message: `${successCount} image${successCount === 1 ? '' : 's'} converted. ${failureCount} file${failureCount === 1 ? '' : 's'} could not be converted; review the file cards and try another PNG if needed.`,
          }
        : {
            type: 'success',
            message: `${successCount} image${successCount === 1 ? '' : 's'} converted to JPG successfully.`,
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
    setStatus({ type: 'info', message: `Preparing a ZIP with ${convertedFiles.length} converted JPG image${convertedFiles.length === 1 ? '' : 's'}…` })

    try {
      const zip = new JSZip()
      convertedFiles.forEach(({ outputName, outputBlob }) => zip.file(outputName, outputBlob))
      const zipBlob = await zip.generateAsync(
        { type: 'blob' },
        ({ percent }) => setZipProgress(Math.round(percent)),
      )
      if (!zipBlob.size) throw new Error('The ZIP file is empty.')
      triggerDownload(zipBlob, 'converted-png-images.zip')
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
        title="PNG to JPG Converter - Convert PNG Images to JPG Online"
        description="Convert PNG images to JPG in your browser. Set image quality and a background color for transparent areas, preview results, and download individual images or a ZIP. Files stay on your device."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">PNG to JPG Converter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Convert one or more PNG images to JPG. Choose the output quality and
            the background color for transparent pixels, then download JPGs
            individually or together as a ZIP — everything stays on your device.
          </p>
        </header>

        <section aria-label="PNG to JPG converter" className="tool-surface-raised p-4 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
            <label
              htmlFor="png-files"
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
                id="png-files"
                type="file"
                accept=".png,image/png"
                multiple
                disabled={isConverting || isZipping}
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Choose PNG images"
              />
              <span className="flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={25} />
              </span>
              <span className="mt-4 text-base font-semibold text-slate-950">
                Drop your PNG images here
              </span>
              <span className="mt-1 text-sm text-slate-600">or select files from your device</span>
              <span className="tool-primary-button mt-5">
                <ImagePlus aria-hidden="true" size={17} />
                Choose images
              </span>
              <span className="mt-4 text-xs leading-5 text-slate-500">
                Up to {MAX_FILES} images, {formatFileSize(MAX_IMAGE_SIZE_BYTES)} each · PNG
              </span>
            </label>

            <div className="tool-surface flex flex-col p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">JPG output settings</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Adjust image quality and choose a solid background for transparent areas.
                </p>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="png-jpg-quality" className="text-sm font-medium text-slate-800">
                    JPG quality
                  </label>
                  <output htmlFor="png-jpg-quality" className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                    {quality}%
                  </output>
                </div>
                <input
                  id="png-jpg-quality"
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={quality}
                  onChange={changeQuality}
                  disabled={isConverting || isZipping}
                  className="mt-4 h-2 w-full cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                  aria-describedby="png-jpg-quality-help"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Smaller file</span>
                  <span>Higher quality</span>
                </div>
                <p id="png-jpg-quality-help" className="mt-3 text-xs leading-5 text-slate-500">
                  Default is 90%. Changing quality clears previous results so every JPG uses this setting.
                </p>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="png-jpg-background" className="text-sm font-medium text-slate-800">
                    Transparent area background
                  </label>
                  <span className="font-mono text-xs uppercase text-slate-500">{background}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    id="png-jpg-background"
                    type="color"
                    value={background}
                    onChange={changeBackground}
                    disabled={isConverting || isZipping}
                    className="size-10 cursor-pointer rounded-lg border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                    aria-label="Choose JPG background color"
                  />
                  <p className="text-xs leading-5 text-slate-600">
                    JPG does not support transparency. Transparent pixels will use this color.
                  </p>
                </div>
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
                        ? 'Convert to JPG'
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
                  {isZipping ? `Preparing ZIP… ${zipProgress}%` : `Download ${convertedCount || ''} converted JPGs as ZIP`}
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
            <section aria-labelledby="selected-pngs-heading" className="mt-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="selected-pngs-heading" className="text-lg font-bold text-slate-950">
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
                      <div
                        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100"
                        style={{ backgroundColor: background }}
                      >
                        {previewSource ? (
                          <img
                            src={previewSource}
                            alt={entry.outputUrl ? `Converted JPG preview of ${entry.file.name}` : `Preview of ${entry.file.name}`}
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
                                ? `Converted JPG · ${formatFileSize(entry.outputBlob.size)}`
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
                            <dt className="text-slate-500">Converted JPG</dt>
                            <dd className="mt-1 font-semibold text-slate-800">
                              {entry.outputBlob ? formatFileSize(entry.outputBlob.size) : '—'}
                            </dd>
                          </div>
                        </dl>

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
                            Download JPG
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
          <section aria-labelledby="about-png-to-jpg">
            <h2 id="about-png-to-jpg" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert PNG images to JPG in your browser
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              PNG supports transparency, while JPG does not. This converter flattens
              transparent pixels onto the background color you choose before encoding
              the image as a JPG. White is selected by default. Adjust JPG quality,
              preview the result, and download images individually or as a ZIP.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Images are processed locally with the browser Canvas API and are never
              uploaded. To protect browser memory, each PNG is limited to {formatFileSize(MAX_IMAGE_SIZE_BYTES)}
              {' '}and {MAX_SOURCE_PIXELS / 1_000_000} megapixels, with up to {MAX_FILES} images per batch.
            </p>
          </section>

          <section aria-labelledby="png-to-jpg-faq">
            <h2 id="png-to-jpg-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I convert PNG to JPG?', 'Choose or drop one or more PNG images, select a JPG quality and background color, then choose Convert to JPG. Download each result or save the converted files together in a ZIP.'],
                ['What happens to transparent areas?', 'JPG does not support transparency. Transparent pixels are filled with the selected background color; the default is white.'],
                ['Can I convert multiple PNG files?', `Yes. Select or drop up to ${MAX_FILES} PNG images. They are converted one at a time, with progress shown for each file.`],
                ['How does JPG quality affect the result?', 'Quality defaults to 90%. Lower quality may reduce file size and image detail, while higher quality usually preserves more detail. Changing quality clears prior conversions so each result uses the current setting.'],
                ['What are the image limits?', `Each PNG can be up to ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} and 30 megapixels. These limits help reduce the risk of high browser memory use.`],
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
