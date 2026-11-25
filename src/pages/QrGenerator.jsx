import QRCode from 'qrcode'
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  QrCode,
  RotateCcw,
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
      <div className="mx-auto max-w-5xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            QR Code Generator
          </h1>
        </header>

        <section
          aria-labelledby="qr-content-heading"
          className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <div className="tool-surface p-4 sm:p-6">
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
              className="tool-field mt-5 min-h-36 resize-y p-4 leading-6"
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
                className="tool-field mt-2 sm:max-w-xs"
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
            className="tool-surface-raised flex flex-col p-4 sm:p-6"
          >
            <div>
              <h2 id="qr-preview-heading" className="font-semibold text-slate-950">
                QR code preview
              </h2>
              <p className="mt-1 text-sm text-slate-500">A quiet zone is included around the code.</p>
            </div>

            <div
              className="mt-4 flex min-h-64 flex-1 items-center justify-center rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50/70 p-4 shadow-inner sm:min-h-80"
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
                className="tool-primary-button disabled:opacity-50"
              >
                <Download aria-hidden="true" size={17} />
                Download PNG
              </button>
              <button
                type="button"
                onClick={copyPng}
                disabled={!qrDataUrl || isGenerating}
                className="tool-secondary-button disabled:opacity-50"
              >
                <Clipboard aria-hidden="true" size={17} />
                Copy image
              </button>
            </div>
          </section>
        </section>

        <div className="mx-auto mt-16 max-w-4xl space-y-12 sm:mt-20">
          <section aria-labelledby="what-is-qr">
            <h2 id="what-is-qr" className="text-2xl font-bold tracking-tight text-slate-950">
              What Is a QR Code?
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              A QR code is a square pattern that a phone or other scanner can
              read to access the information encoded in it. It can contain
              ordinary text or a website URL. People commonly use QR codes to
              share links, contact details written as text, or event
              information.
            </p>
          </section>

          <section aria-labelledby="how-to-generate-qr">
            <h2 id="how-to-generate-qr" className="text-2xl font-bold tracking-tight text-slate-950">
              How to Generate a QR Code
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Enter your content', 'Type or paste text or a URL into the content box. The input must not be empty.'],
                ['Choose colors', 'Use the foreground and background color pickers to customize the code. The colors must meet the tool’s contrast check.'],
                ['Choose an image size', 'Choose the 200, 300, or 500 px size setting. Long or complex content may produce an image larger than the selected size.'],
                ['Preview and save', 'Review the preview, then select Download PNG. If your browser supports image clipboard writing and grants access, you can also select Copy image.'],
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

          <section aria-labelledby="common-qr-uses">
            <h2 id="common-qr-uses" className="text-2xl font-bold tracking-tight text-slate-950">
              Common Uses of QR Codes
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              A QR code can share a website link, show a restaurant menu URL,
              point guests to event information or registration, or provide
              product details. You can also encode other text, such as contact
              information. This generator stores the text you enter; it does
              not create a special contact card or registration form.
            </p>
          </section>

          <section aria-labelledby="qr-size-color">
            <h2 id="qr-size-color" className="text-2xl font-bold tracking-tight text-slate-950">
              QR Code Size and Color
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Choose from the 200, 300, or 500 px size settings for the PNG.
              These are target widths rather than guaranteed final dimensions;
              long or complex content may result in a larger generated image.
              Each code includes a quiet zone around its edge. A clear
              difference between the foreground pattern and background helps
              scanners distinguish the code. This tool checks the selected
              colors and generates a code only when their calculated contrast
              ratio is at least 4.5:1. Passing that check does not guarantee
              every camera or print will scan it.
            </p>
          </section>

          <section aria-labelledby="qr-scannable-tips">
            <h2 id="qr-scannable-tips" className="text-2xl font-bold tracking-tight text-slate-950">
              Tips for Scannable QR Codes
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-600">
              <li>Check that the text or URL is correct before saving the code.</li>
              <li>Keep the foreground and background clearly distinct; the tool also requires at least a 4.5:1 contrast ratio.</li>
              <li>Do not cover the code or crop away its quiet zone.</li>
              <li>Test the downloaded PNG with a phone camera at the size and distance people will use it.</li>
            </ul>
          </section>

          <section aria-labelledby="qr-faq">
            <h2 id="qr-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Is this QR Code Generator free?', 'Yes. You can generate and download QR codes without an account or payment.'],
                ['What information can I put in a QR code?', 'You can enter text or a URL. For contact details, you can encode the information as text, but this tool does not create a structured contact card.'],
                ['Can I customize QR code colors?', 'Yes. Choose foreground and background colors. The tool requires a calculated contrast ratio of at least 4.5:1 before it generates the code.'],
                ['What image format can I download?', 'The download is a PNG image. Available size settings are 200, 300, and 500 px; the final image may be larger than the selected size for long or complex content.'],
                ['Can I copy the QR code image?', 'The Copy image button uses the browser Clipboard API. Image clipboard support and permissions vary by browser; if copying is unavailable, download the PNG instead.'],
                ['Why is my QR code not scanning?', 'Check that it is not cropped or covered, use distinct colors, and try scanning the downloaded image at its intended display size. Also confirm that the encoded text or URL is correct. The contrast check cannot guarantee every scanner will read every image.'],
                ['Does this QR code expire?', 'The generated code is static: its encoded content does not expire or change through this tool. If it contains a URL, whether that link continues to work depends on the website it points to. This tool does not provide link editing or scan tracking.'],
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
