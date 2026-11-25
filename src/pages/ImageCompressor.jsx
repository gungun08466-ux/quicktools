import imageCompression from 'browser-image-compression'
import imageCompressionWorkerUrl from 'browser-image-compression/dist/browser-image-compression.js?url'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import {
  formatFileSize,
  getCompressedFilename,
  getImageFormat,
  MAX_IMAGE_SIZE_BYTES,
  validateImageFile,
} from '../utils/imageValidation.js'

const qualityOptions = {
  min: 10,
  max: 100,
  initial: 80,
}

function ImagePreview({ src, alt, className = '' }) {
  return (
    <div className={`flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-3 ${className}`}>
      <img src={src} alt={alt} className="max-h-80 max-w-full object-contain" />
    </div>
  )
}

function FileDetails({ file, dimensions }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt className="text-slate-500">File size</dt>
        <dd className="mt-1 font-medium text-slate-900">{formatFileSize(file.size)}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Dimensions</dt>
        <dd className="mt-1 font-medium text-slate-900">
          {dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Reading image…'}
        </dd>
      </div>
    </dl>
  )
}

export default function ImageCompressor() {
  const fileInputRef = useRef(null)
  const compressionInProgressRef = useRef(false)
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [compressedFile, setCompressedFile] = useState(null)
  const [compressedUrl, setCompressedUrl] = useState('')
  const [quality, setQuality] = useState(qualityOptions.initial)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [downloadMessage, setDownloadMessage] = useState('')

  useEffect(() => {
    if (!imageFile) {
      setImageUrl('')
      setDimensions(null)
      return undefined
    }

    const url = URL.createObjectURL(imageFile)
    let active = true
    setImageUrl(url)
    setDimensions(null)

    const image = new Image()
    image.onload = () => {
      if (active) setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      if (active) {
        setError('This image could not be opened. Try a valid JPG, PNG, or WebP image.')
        setImageFile(null)
      }
    }
    image.src = url

    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [imageFile])

  useEffect(() => {
    if (!compressedFile) {
      setCompressedUrl('')
      return undefined
    }

    const url = URL.createObjectURL(compressedFile)
    setCompressedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [compressedFile])

  const chooseImage = (file) => {
    if (isCompressing) return

    setError('')
    setNotice('')
    setDownloadMessage('')
    const validationError = validateImageFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setCompressedFile(null)
    setProgress(0)
    setImageFile(file)
  }

  const handleFileInput = (event) => {
    chooseImage(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    chooseImage(event.dataTransfer.files?.[0])
  }

  const compressImage = async () => {
    if (!imageFile || compressionInProgressRef.current) return

    compressionInProgressRef.current = true
    setIsCompressing(true)
    setProgress(0)
    setError('')
    setNotice('')
    setDownloadMessage('')

    try {
      const format = getImageFormat(imageFile)
      const result = await imageCompression(imageFile, {
        maxSizeMB: Number.POSITIVE_INFINITY,
        initialQuality: quality / 100,
        alwaysKeepResolution: true,
        fileType: format.mimeType,
        useWebWorker: true,
        libURL: imageCompressionWorkerUrl,
        onProgress: (nextProgress) => setProgress(Math.round(nextProgress)),
      })

      setCompressedFile(result)
      setProgress(100)
      if (result.size < imageFile.size) {
        setNotice('Compression complete. Your image is ready to download.')
      } else {
        setNotice('Compression complete, but this image did not get smaller at the selected quality.')
      }
    } catch (compressionError) {
      setError(
        compressionError instanceof Error
          ? `Compression failed: ${compressionError.message}`
          : 'Compression failed. Try another image or a different quality setting.',
      )
    } finally {
      compressionInProgressRef.current = false
      setIsCompressing(false)
    }
  }

  const reset = () => {
    if (isCompressing) return
    setImageFile(null)
    setCompressedFile(null)
    setDimensions(null)
    setQuality(qualityOptions.initial)
    setProgress(0)
    setError('')
    setNotice('')
    setDownloadMessage('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadImage = () => {
    if (!compressedFile || !imageFile) return

    let downloadUrl
    try {
      const format = getImageFormat(imageFile)
      downloadUrl = URL.createObjectURL(compressedFile)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = getCompressedFilename(imageFile.name, format.extension)
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

  const savedBytes = compressedFile && imageFile
    ? Math.max(0, imageFile.size - compressedFile.size)
    : 0
  const reduction = imageFile?.size && compressedFile
    ? Math.max(0, Math.round((savedBytes / imageFile.size) * 100))
    : 0
  const outputGrew = Boolean(compressedFile && imageFile && compressedFile.size > imageFile.size)

  return (
    <>
      <PageMetadata
        title="Image Compressor"
        description="Compress JPG, PNG, and WebP images locally in your browser. Adjust quality, compare results, and download without uploading your files."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            Image Compressor
          </h1>
        </header>

        {error && (
          <div role="alert" className="mx-auto mt-5 flex max-w-3xl items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && compressedFile && (
          <div role="status" className={`mx-auto mt-5 flex max-w-3xl items-start gap-3 rounded-xl border px-4 py-3 text-sm ${outputGrew ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            {outputGrew
              ? <AlertCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
              : <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 shrink-0" />}
            <p>{notice}</p>
          </div>
        )}

        {!imageFile ? (
          <section aria-labelledby="upload-heading" className="mx-auto mt-4 max-w-3xl">
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false)
              }}
              onDrop={handleDrop}
              className={`tool-dropzone p-6 text-center sm:p-10 ${isDragging ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100' : ''}`}
            >
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <ImagePlus aria-hidden="true" size={27} />
              </span>
              <h2 id="upload-heading" className="mt-5 text-xl font-bold tracking-tight text-slate-950">
                Choose an image to compress
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Drag and drop an image here, or browse files from your device.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Select an image file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="tool-primary-button mt-6 px-5"
              >
                <Upload aria-hidden="true" size={17} />
                Select image
              </button>
              <p className="mt-5 text-xs text-slate-500">
                Supported: JPG, JPEG, PNG, WebP <span aria-hidden="true">·</span> Maximum file size: 20 MB
              </p>
            </div>
          </section>
        ) : (
          <section aria-label="Image compression workspace" className="mx-auto mt-4 max-w-5xl">
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="tool-surface min-w-0 p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">Original image</p>
                    <p className="mt-1 truncate text-sm text-slate-500" title={imageFile.name}>
                      {imageFile.name}
                    </p>
                  </div>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <FileImage aria-hidden="true" size={18} />
                  </span>
                </div>
                <div className="mt-4">
                  <ImagePreview src={imageUrl} alt={`Original ${imageFile.name}`} />
                </div>
                <FileDetails file={imageFile} dimensions={dimensions} />
              </article>

              {compressedFile ? (
                <article className="tool-surface-raised min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">Compressed image</p>
                      <p className="mt-1 truncate text-sm text-slate-500" title={getCompressedFilename(imageFile.name, getImageFormat(imageFile).extension)}>
                        {getCompressedFilename(imageFile.name, getImageFormat(imageFile).extension)}
                      </p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <CheckCircle2 aria-hidden="true" size={18} />
                    </span>
                  </div>
                  <div className="mt-4">
                    <ImagePreview src={compressedUrl} alt={`Compressed ${imageFile.name}`} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">New file size</dt>
                      <dd className="mt-1 font-medium text-slate-900">{formatFileSize(compressedFile.size)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">{outputGrew ? 'Size change' : 'Size reduction'}</dt>
                      <dd className="mt-1 font-medium text-slate-900">
                        {outputGrew
                          ? `No reduction (${formatFileSize(compressedFile.size - imageFile.size)} larger)`
                          : `${formatFileSize(savedBytes)} (${reduction}%)`}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={downloadImage}
                    className="tool-primary-button mt-5 w-full"
                  >
                    <Download aria-hidden="true" size={17} />
                    Download compressed image
                  </button>
                  {downloadMessage && <p role="status" className="mt-2 text-center text-sm text-slate-600">{downloadMessage}</p>}
                </article>
              ) : (
                <article className="tool-surface-raised p-5 sm:p-6">
                  <h2 className="text-lg font-bold tracking-tight text-slate-950">Compression settings</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Choose an image quality target. Results vary by format and image content.
                  </p>

                  <div className="mt-7">
                    <div className="flex items-center justify-between">
                      <label htmlFor="quality" className="text-sm font-medium text-slate-800">
                        Image quality
                      </label>
                      <output htmlFor="quality" className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                        {quality}%
                      </output>
                    </div>
                    <input
                      id="quality"
                      type="range"
                      min={qualityOptions.min}
                      max={qualityOptions.max}
                      step="5"
                      value={quality}
                      onChange={(event) => setQuality(Number(event.target.value))}
                      className="mt-4 h-2 w-full cursor-pointer accent-indigo-600"
                      aria-describedby="quality-help"
                    />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Smaller file</span>
                      <span>Higher quality</span>
                    </div>
                    <p id="quality-help" className="mt-3 text-xs leading-5 text-slate-500">
                      PNG quality behavior depends on browser encoding and may not follow the slider like JPG or WebP.
                    </p>
                  </div>

                  {isCompressing && (
                    <div className="mt-6" role="status" aria-live="polite">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span className="inline-flex items-center gap-2">
                          <LoaderCircle aria-hidden="true" size={16} className="animate-spin text-indigo-600" />
                          Compressing locally…
                        </span>
                        <span>{progress}%</span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label="Compression progress"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={progress}
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                      >
                        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={compressImage}
                    disabled={isCompressing || !dimensions}
                    className="tool-primary-button mt-7 w-full"
                  >
                    {isCompressing
                      ? <><LoaderCircle aria-hidden="true" size={17} className="animate-spin" /> Compressing image…</>
                      : <><FileImage aria-hidden="true" size={17} /> Compress image</>}
                  </button>
                </article>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Quality settings can affect formats differently. Your original dimensions and image format are preserved.
              </p>
              <button
                type="button"
                onClick={reset}
                disabled={isCompressing}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCompressing
                  ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" />
                  : <><RefreshCw aria-hidden="true" size={16} /> Remove image</>}
              </button>
            </div>
          </section>
        )}

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">
          Files up to {formatFileSize(MAX_IMAGE_SIZE_BYTES)} are supported. JPEG and WebP quality controls are approximate;
          PNG output behavior depends on browser support. No image data is sent to a server.
        </p>

        <div className="mx-auto mt-16 max-w-4xl space-y-12 sm:mt-20">
          <section aria-labelledby="how-to-compress">
            <h2 id="how-to-compress" className="text-2xl font-bold tracking-tight text-slate-950">
              How to Compress an Image
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Select an image', 'Choose a JPG, PNG, or WebP file, or drag and drop it into the upload area.'],
                ['Adjust the quality', 'Move the quality slider toward a smaller file or higher visual quality.'],
                ['Compress the image', 'Select Compress image and wait while your browser processes the file.'],
                ['Review and download', 'Compare the original and compressed sizes, then download the result if it suits your needs.'],
              ].map(([title, description], index) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                      {index + 1}
                    </span>
                    <h3 className="font-semibold text-slate-950">{title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="supported-formats">
            <h2 id="supported-formats" className="text-2xl font-bold tracking-tight text-slate-950">
              Supported Image Formats
            </h2>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="leading-7 text-slate-600">
                Upload JPG or JPEG, PNG, and WebP images up to 20 MB each. The
                compressor keeps the original format and image dimensions. The
                amount of size reduction depends on the format, image content,
                and quality setting; some images may change very little.
              </p>
            </div>
          </section>

          <section aria-labelledby="why-compress">
            <h2 id="why-compress" className="text-2xl font-bold tracking-tight text-slate-950">
              Why Compress Images?
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Smaller image files can take less storage and may be quicker to
              transfer, which can help a website load faster when you use
              optimized images. They can also be easier to share or upload when
              a service has file-size limits. Actual results depend on the image
              and where you use it.
            </p>
          </section>

          <section aria-labelledby="image-quality">
            <h2 id="image-quality" className="text-2xl font-bold tracking-tight text-slate-950">
              How Does Image Quality Work?
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              The quality slider sets a target for the encoder: moving toward
              smaller files can reduce visual detail, while moving toward higher
              quality may preserve more detail but produce a larger file. Check
              the preview and file size to choose a result that works for you.
              JPEG and WebP respond approximately to the setting. PNG compression
              may not respond to the slider in the same way, because browser
              support and image content affect its output.
            </p>
          </section>

          <section aria-labelledby="image-limitations">
            <h2 id="image-limitations" className="text-2xl font-bold tracking-tight text-slate-950">
              Important Limitations
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-600">
              <li>Compression does not always make a file smaller; some images may produce a larger result.</li>
              <li>Very large or complex images may be limited by your device’s available browser memory and image-processing capabilities.</li>
              <li>Processing happens locally in your browser. The image is not uploaded to a QuickTools server.</li>
            </ul>
          </section>

          <section aria-labelledby="image-faq">
            <h2 id="image-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Is this image compressor free?', 'Yes. You can use the tool without an account or payment.'],
                ['Are my images uploaded to a server?', 'No. The selected image is processed in your browser and is not uploaded to a QuickTools processing server.'],
                ['Which image formats are supported?', 'The compressor accepts JPG/JPEG, PNG, and WebP images. The output keeps the original format.'],
                ['What is the maximum file size?', `Each image can be up to ${formatFileSize(MAX_IMAGE_SIZE_BYTES)}.`],
                ['Does compression reduce image quality?', 'It can. Lower quality settings may reduce visual detail, so review the preview before downloading. The quality setting behaves differently for PNG than for JPEG or WebP.'],
                ['Why is my compressed image sometimes larger?', 'Some images are already efficiently encoded or do not compress well with the selected setting. In that case, the encoded result can be the same size or larger.'],
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
