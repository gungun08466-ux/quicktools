import { PDFDocument } from 'pdf-lib'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  FileImage,
  FilePlus2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
}
const PIXELS_TO_POINTS = 0.75
let nextImageId = 0

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

function loadImageDimensions(previewUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('The image could not be opened.'))
    image.src = previewUrl
  })
}

async function createImageEntry(file) {
  const hasJpegExtension = /\.jpe?g$/i.test(file.name)
  const jpegMimeTypes = ['image/jpeg', 'image/pjpeg']
  if (!hasJpegExtension || (file.type && !jpegMimeTypes.includes(file.type.toLowerCase()))) {
    throw new Error(`${file.name} is not a JPG/JPEG image.`)
  }
  if (file.size < 4) {
    throw new Error(`${file.name} is empty or too small to be a valid JPEG image.`)
  }

  const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer())
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
    throw new Error(`${file.name} does not contain valid JPEG image data.`)
  }

  const previewUrl = URL.createObjectURL(file)
  try {
    const dimensions = await loadImageDimensions(previewUrl)
    if (!dimensions.width || !dimensions.height) {
      throw new Error('The image has invalid dimensions.')
    }

    nextImageId += 1
    return { id: nextImageId, file, previewUrl, ...dimensions }
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    throw new Error(`${file.name} could not be previewed. Choose a valid JPG/JPEG image.`)
  }
}

function getPageDimensions(pageSize, orientation, imageWidth, imageHeight) {
  if (pageSize === 'Fit to Image') {
    return [imageWidth * PIXELS_TO_POINTS, imageHeight * PIXELS_TO_POINTS]
  }

  const [portraitWidth, portraitHeight] = PAGE_SIZES[pageSize]
  return orientation === 'landscape'
    ? [portraitHeight, portraitWidth]
    : [portraitWidth, portraitHeight]
}

export default function JpgToPdf() {
  const fileInputRef = useRef(null)
  const isMountedRef = useRef(false)
  const previewUrlsRef = useRef(new Set())
  const conversionInProgressRef = useRef(false)
  const [images, setImages] = useState([])
  const [pageSize, setPageSize] = useState('A4')
  const [orientation, setOrientation] = useState('portrait')
  const [status, setStatus] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [downloadMessage, setDownloadMessage] = useState('')

  useEffect(() => {
    if (!pdfBlob) {
      setPdfUrl('')
      return undefined
    }

    const url = URL.createObjectURL(pdfBlob)
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pdfBlob])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      previewUrlsRef.current.clear()
    }
  }, [])

  const addImages = async (fileList) => {
    if (conversionInProgressRef.current) return

    const selectedFiles = Array.from(fileList || [])
    if (!selectedFiles.length) {
      setStatus({ type: 'error', message: 'Choose one or more JPG/JPEG images to continue.' })
      return
    }

    const accepted = []
    const errors = []
    for (const file of selectedFiles) {
      try {
        const entry = await createImageEntry(file)
        if (!isMountedRef.current) {
          URL.revokeObjectURL(entry.previewUrl)
          return
        }
        accepted.push(entry)
        previewUrlsRef.current.add(entry.previewUrl)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name} could not be opened.`)
      }
    }

    if (!isMountedRef.current) return

    if (accepted.length) {
      setImages((currentImages) => [...currentImages, ...accepted])
      setPdfBlob(null)
      setProgress(0)
      setDownloadMessage('')
    }

    if (errors.length) {
      setStatus({
        type: 'error',
        message: [...errors, ...(accepted.length ? [`${accepted.length} valid image${accepted.length === 1 ? '' : 's'} added.`] : [])].join(' '),
      })
    } else {
      setStatus({
        type: 'success',
        message: `${accepted.length} image${accepted.length === 1 ? '' : 's'} added. Arrange them before converting.`,
      })
    }
  }

  const handleFileInput = (event) => {
    const selection = Array.from(event.target.files || [])
    event.target.value = ''
    void addImages(selection)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    void addImages(event.dataTransfer.files)
  }

  const removeImage = (imageId) => {
    if (conversionInProgressRef.current) return

    const image = images.find(({ id }) => id === imageId)
    if (image) {
      URL.revokeObjectURL(image.previewUrl)
      previewUrlsRef.current.delete(image.previewUrl)
    }
    setImages((currentImages) => currentImages.filter(({ id }) => id !== imageId))
    setPdfBlob(null)
    setProgress(0)
    setStatus(null)
    setDownloadMessage('')
  }

  const moveImage = (index, direction) => {
    if (conversionInProgressRef.current) return

    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= images.length) return

    setImages((currentImages) => {
      const reordered = [...currentImages]
      const currentImage = reordered[index]
      reordered[index] = reordered[targetIndex]
      reordered[targetIndex] = currentImage
      return reordered
    })
    setPdfBlob(null)
    setStatus(null)
    setDownloadMessage('')
  }

  const convertToPdf = async () => {
    if (conversionInProgressRef.current) return
    if (images.length === 0) {
      setStatus({ type: 'error', message: 'Add at least one valid JPG/JPEG image before converting.' })
      return
    }

    conversionInProgressRef.current = true
    setIsConverting(true)
    setProgress(0)
    setPdfBlob(null)
    setDownloadMessage('')
    setStatus({ type: 'success', message: 'Converting your images locally in the browser…' })

    try {
      const outputPdf = await PDFDocument.create()

      for (let index = 0; index < images.length; index += 1) {
        const { file } = images[index]
        let embeddedImage
        try {
          embeddedImage = await outputPdf.embedJpg(await file.arrayBuffer())
        } catch {
          throw new Error(`${file.name} could not be embedded. Choose a valid, uncorrupted JPG/JPEG image.`)
        }

        const [pageWidth, pageHeight] = getPageDimensions(
          pageSize,
          orientation,
          embeddedImage.width,
          embeddedImage.height,
        )
        const page = outputPdf.addPage([pageWidth, pageHeight])
        const scale = Math.min(pageWidth / embeddedImage.width, pageHeight / embeddedImage.height)
        const imageWidth = embeddedImage.width * scale
        const imageHeight = embeddedImage.height * scale
        page.drawImage(embeddedImage, {
          x: (pageWidth - imageWidth) / 2,
          y: (pageHeight - imageHeight) / 2,
          width: imageWidth,
          height: imageHeight,
        })
        setProgress(Math.round(((index + 1) / images.length) * 90))
      }

      const pdfBytes = await outputPdf.save()
      setPdfBlob(new Blob([pdfBytes], { type: 'application/pdf' }))
      setProgress(100)
      setStatus({
        type: 'success',
        message: `Converted ${images.length} JPG image${images.length === 1 ? '' : 's'} into one PDF.`,
      })
    } catch (conversionError) {
      const message = conversionError instanceof Error ? conversionError.message : ''
      setStatus({
        type: 'error',
        message: /memory|allocation|array buffer/i.test(message)
          ? 'The browser ran out of memory while converting these images. Try fewer or smaller images.'
          : message || 'The images could not be converted. Check the files and try again.',
      })
      setProgress(0)
    } finally {
      conversionInProgressRef.current = false
      setIsConverting(false)
    }
  }

  const reset = () => {
    if (conversionInProgressRef.current) return

    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
    setImages([])
    setPdfBlob(null)
    setProgress(0)
    setStatus(null)
    setDownloadMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <PageMetadata
        title="JPG to PDF Converter"
        description="Convert JPG images to PDF in your browser. Upload multiple JPG or JPEG files, arrange their order, choose page size and orientation, and download one PDF."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <ShieldCheck aria-hidden="true" size={16} />
            Private, browser-based conversion
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            JPG to PDF Converter
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Convert JPG images to one PDF, set the page layout, and arrange the pages
            before downloading. Your images stay on your device.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-4xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>Conversion runs in your browser. Your images are not uploaded to a server.</span>
          </p>
        </div>

        <section aria-label="JPG to PDF conversion" className="mx-auto mt-6 max-w-4xl space-y-5">
          <label
            htmlFor="jpg-files"
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`block cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-8 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50'
            } ${isConverting ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              id="jpg-files"
              type="file"
              accept=".jpg,.jpeg,image/jpeg"
              multiple
              onChange={handleFileInput}
              disabled={isConverting}
              className="sr-only"
            />
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Upload aria-hidden="true" size={22} />
            </span>
            <span className="mt-3 block font-semibold text-slate-950">
              Drag and drop JPG images here
            </span>
            <span className="mt-1 block text-sm text-slate-600">
              or <span className="font-semibold text-indigo-700 underline">choose files</span> from your device
            </span>
            <span className="mt-2 block text-xs text-slate-500">JPG and JPEG images are supported.</span>
          </label>

          {images.length > 0 && (
            <section aria-labelledby="uploaded-images-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="uploaded-images-heading" className="font-semibold text-slate-950">
                    Uploaded images
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the arrows to change the order of the PDF pages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  disabled={isConverting}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  Clear all
                </button>
              </div>

              <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {images.map((image, index) => (
                  <li key={image.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex h-40 items-center justify-center bg-white p-2">
                      <img
                        src={image.previewUrl}
                        alt={`Preview of ${image.file.name}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-slate-800" title={image.file.name}>
                        {index + 1}. {image.file.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {image.width} × {image.height} px
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveImage(index, -1)}
                            disabled={isConverting || index === 0}
                            aria-label={`Move ${image.file.name} up`}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowUp aria-hidden="true" size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveImage(index, 1)}
                            disabled={isConverting || index === images.length - 1}
                            aria-label={`Move ${image.file.name} down`}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <ArrowDown aria-hidden="true" size={16} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          disabled={isConverting}
                          aria-label={`Remove ${image.file.name}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="pdf-settings-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <FileImage aria-hidden="true" size={20} />
              </span>
              <div>
                <h2 id="pdf-settings-heading" className="font-semibold text-slate-950">
                  PDF settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">Each image becomes a separate PDF page.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pdf-page-size" className="text-sm font-medium text-slate-800">
                  Page size
                </label>
                <select
                  id="pdf-page-size"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(event.target.value)
                    setPdfBlob(null)
                    setProgress(0)
                    setStatus(null)
                    setDownloadMessage('')
                  }}
                  disabled={isConverting}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Fit to Image">Fit to Image</option>
                </select>
              </div>
              <div>
                <label htmlFor="pdf-orientation" className="text-sm font-medium text-slate-800">
                  Orientation
                </label>
                <select
                  id="pdf-orientation"
                  value={orientation}
                  onChange={(event) => {
                    setOrientation(event.target.value)
                    setPdfBlob(null)
                    setProgress(0)
                    setStatus(null)
                    setDownloadMessage('')
                  }}
                  disabled={isConverting || pageSize === 'Fit to Image'}
                  className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
                {pageSize === 'Fit to Image' && (
                  <p className="mt-1 text-xs text-slate-500">Fit to Image follows each image’s own orientation.</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={convertToPdf}
              disabled={isConverting}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-70"
            >
              {isConverting
                ? <LoaderCircle aria-hidden="true" size={17} className="animate-spin" />
                : <FilePlus2 aria-hidden="true" size={17} />}
              {isConverting ? 'Converting images…' : 'Convert to PDF'}
            </button>

            {isConverting && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Creating PDF pages…</span>
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

            {pdfUrl && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm text-emerald-900">
                  <p className="font-semibold">Your PDF is ready.</p>
                  {downloadMessage && <p className="mt-1" role="status">{downloadMessage}</p>}
                </div>
                <a
                  href={pdfUrl}
                  download="quicktools-images.pdf"
                  onClick={() => setDownloadMessage('Download started.')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  <Download aria-hidden="true" size={17} />
                  Download PDF
                </a>
              </div>
            )}

            <StatusMessage status={status} />
          </section>
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="jpg-to-pdf-explanation">
            <h2 id="jpg-to-pdf-explanation" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert JPG images to a single PDF
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This free JPG to PDF converter combines multiple JPEG images into one document, with one image per page.
              Add your files, arrange the page order, choose A4 or Letter paper and an orientation, or let each page
              fit the image dimensions. The conversion and download are handled locally in your browser.
            </p>
          </section>

          <section aria-labelledby="jpg-to-pdf-faq">
            <h2 id="jpg-to-pdf-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200">
              {[
                ['How do I convert JPG to PDF?', 'Choose or drop one or more JPG/JPEG images, arrange their order, select page settings, and choose Convert to PDF. Download the finished file when it is ready.'],
                ['Can I add more than one image?', 'Yes. Add multiple JPG or JPEG images. Each accepted image becomes its own page in the same PDF.'],
                ['Can I change the order of images?', 'Yes. Use the up and down arrow buttons on each image card to set the PDF page order before converting.'],
                ['What does Fit to Image mean?', 'Each PDF page uses the dimensions and aspect ratio of its corresponding image. The orientation is determined by the image, so the orientation control is disabled for this page-size option.'],
                ['Are my images uploaded?', 'No. The converter reads and processes your images in your browser and does not upload them to a conversion server.'],
                ['Which image types are supported?', 'The converter accepts valid JPG and JPEG images. Other image types, including PNG and WebP, are not accepted by this tool.'],
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
