import {
  AlertCircle,
  CheckCircle2,
  Download,
  Image,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import {
  formatFileSize,
  MAX_IMAGE_SIZE_BYTES,
  validateImageFile,
} from '../utils/imageValidation.js'

const MAX_SOURCE_PIXELS = 50_000_000
const MAX_OUTPUT_PIXELS = 16_000_000
const MAX_OUTPUT_DIMENSION = 10_000
const OUTPUT_FORMATS = {
  'image/jpeg': { label: 'JPG', extension: 'jpg' },
  'image/png': { label: 'PNG', extension: 'png' },
  'image/webp': { label: 'WebP', extension: 'webp' },
}
const DIMENSION_PRESETS = [
  { label: 'Square avatar', width: 512, height: 512 },
  { label: 'HD image', width: 1280, height: 720 },
  { label: 'Full HD', width: 1920, height: 1080 },
  { label: 'Instagram square', width: 1080, height: 1080 },
  { label: 'Instagram portrait', width: 1080, height: 1350 },
  { label: '4K image', width: 3840, height: 2160 },
]

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2
  const colors = isError
    ? 'border-red-200 bg-red-50 text-red-800'
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

function getResizedFilename(name, extension) {
  const baseName = name.replace(/\.[^.]+$/, '') || 'image'
  return `${baseName}-resized.${extension}`
}

export default function ImageResizer() {
  const fileInputRef = useRef(null)
  const imageElementRef = useRef(null)
  const [imageFile, setImageFile] = useState(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [resizedBlob, setResizedBlob] = useState(null)
  const [resizedUrl, setResizedUrl] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)
  const [outputFormat, setOutputFormat] = useState('image/jpeg')
  const [quality, setQuality] = useState(90)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!imageFile) {
      setSourceUrl('')
      setDimensions(null)
      imageElementRef.current = null
      return undefined
    }

    const url = URL.createObjectURL(imageFile)
    const image = new window.Image()
    let active = true
    setSourceUrl(url)
    setIsLoading(true)
    image.onload = () => {
      if (!active) return
      const naturalWidth = image.naturalWidth
      const naturalHeight = image.naturalHeight
      if (naturalWidth * naturalHeight > MAX_SOURCE_PIXELS) {
        setStatus({
          type: 'error',
          message: 'This image has more than 50 megapixels. Choose a smaller image to protect browser memory.',
        })
        setIsLoading(false)
        setImageFile(null)
        return
      }

      imageElementRef.current = image
      setDimensions({ width: naturalWidth, height: naturalHeight })
      setWidth(String(naturalWidth))
      setHeight(String(naturalHeight))
      setStatus(null)
      setIsLoading(false)
    }
    image.onerror = () => {
      if (!active) return
      setStatus({
        type: 'error',
        message: 'This image could not be opened. Try a valid JPG, PNG, or WebP image.',
      })
      setIsLoading(false)
      setImageFile(null)
    }
    image.src = url

    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [imageFile])

  useEffect(() => {
    if (!resizedBlob) {
      setResizedUrl('')
      return undefined
    }

    const url = URL.createObjectURL(resizedBlob)
    setResizedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [resizedBlob])

  const clearResizedImage = () => {
    setResizedBlob(null)
    setStatus(null)
  }

  const chooseImage = (file) => {
    if (isResizing) return

    const validationError = validateImageFile(file)
    if (validationError) {
      setStatus({ type: 'error', message: validationError })
      return
    }

    setStatus(null)
    setResizedBlob(null)
    setDimensions(null)
    setWidth('')
    setHeight('')
    setSelectedPreset('')
    setImageFile(file)
  }

  const handleFileInput = (event) => {
    chooseImage(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) chooseImage(file)
    else setStatus({ type: 'error', message: 'Drop one image file to continue.' })
  }

  const handleWidthChange = (event) => {
    const nextWidth = event.target.value
    setWidth(nextWidth)
    setSelectedPreset('')
    clearResizedImage()
    if (maintainAspectRatio && dimensions && Number(nextWidth) > 0) {
      setHeight(String(Math.max(1, Math.round(Number(nextWidth) * dimensions.height / dimensions.width))))
    }
  }

  const handleHeightChange = (event) => {
    const nextHeight = event.target.value
    setHeight(nextHeight)
    setSelectedPreset('')
    clearResizedImage()
    if (maintainAspectRatio && dimensions && Number(nextHeight) > 0) {
      setWidth(String(Math.max(1, Math.round(Number(nextHeight) * dimensions.width / dimensions.height))))
    }
  }

  const toggleAspectRatio = (event) => {
    const nextValue = event.target.checked
    setMaintainAspectRatio(nextValue)
    setSelectedPreset('')
    clearResizedImage()
    if (nextValue && dimensions && Number(width) > 0) {
      setHeight(String(Math.max(1, Math.round(Number(width) * dimensions.height / dimensions.width))))
    }
  }

  const applyPreset = (event) => {
    const presetIndex = Number(event.target.value)
    setSelectedPreset(event.target.value)
    if (!Number.isInteger(presetIndex) || !DIMENSION_PRESETS[presetIndex] || !dimensions) return

    const preset = DIMENSION_PRESETS[presetIndex]
    if (maintainAspectRatio) {
      const scale = Math.min(
        preset.width / dimensions.width,
        preset.height / dimensions.height,
      )
      setWidth(String(Math.max(1, Math.round(dimensions.width * scale))))
      setHeight(String(Math.max(1, Math.round(dimensions.height * scale))))
    } else {
      setWidth(String(preset.width))
      setHeight(String(preset.height))
    }
    clearResizedImage()
  }

  const changeOutputFormat = (event) => {
    setOutputFormat(event.target.value)
    clearResizedImage()
  }

  const resizeImage = async () => {
    if (!imageFile || !dimensions || !imageElementRef.current || isResizing) return

    const outputWidth = Number(width)
    const outputHeight = Number(height)
    if (!Number.isInteger(outputWidth) || !Number.isInteger(outputHeight)
      || outputWidth < 1 || outputHeight < 1) {
      setStatus({ type: 'error', message: 'Enter a whole-number width and height greater than zero.' })
      return
    }
    if (outputWidth > MAX_OUTPUT_DIMENSION || outputHeight > MAX_OUTPUT_DIMENSION) {
      setStatus({
        type: 'error',
        message: `Width and height must each be ${MAX_OUTPUT_DIMENSION.toLocaleString()} pixels or less.`,
      })
      return
    }
    if (outputWidth * outputHeight > MAX_OUTPUT_PIXELS) {
      setStatus({
        type: 'error',
        message: 'That output is too large to process safely. Choose dimensions with 16 megapixels or fewer.',
      })
      return
    }

    setIsResizing(true)
    setStatus(null)
    try {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
      const canvas = document.createElement('canvas')
      canvas.width = outputWidth
      canvas.height = outputHeight
      const context = canvas.getContext('2d', { alpha: outputFormat !== 'image/jpeg' })
      if (!context) throw new Error('This browser could not create an image canvas.')

      if (outputFormat === 'image/jpeg') {
        context.fillStyle = '#fff'
        context.fillRect(0, 0, outputWidth, outputHeight)
      }
      context.drawImage(imageElementRef.current, 0, 0, outputWidth, outputHeight)

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            canvas.width = 0
            canvas.height = 0
            if (!result) {
              reject(new Error('The browser could not encode the resized image.'))
            } else if (result.type !== outputFormat) {
              reject(new Error(`This browser could not create ${OUTPUT_FORMATS[outputFormat].label} output.`))
            } else {
              resolve(result)
            }
          },
          outputFormat,
          outputFormat === 'image/png' ? undefined : quality / 100,
        )
      })

      setResizedBlob(blob)
      setStatus({
        type: 'success',
        message: `Image resized to ${outputWidth} × ${outputHeight} pixels.`,
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not resize this image: ${error.message}`
          : 'Could not resize this image. Try smaller dimensions or a different format.',
      })
    } finally {
      setIsResizing(false)
    }
  }

  const reset = () => {
    if (isResizing) return
    setImageFile(null)
    setResizedBlob(null)
    setDimensions(null)
    setWidth('')
    setHeight('')
    setMaintainAspectRatio(true)
    setOutputFormat('image/jpeg')
    setQuality(90)
    setSelectedPreset('')
    setIsLoading(false)
    setStatus(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canResize = Boolean(imageFile && dimensions && sourceUrl && !isLoading && !isResizing)

  return (
    <>
      <PageMetadata
        title="Image Resizer - Resize JPG, PNG, and WebP Images"
        description="Resize JPG, PNG, and WebP images online in your browser. Set custom dimensions, keep the aspect ratio, choose an output format, and download locally."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            Image Resizer
          </h1>
        </header>

        <section aria-label="Image resizer" className="mx-auto max-w-4xl space-y-5">
          <section aria-labelledby="image-upload-heading" className="tool-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <ImagePlus aria-hidden="true" size={20} />
                </span>
                <div>
                  <h2 id="image-upload-heading" className="font-semibold text-slate-950">
                    Choose an image
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select or drop one JPG, PNG, or WebP image, up to 20 MB.
                  </p>
                </div>
              </div>
              {(imageFile || isLoading) && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={isResizing}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw aria-hidden="true" size={15} />
                  Remove image
                </button>
              )}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault()
                if (!isResizing) setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`tool-dropzone mt-5 p-5 text-center sm:p-7 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : ''
              } ${isResizing ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleFileInput}
                disabled={isResizing}
                className="sr-only"
                aria-label="Select an image file"
              />
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Upload aria-hidden="true" size={23} />
              </span>
              <p className="mt-3 text-base font-semibold text-slate-900">
                Drag and drop your image here
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isResizing}
                className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image aria-hidden="true" size={17} />
                Select image
              </button>
              <p className="mt-2 text-xs text-slate-500">
                JPG, JPEG, PNG, WebP · Up to {formatFileSize(MAX_IMAGE_SIZE_BYTES)}
              </p>
            </div>

            {imageFile && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-800" title={imageFile.name}>
                  {imageFile.name}
                </span>
                <span className="shrink-0 text-slate-500">
                  {dimensions
                    ? `${dimensions.width} × ${dimensions.height} px · `
                    : isLoading ? 'Reading dimensions · ' : ''}
                  {formatFileSize(imageFile.size)}
                </span>
              </div>
            )}
          </section>

          <StatusMessage status={status} />

          {imageFile && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section aria-labelledby="resize-settings-heading" className="tool-surface-raised p-4 sm:p-6">
                <h2 id="resize-settings-heading" className="font-semibold text-slate-950">
                  Resize settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Original: {dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Reading image…'}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="resize-width" className="block text-sm font-medium text-slate-800">
                      Width (px)
                    </label>
                    <input
                      id="resize-width"
                      type="number"
                      min="1"
                      max={MAX_OUTPUT_DIMENSION}
                      step="1"
                      value={width}
                      onChange={handleWidthChange}
                      disabled={!dimensions || isResizing}
                      className="tool-field mt-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="resize-height" className="block text-sm font-medium text-slate-800">
                      Height (px)
                    </label>
                    <input
                      id="resize-height"
                      type="number"
                      min="1"
                      max={MAX_OUTPUT_DIMENSION}
                      step="1"
                      value={height}
                      onChange={handleHeightChange}
                      disabled={!dimensions || isResizing}
                      className="tool-field mt-2"
                    />
                  </div>
                </div>

                <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={maintainAspectRatio}
                    onChange={toggleAspectRatio}
                    disabled={!dimensions || isResizing}
                    className="size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  />
                  Maintain aspect ratio
                </label>

                <div className="mt-5">
                  <label htmlFor="dimension-preset" className="block text-sm font-medium text-slate-800">
                    Preset dimensions
                  </label>
                  <select
                    id="dimension-preset"
                    value={selectedPreset}
                    onChange={applyPreset}
                    disabled={!dimensions || isResizing}
                    className="tool-field mt-2"
                  >
                    <option value="">Choose a preset</option>
                    {DIMENSION_PRESETS.map((preset, index) => (
                      <option key={preset.label} value={index}>
                        {preset.label} ({preset.width} × {preset.height})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    With aspect ratio locked, presets fit the image within these maximum dimensions.
                  </p>
                </div>

                <div className="mt-5">
                  <label htmlFor="resize-format" className="block text-sm font-medium text-slate-800">
                    Output format
                  </label>
                  <select
                    id="resize-format"
                    value={outputFormat}
                    onChange={changeOutputFormat}
                    disabled={isResizing}
                    className="tool-field mt-2"
                  >
                    {Object.entries(OUTPUT_FORMATS).map(([type, format]) => (
                      <option key={type} value={type}>{format.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="resize-quality" className="text-sm font-medium text-slate-800">
                      Output quality
                    </label>
                    {outputFormat !== 'image/png' && (
                      <output htmlFor="resize-quality" className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                        {quality}%
                      </output>
                    )}
                  </div>
                  {outputFormat === 'image/png' ? (
                    <p className="mt-2 text-sm text-slate-500">
                      PNG is lossless; a quality setting does not apply.
                    </p>
                  ) : (
                    <>
                      <input
                        id="resize-quality"
                        type="range"
                        min="10"
                        max="100"
                        step="5"
                        value={quality}
                        onChange={(event) => {
                          setQuality(Number(event.target.value))
                          clearResizedImage()
                        }}
                        disabled={isResizing}
                        className="mt-4 h-2 w-full cursor-pointer accent-indigo-600 disabled:opacity-50"
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Smaller file</span>
                        <span>Higher quality</span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={resizeImage}
                  disabled={!canResize}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResizing
                    ? <><LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> Resizing image…</>
                    : <><Image aria-hidden="true" size={17} /> Resize image</>}
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Output is limited to {MAX_OUTPUT_PIXELS / 1_000_000} megapixels and
                  {' '}{MAX_OUTPUT_DIMENSION.toLocaleString()} pixels per side to protect browser memory.
                </p>
              </section>

              <section aria-labelledby="image-preview-heading" className="tool-surface p-4 sm:p-6">
                <h2 id="image-preview-heading" className="font-semibold text-slate-950">
                  Image preview
                </h2>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Original</h3>
                    <span className="text-xs text-slate-500">
                      {dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Loading…'}
                    </span>
                  </div>
                  {sourceUrl && (
                    <img
                      src={sourceUrl}
                      alt={`Original ${imageFile.name}`}
                      className="mx-auto mt-3 max-h-80 max-w-full rounded-md bg-white object-contain"
                    />
                  )}
                  <p className="mt-2 text-xs text-slate-500">{formatFileSize(imageFile.size)}</p>
                </div>

                <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Resized image</h3>
                    <span className="text-xs text-slate-500">
                      {resizedBlob ? `${width} × ${height} px` : 'Preview appears after resizing'}
                    </span>
                  </div>
                  {resizedBlob && resizedUrl ? (
                    <>
                      <img
                        src={resizedUrl}
                        alt={`Resized image at ${width} by ${height} pixels`}
                        className="mx-auto mt-3 max-h-80 max-w-full rounded-md bg-white object-contain"
                      />
                      <p className="mt-2 text-xs text-slate-500">{formatFileSize(resizedBlob.size)}</p>
                    </>
                  ) : (
                    <div className="mt-3 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-indigo-200 bg-white/80 text-center text-sm text-slate-500">
                      The resized preview will appear here.
                    </div>
                  )}
                </div>

                {resizedBlob && resizedUrl && (
                  <a
                    href={resizedUrl}
                    download={getResizedFilename(imageFile.name, OUTPUT_FORMATS[outputFormat].extension)}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition duration-200 hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    <Download aria-hidden="true" size={17} />
                    Download resized image
                  </a>
                )}
              </section>
            </div>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="about-image-resizing">
            <h2 id="about-image-resizing" className="text-2xl font-bold tracking-tight text-slate-950">
              Resize images to the dimensions you need
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Choose a JPG, PNG, or WebP image, enter its target width and height, and preview the resized result before downloading. The aspect-ratio lock is on by default so changing one dimension updates the other proportionally. Presets fit an image within common size bounds when the ratio is locked; unlocking it lets you enter both dimensions independently.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Canvas resizing happens in your browser. JPG and WebP use the selected output quality; PNG is lossless and does not use a quality slider. JPG output fills transparent areas with white. To protect available memory, input files are limited to 20 MB and output dimensions are capped.
            </p>
          </section>

          <section aria-labelledby="image-resizer-faq">
            <h2 id="image-resizer-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I resize an image?', 'Choose or drop a JPG, PNG, or WebP file, set the width and height or choose a preset, select an output format, then choose Resize image and download the result.'],
                ['Does the resizer keep the image proportions?', 'Yes. Maintain aspect ratio is enabled by default. Change either dimension and the other updates proportionally. Turn the option off to enter width and height independently.'],
                ['What do the size presets do?', 'Presets use common image dimensions. With the aspect ratio locked, the image is scaled to fit within the selected width and height without distortion. When unlocked, the exact preset dimensions are applied.'],
                ['Which output formats are available?', 'You can create JPG, PNG, or WebP output. PNG preserves transparency; JPG output uses a white background for transparent areas.'],
                ['Does image quality work for PNG?', 'No. PNG is lossless, so the quality control is available only for JPG and WebP.'],
                ['Are my images uploaded?', 'No. The image is loaded and resized in your browser. QuickTools does not send it to an image-processing server.'],
                ['Why are there size limits?', 'Large images can use substantial browser memory. The resizer limits input file size, source pixel dimensions, and output canvas size to reduce the risk of a browser running out of memory.'],
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
