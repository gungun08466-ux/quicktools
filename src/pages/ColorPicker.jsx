import { useEffect, useMemo, useState } from 'react'
import { ClipboardCopy, Download, Palette, RotateCcw, Shuffle, Trash2 } from 'lucide-react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const DEFAULT_HEX = '#6366f1'
const RECENT_LIMIT = 8
const RECENT_COLORS_STORAGE_KEY = 'quicktools-color-picker-recents'
const PALETTE_MODES = [
  { id: 'complementary', label: 'Complementary' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'monochromatic', label: 'Monochromatic' },
]

function hexToRgb(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.exec(value.trim())
  if (!match) return null

  const digits = match[1].length === 3
    ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
    : match[1]

  return {
    r: Number.parseInt(digits.slice(0, 2), 16),
    g: Number.parseInt(digits.slice(2, 4), 16),
    b: Number.parseInt(digits.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  let saturation = 0
  const lightness = (max + min) / 2

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1))
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6
        break
      case green:
        hue = (blue - red) / delta + 2
        break
      default:
        hue = (red - green) / delta + 4
    }
    hue *= 60
    if (hue < 0) hue += 360
  }

  return {
    h: Math.round(hue) % 360,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360
  const saturation = s / 100
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const section = hue / 60
  const secondary = chroma * (1 - Math.abs((section % 2) - 1))
  const match = lightness - chroma / 2
  let channels

  if (section < 1) channels = [chroma, secondary, 0]
  else if (section < 2) channels = [secondary, chroma, 0]
  else if (section < 3) channels = [0, chroma, secondary]
  else if (section < 4) channels = [0, secondary, chroma]
  else if (section < 5) channels = [secondary, 0, chroma]
  else channels = [chroma, 0, secondary]

  const [r, g, b] = channels.map((channel) => Math.round((channel + match) * 255))
  return { r, g, b }
}

function rgbInputToColor(value) {
  const source = value.trim().replace(/^rgb\(\s*/iu, '').replace(/\s*\)$/u, '')
  const match = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/u.exec(source)
  if (!match) return null
  const [r, g, b] = match.slice(1).map(Number)
  if ([r, g, b].some((channel) => channel > 255)) return null
  return { r, g, b }
}

function hslInputToColor(value) {
  const source = value.trim().replace(/^hsl\(\s*/iu, '').replace(/\s*\)$/u, '')
  const match = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(?:deg)?\s*,\s*((?:\d+(?:\.\d*)?|\.\d+))%\s*,\s*((?:\d+(?:\.\d*)?|\.\d+))%$/iu.exec(source)
  if (!match) return null
  const hue = Number(match[1])
  const s = Number(match[2])
  const l = Number(match[3])
  if (s < 0 || s > 100 || l < 0 || l > 100) return null
  return hslToRgb(hue, s, l)
}

function formatColor(color) {
  const { h, s, l } = rgbToHsl(color)
  return {
    hex: rgbToHex(color),
    rgb: `rgb(${color.r}, ${color.g}, ${color.b})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
  }
}

function parseColor(format, value) {
  if (format === 'hex') return hexToRgb(value)
  if (format === 'rgb') return rgbInputToColor(value)
  return hslInputToColor(value)
}

function makePalette(color, mode) {
  const { h, s, l } = rgbToHsl(color)
  const colorAt = (hue, saturation = s, lightness = l) =>
    hslToRgb(hue, saturation, lightness)

  if (mode === 'complementary') {
    return [color, colorAt(h + 180)]
  }
  if (mode === 'analogous') {
    return [-30, -15, 0, 15, 30].map((offset) => offset === 0 ? color : colorAt(h + offset))
  }
  if (mode === 'triadic') {
    return [color, colorAt(h + 120), colorAt(h + 240)]
  }
  return [15, 30, 45, 60, 75].map((lightness) => colorAt(h, s, lightness))
}

function relativeLuminance(color) {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function readRecentColors() {
  try {
    const saved = window.sessionStorage.getItem(RECENT_COLORS_STORAGE_KEY)
    if (!saved) return []
    const colors = JSON.parse(saved)
    if (!Array.isArray(colors)) return []
    return colors
      .filter((value) => typeof value === 'string' && hexToRgb(value))
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'
  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      {status.message}
    </p>
  )
}

export default function ColorPicker() {
  const initialColor = hexToRgb(DEFAULT_HEX)
  const [color, setColor] = useState(initialColor)
  const [values, setValues] = useState(() => formatColor(initialColor))
  const [inputErrors, setInputErrors] = useState({})
  const [recentColors, setRecentColors] = useState(readRecentColors)
  const [recentStorageError, setRecentStorageError] = useState('')
  const [paletteMode, setPaletteMode] = useState('complementary')
  const [status, setStatus] = useState(null)
  const [contrastColors, setContrastColors] = useState({
    foreground: '#111827',
    background: '#ffffff',
  })
  const [contrastInputs, setContrastInputs] = useState({
    foreground: '#111827',
    background: '#ffffff',
  })
  const [contrastErrors, setContrastErrors] = useState({})
  const palette = useMemo(() => makePalette(color, paletteMode), [color, paletteMode])
  const currentHex = rgbToHex(color)
  const ratio = contrastRatio(
    hexToRgb(contrastColors.foreground),
    hexToRgb(contrastColors.background),
  )

  useEffect(() => {
    try {
      window.sessionStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(recentColors))
      setRecentStorageError('')
    } catch {
      setRecentStorageError('Recent colors cannot be saved for this browser session; they remain available while this page is open.')
    }
  }, [recentColors])

  const applyColor = (nextColor, sourceFormat = null, sourceValue = '') => {
    if (!nextColor) return
    const nextValues = formatColor(nextColor)
    setColor(nextColor)
    setValues(sourceFormat ? { ...nextValues, [sourceFormat]: sourceValue } : nextValues)
    setInputErrors({})
    setStatus(null)
    setRecentColors((previous) => [
      nextValues.hex,
      ...previous.filter((recent) => recent !== nextValues.hex),
    ].slice(0, RECENT_LIMIT))
  }

  const updateValue = (format, value) => {
    const nextValues = { ...values, [format]: value }
    setValues(nextValues)
    const nextColor = parseColor(format, value)
    if (!nextColor) {
      const guidance = {
        hex: 'Enter a 3- or 6-digit HEX value, such as #6366f1.',
        rgb: 'Enter three RGB channels from 0 to 255, such as 99, 102, 241.',
        hsl: 'Enter hue, saturation, and lightness, such as 239, 84%, 67%.',
      }
      setInputErrors((previous) => ({ ...previous, [format]: guidance[format] }))
      return
    }
    applyColor(nextColor, format, value)
  }

  const copyValue = async (label, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setStatus({ type: 'success', message: `${label} value copied to the clipboard.` })
    } catch {
      setStatus({
        type: 'error',
        message: `Could not copy the ${label} value. Check clipboard permissions and try again.`,
      })
    }
  }

  const paletteRecords = palette.map((swatch, index) => {
    const formatted = formatColor(swatch)
    return { name: `Color ${index + 1}`, color: swatch, ...formatted }
  })

  const copyCss = () => {
    const css = `:root {\n${paletteRecords
      .map(({ name, hex }) => `  --palette-${name.toLowerCase().replace(' ', '-')}: ${hex};`)
      .join('\n')}\n}`
    copyValue('CSS variables', css)
  }

  const downloadJson = () => {
    const json = JSON.stringify(paletteRecords.map(({ name, hex, rgb, hsl }) => ({ name, hex, rgb, hsl })), null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'quicktools-color-palette.json'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setStatus({ type: 'success', message: 'Palette JSON downloaded.' })
  }

  const updateContrastColor = (key, value) => {
    setContrastInputs((previous) => ({ ...previous, [key]: value }))
    const nextColor = hexToRgb(value)
    if (!nextColor) {
      setContrastErrors((previous) => ({
        ...previous,
        [key]: 'Enter a valid 3- or 6-digit HEX color.',
      }))
      return
    }
    const hex = rgbToHex(nextColor)
    setContrastColors((previous) => ({ ...previous, [key]: hex }))
    setContrastInputs((previous) => ({ ...previous, [key]: hex }))
    setContrastErrors((previous) => ({ ...previous, [key]: '' }))
  }

  const reset = () => {
    const resetColor = hexToRgb(DEFAULT_HEX)
    setColor(resetColor)
    setValues(formatColor(resetColor))
    setInputErrors({})
    setRecentColors([])
    setPaletteMode('complementary')
    setStatus(null)
    setContrastColors({ foreground: '#111827', background: '#ffffff' })
    setContrastInputs({ foreground: '#111827', background: '#ffffff' })
    setContrastErrors({})
  }

  const randomize = () => {
    const bytes = new Uint8Array(3)
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes)
    } else {
      bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256) })
    }
    applyColor({ r: bytes[0], g: bytes[1], b: bytes[2] })
  }

  const contrastChecks = [
    { label: 'AA · normal text', threshold: 4.5 },
    { label: 'AA · large text', threshold: 3 },
    { label: 'AAA · normal text', threshold: 7 },
    { label: 'AAA · large text', threshold: 4.5 },
  ]

  return (
    <>
      <PageMetadata
        title="Color Picker & Palette Generator - HEX, RGB, HSL & Contrast"
        description="Pick colors, convert HEX, RGB, and HSL values, generate harmonious palettes, and check WCAG contrast ratios. Copy CSS variables or download palette JSON, all in your browser."
      />
      <div className="mx-auto max-w-5xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Color Picker &amp; Palette Generator</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Choose a color, create harmonious palettes, and check text contrast. All color calculations happen in your browser.
          </p>
        </header>

        <section aria-label="Color picker and palette generator" className="space-y-5">
          <div className="tool-surface-raised p-4 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <section aria-labelledby="color-selection-heading">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="color-selection-heading" className="text-lg font-semibold text-slate-950">
                    Choose a color
                  </h2>
                  <button type="button" onClick={randomize} className="tool-secondary-button">
                    <Shuffle aria-hidden="true" size={16} />
                    Random color
                  </button>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div
                    className="h-36 sm:h-44"
                    style={{ backgroundColor: currentHex }}
                    role="img"
                    aria-label={`Color preview ${currentHex}`}
                  />
                  <div className="flex items-center justify-between gap-3 bg-white p-3">
                    <div>
                      <p className="text-sm text-slate-500">Selected color</p>
                      <p className="font-mono text-lg font-semibold uppercase text-slate-950">{currentHex}</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600">
                      <Palette aria-hidden="true" size={17} />
                      <span>Pick color</span>
                      <input
                        type="color"
                        aria-label="Choose a color visually"
                        value={currentHex}
                        onChange={(event) => applyColor(hexToRgb(event.target.value))}
                        className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { key: 'hex', label: 'HEX', placeholder: '#6366f1' },
                    { key: 'rgb', label: 'RGB', placeholder: '99, 102, 241' },
                    { key: 'hsl', label: 'HSL', placeholder: '239, 84%, 67%' },
                  ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor={`color-${key}`} className="text-sm font-semibold text-slate-700">
                          {label}
                        </label>
                        <button
                          type="button"
                          aria-label={`Copy ${label} value`}
                          title={`Copy ${label} value`}
                          onClick={() => copyValue(label, values[key])}
                          disabled={Boolean(inputErrors[key])}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ClipboardCopy aria-hidden="true" size={16} />
                        </button>
                      </div>
                      <input
                        id={`color-${key}`}
                        type="text"
                        autoComplete="off"
                        spellCheck="false"
                        value={values[key]}
                        onChange={(event) => updateValue(key, event.target.value)}
                        onBlur={() => setValues((previous) => ({
                          ...previous,
                          [key]: formatColor(color)[key],
                        }))}
                        aria-invalid={Boolean(inputErrors[key])}
                        aria-describedby={inputErrors[key] ? `color-${key}-error` : undefined}
                        placeholder={placeholder}
                        className="tool-editor mt-1 w-full px-3 py-2 font-mono text-sm"
                      />
                      {inputErrors[key] && (
                        <p id={`color-${key}-error`} role="alert" className="mt-1 text-sm text-red-700">
                          {inputErrors[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <StatusMessage status={status} />
                {recentStorageError && <p role="status" className="mt-3 text-sm text-amber-800">{recentStorageError}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={reset} className="tool-secondary-button">
                    <RotateCcw aria-hidden="true" size={16} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentColors([])}
                    disabled={recentColors.length === 0}
                    className="tool-secondary-button disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                    Clear recent
                  </button>
                </div>
              </section>

              <section aria-labelledby="palette-heading">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 id="palette-heading" className="text-lg font-semibold text-slate-950">Color palette</h2>
                    <p className="mt-1 text-sm text-slate-500">Select any swatch to use it as your base color.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={copyCss} className="tool-secondary-button">
                      <ClipboardCopy aria-hidden="true" size={16} />
                      Copy CSS
                    </button>
                    <button type="button" onClick={downloadJson} className="tool-secondary-button">
                      <Download aria-hidden="true" size={16} />
                      Download JSON
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Palette type">
                  {PALETTE_MODES.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={paletteMode === id}
                      onClick={() => setPaletteMode(id)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                        paletteMode === id
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {paletteRecords.map(({ name, hex, rgb, hsl }) => (
                    <button
                      key={`${name}-${hex}`}
                      type="button"
                      onClick={() => applyColor(hexToRgb(hex))}
                      aria-label={`Use ${hex} as the selected color`}
                      title={`Use ${hex} as the selected color`}
                      className="group overflow-hidden rounded-xl border border-slate-200 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <span className="block h-20 sm:h-24" style={{ backgroundColor: hex }} />
                      <span className="block space-y-1 bg-white p-3">
                        <span className="block font-mono text-sm font-semibold uppercase text-slate-900">{hex}</span>
                        <span className="block truncate text-xs text-slate-500">{rgb}</span>
                        <span className="block truncate text-xs text-slate-500">{hsl}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <section aria-labelledby="contrast-heading" className="tool-surface-raised p-4 sm:p-6">
            <div>
              <h2 id="contrast-heading" className="text-lg font-semibold text-slate-950">WCAG contrast checker</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Check text against a background using the WCAG relative-luminance contrast ratio.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                { key: 'foreground', label: 'Foreground color' },
                { key: 'background', label: 'Background color' },
              ].map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-slate-200 p-4">
                  <label htmlFor={`contrast-${key}`} className="block text-sm font-semibold text-slate-700">{label}</label>
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      id={`contrast-${key}`}
                      type="color"
                      aria-label={`Choose ${label.toLowerCase()}`}
                      value={contrastColors[key]}
                      onChange={(event) => updateContrastColor(key, event.target.value)}
                      className="size-11 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <input
                      type="text"
                      aria-label={`${label} HEX value`}
                      value={contrastInputs[key]}
                      onChange={(event) => updateContrastColor(key, event.target.value)}
                      aria-invalid={Boolean(contrastErrors[key])}
                      className="tool-editor min-w-0 flex-1 px-3 py-2 font-mono text-sm"
                    />
                  </div>
                  {contrastErrors[key] && <p role="alert" className="mt-2 text-sm text-red-700">{contrastErrors[key]}</p>}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Contrast ratio</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">{ratio.toFixed(2)}:1</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {contrastChecks.map(({ label, threshold }) => {
                  const passes = ratio >= threshold
                  return (
                    <div
                      key={label}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                        passes ? 'border-emerald-200 bg-white text-emerald-800' : 'border-amber-200 bg-white text-amber-900'
                      }`}
                    >
                      <span>{label} ({threshold}:1)</span>
                      <strong>{passes ? 'Pass' : 'Not met'}</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          <section aria-labelledby="recent-colors-heading" className="tool-surface-raised p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="recent-colors-heading" className="text-lg font-semibold text-slate-950">Recently selected</h2>
                <p className="mt-1 text-sm text-slate-500">Colors selected during this visit are available here.</p>
              </div>
              {recentColors.length > 0 && (
                <button type="button" onClick={() => setRecentColors([])} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                  Clear history
                </button>
              )}
            </div>
            {recentColors.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {recentColors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => applyColor(hexToRgb(hex))}
                    aria-label={`Restore color ${hex}`}
                    title={`Restore ${hex}`}
                    className="size-12 rounded-lg border border-slate-300 shadow-sm transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Your selected colors will appear here.</p>
            )}
          </section>
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-color-picker">
            <h2 id="about-color-picker" className="text-2xl font-bold tracking-tight text-slate-950">
              Pick a color and build a palette
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use the visual picker or enter a HEX, RGB, or HSL value to update the selected color. Generate complementary, analogous, triadic, or monochromatic palettes, then copy individual values or export the whole palette as CSS variables or JSON.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              The contrast checker calculates the WCAG contrast ratio for your foreground and background colors. A result passes a listed AA or AAA check only when its ratio reaches that text-size threshold. Color selection, conversion, palette generation, and contrast checks stay in your browser.
            </p>
          </section>

          <section aria-labelledby="color-picker-faq">
            <h2 id="color-picker-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I convert between HEX, RGB, and HSL?', 'Enter a valid color in any of the three fields. The other formats and the preview update immediately. HEX accepts three- or six-digit values; RGB channels must be 0–255; HSL saturation and lightness must be 0–100%.'],
                ['How are the palettes generated?', 'Complementary colors are opposite on the hue wheel. Analogous colors use nearby hues, triadic colors are spaced 120 degrees apart, and monochromatic colors vary lightness while retaining the selected hue and saturation.'],
                ['What do the contrast results mean?', 'The checker compares the calculated ratio with WCAG AA and AAA thresholds for normal and large text. A check is marked Pass only if the ratio meets its threshold; this is a contrast check, not a certification of an entire page.'],
                ['Can I export my palette?', 'Copy CSS variables to your clipboard or download a JSON file containing each palette color in HEX, RGB, and HSL.'],
                ['Are my colors uploaded or saved?', 'Color calculations run locally in your browser. Recent colors are kept in the current page session and are cleared when you reset or clear the recent-color list.'],
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
