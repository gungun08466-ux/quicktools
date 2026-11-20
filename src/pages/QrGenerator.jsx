import QRCode from 'qrcode'
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  QrCode,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const DEFAULT_FOREGROUND = '#000000'
const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_SIZE = 300
const QR_SIZES = [200, 300, 500]

function getContrastRatio(firstColor, secondColor) {
  const luminance = (color) => {
    const channels = color.match(/[a-f\d]{2}/gi).map((channel) => {
      const value = Number.parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
  }

  const firstLuminance = luminance(firstColor)
  const secondLuminance = luminance(secondColor)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function StatusMessage({ status }) {
  if (!status) return null

  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

export default function QrGenerator() {
  const [value, setValue] = useState('')
  const [foreground, setForeground] = useState(DEFAULT_FOREGROUND)
  const [background, setBackground] = useState(DEFAULT_BACKGROUND)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState(null)

  const hasSufficientContrast = getContrastRatio(foreground, background) >= 4.5

  useEffect(() => {
    let cancelled = false

    if (!value.trim()) {
      setQrDataUrl('')
      setIsGenerating(false)
      if (value) {
        setStatus({
          type: 'error',
          message: 'Enter some text or a URL; QR code content cannot be empty.',
        })
      }
      return () => {
        cancelled = true
      }
    }

    if (!hasSufficientContrast) {
      setQrDataUrl('')
      setIsGenerating(false)
      setStatus({
        type: 'error',
        message: 'Choose foreground and background colors with stronger contrast (at least 4.5:1).',
      })
      return () => {
        cancelled = true
      }
    }

    setIsGenerating(true)
    setStatus(null)

    QRCode.toDataURL(value, {
      width: size,
      margin: 4,
      errorCorrectionLevel: 'Q',
      color: { dark: foreground, light: background },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch((error) => {
        if (!cancelled) {
          setQrDataUrl('')
          setStatus({
            type: 'error',
            message: error instanceof Error
              ? `Could not generate this QR code: ${error.message}`
              : 'Could not generate this QR code. Try shorter text.',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false)
      })

    return () => {
      cancelled = true
    }
  }, [value, foreground, background, size, hasSufficientContrast])

  const downloadPng = () => {
    if (!qrDataUrl) return

    try {
      const link = document.createElement('a')
      link.href = qrDataUrl
      link.download = 'quicktools-qr-code.png'
      document.body.append(link)
      link.click()
      link.remove()
      setStatus({ type: 'success', message: 'QR code PNG download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not download the QR code: ${error.message}`
          : 'Could not download the QR code. Please try again.',
      })
    }
  }

  const copyPng = async () => {
    if (!qrDataUrl) return

    if (!navigator.clipboard?.write || typeof window.ClipboardItem !== 'function') {
      setStatus({
        type: 'error',
        message: 'Copying images is not supported in this browser or page context. Use Download PNG instead.',
      })
      return
    }

    try {
      const response = await fetch(qrDataUrl)
      const imageBlob = await response.blob()
      await navigator.clipboard.write([
        new window.ClipboardItem({ 'image/png': imageBlob }),
      ])
      setStatus({ type: 'success', message: 'QR code image copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the image. Check clipboard permissions or use Download PNG instead.',
      })
    }
  }

  const reset = () => {
    setValue('')
    setForeground(DEFAULT_FOREGROUND)
    setBackground(DEFAULT_BACKGROUND)
    setSize(DEFAULT_SIZE)
    setQrDataUrl('')
    setIsGenerating(false)
    setStatus(null)
  }

  return (
    <>
      <PageMetadata
        title="QR Code Generator"
        description="Create and download custom QR codes for text or URLs in your browser. Choose colors and size while your content stays on your device."
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
            <ShieldCheck aria-hidden="true" size={16} />
            Private, browser-based generation
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            QR Code Generator
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Create a QR code from text or a URL, customize its colors and size, and
            download it as a PNG. Everything is generated locally in your browser.
          </p>
        </header>

        <div className="mx-auto mt-8 max-w-4xl rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-start gap-2">
            <ShieldCheck aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-emerald-700" />
            <span>Your text and generated QR code stay on your device; nothing is uploaded.</span>
          </p>
        </div>

        <section
          aria-labelledby="qr-content-heading"
          className="mx-auto mt-6 grid max-w-4xl gap-5 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="qr-content-heading" className="font-semibold text-slate-950">
                  Your content
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter text or a complete URL to create your QR code.
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <RotateCcw aria-hidden="true" size={15} />
                Reset
              </button>
            </div>

            <label htmlFor="qr-content" className="sr-only">
              Text or URL for QR code
            </label>
            <textarea
              id="qr-content"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setStatus(null)
              }}
              placeholder="https://example.com or enter any text"
              spellCheck="false"
              className="mt-5 min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
            <p className="mt-2 text-xs text-slate-500">
              {value.trim()
                ? 'Your QR code updates as you type or change its settings.'
                : 'Enter some text or a URL. The content cannot be empty.'}
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="qr-foreground" className="block text-sm font-medium text-slate-800">
                  Foreground color
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="qr-foreground"
                    type="color"
                    value={foreground}
                    onChange={(event) => setForeground(event.target.value)}
                    className="size-11 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <span className="font-mono text-sm uppercase text-slate-600">{foreground}</span>
                </div>
              </div>
              <div>
                <label htmlFor="qr-background" className="block text-sm font-medium text-slate-800">
                  Background color
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="qr-background"
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    className="size-11 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <span className="font-mono text-sm uppercase text-slate-600">{background}</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="qr-size" className="block text-sm font-medium text-slate-800">
                Image size
              </label>
              <select
                id="qr-size"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 sm:max-w-xs"
              >
                {QR_SIZES.map((option) => (
                  <option key={option} value={option}>{option} × {option} px</option>
                ))}
              </select>
            </div>

            {status && <div className="mt-5"><StatusMessage status={status} /></div>}
          </div>

          <section
            aria-labelledby="qr-preview-heading"
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div>
              <h2 id="qr-preview-heading" className="font-semibold text-slate-950">
                QR code preview
              </h2>
              <p className="mt-1 text-sm text-slate-500">A quiet zone is included around the code.</p>
            </div>

            <div
              className="mt-4 flex min-h-64 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 sm:min-h-80"
              aria-live="polite"
              aria-busy={isGenerating}
            >
              {isGenerating ? (
                <div role="status" className="flex flex-col items-center gap-3 text-sm text-slate-600">
                  <QrCode aria-hidden="true" size={28} className="animate-pulse text-indigo-600" />
                  Generating QR code…
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Generated QR code"
                  className="h-auto max-h-72 w-auto max-w-full rounded-lg"
                  style={{ backgroundColor: background }}
                />
              ) : (
                <div className="flex max-w-xs flex-col items-center text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <QrCode aria-hidden="true" size={30} />
                  </span>
                  <p className="mt-4 font-medium text-slate-700">Your QR code will appear here</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Enter text or a URL to generate a downloadable code.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={downloadPng}
                disabled={!qrDataUrl || isGenerating}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download aria-hidden="true" size={17} />
                Download PNG
              </button>
              <button
                type="button"
                onClick={copyPng}
                disabled={!qrDataUrl || isGenerating}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clipboard aria-hidden="true" size={17} />
                Copy image
              </button>
            </div>
          </section>
        </section>
      </div>
    </>
  )
}
