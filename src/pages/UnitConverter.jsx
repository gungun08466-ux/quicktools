import { ArrowLeftRight, Check, Copy, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const categories = [
  {
    id: 'length',
    label: 'Length',
    baseLabel: 'meters',
    defaultFrom: 'm',
    defaultTo: 'ft',
    units: [
      { id: 'mm', label: 'Millimeter', symbol: 'mm', factor: 0.001 },
      { id: 'cm', label: 'Centimeter', symbol: 'cm', factor: 0.01 },
      { id: 'm', label: 'Meter', symbol: 'm', factor: 1 },
      { id: 'km', label: 'Kilometer', symbol: 'km', factor: 1000 },
      { id: 'in', label: 'Inch', symbol: 'in', factor: 0.0254 },
      { id: 'ft', label: 'Foot', symbol: 'ft', factor: 0.3048 },
      { id: 'yd', label: 'Yard', symbol: 'yd', factor: 0.9144 },
      { id: 'mi', label: 'Mile', symbol: 'mi', factor: 1609.344 },
    ],
  },
  {
    id: 'weight',
    label: 'Weight',
    baseLabel: 'kilograms',
    defaultFrom: 'kg',
    defaultTo: 'lb',
    units: [
      { id: 'mg', label: 'Milligram', symbol: 'mg', factor: 0.000001 },
      { id: 'g', label: 'Gram', symbol: 'g', factor: 0.001 },
      { id: 'kg', label: 'Kilogram', symbol: 'kg', factor: 1 },
      { id: 'tonne', label: 'Metric tonne', symbol: 't', factor: 1000 },
      { id: 'oz', label: 'Ounce', symbol: 'oz', factor: 0.028349523125 },
      { id: 'lb', label: 'Pound', symbol: 'lb', factor: 0.45359237 },
    ],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    defaultFrom: 'c',
    defaultTo: 'f',
    units: [
      { id: 'c', label: 'Celsius', symbol: '°C' },
      { id: 'f', label: 'Fahrenheit', symbol: '°F' },
      { id: 'k', label: 'Kelvin', symbol: 'K' },
    ],
  },
  {
    id: 'area',
    label: 'Area',
    baseLabel: 'square meters',
    defaultFrom: 'm2',
    defaultTo: 'ft2',
    units: [
      { id: 'mm2', label: 'Square millimeter', symbol: 'mm²', factor: 0.000001 },
      { id: 'cm2', label: 'Square centimeter', symbol: 'cm²', factor: 0.0001 },
      { id: 'm2', label: 'Square meter', symbol: 'm²', factor: 1 },
      { id: 'km2', label: 'Square kilometer', symbol: 'km²', factor: 1000000 },
      { id: 'acre', label: 'Acre', symbol: 'acre', factor: 4046.8564224 },
      { id: 'hectare', label: 'Hectare', symbol: 'ha', factor: 10000 },
      { id: 'ft2', label: 'Square foot', symbol: 'ft²', factor: 0.09290304 },
    ],
  },
  {
    id: 'volume',
    label: 'Volume',
    baseLabel: 'liters',
    defaultFrom: 'l',
    defaultTo: 'us-gal',
    units: [
      { id: 'ml', label: 'Milliliter', symbol: 'mL', factor: 0.001 },
      { id: 'l', label: 'Liter', symbol: 'L', factor: 1 },
      { id: 'm3', label: 'Cubic meter', symbol: 'm³', factor: 1000 },
      { id: 'us-gal', label: 'US gallon', symbol: 'US gal', factor: 3.785411784 },
      { id: 'us-cup', label: 'US cup', symbol: 'US cup', factor: 0.2365882365 },
    ],
  },
  {
    id: 'time',
    label: 'Time',
    baseLabel: 'seconds',
    defaultFrom: 'min',
    defaultTo: 's',
    units: [
      { id: 'ms', label: 'Millisecond', symbol: 'ms', factor: 0.001 },
      { id: 's', label: 'Second', symbol: 's', factor: 1 },
      { id: 'min', label: 'Minute', symbol: 'min', factor: 60 },
      { id: 'h', label: 'Hour', symbol: 'h', factor: 3600 },
      { id: 'day', label: 'Day', symbol: 'day', factor: 86400 },
      { id: 'week', label: 'Week', symbol: 'week', factor: 604800 },
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    baseLabel: 'meters per second',
    defaultFrom: 'kmh',
    defaultTo: 'mph',
    units: [
      { id: 'ms', label: 'Meters per second', symbol: 'm/s', factor: 1 },
      { id: 'kmh', label: 'Kilometers per hour', symbol: 'km/h', factor: 1 / 3.6 },
      { id: 'mph', label: 'Miles per hour', symbol: 'mph', factor: 0.44704 },
      { id: 'knot', label: 'Knot', symbol: 'kn', factor: 1852 / 3600 },
    ],
  },
  {
    id: 'data',
    label: 'Data storage',
    baseLabel: 'bytes',
    defaultFrom: 'byte',
    defaultTo: 'kb',
    units: [
      { id: 'bit', label: 'Bit', symbol: 'bit', factor: 0.125 },
      { id: 'byte', label: 'Byte', symbol: 'B', factor: 1 },
      { id: 'kb', label: 'Kilobyte (decimal)', symbol: 'KB', factor: 1000 },
      { id: 'mb', label: 'Megabyte (decimal)', symbol: 'MB', factor: 1000000 },
      { id: 'gb', label: 'Gigabyte (decimal)', symbol: 'GB', factor: 1000000000 },
      { id: 'tb', label: 'Terabyte (decimal)', symbol: 'TB', factor: 1000000000000 },
    ],
  },
]

const temperatureFormulas = {
  'c-f': '°F = (°C × 9 ÷ 5) + 32',
  'c-k': 'K = °C + 273.15',
  'f-c': '°C = (°F - 32) × 5 ÷ 9',
  'f-k': 'K = ((°F - 32) × 5 ÷ 9) + 273.15',
  'k-c': '°C = K - 273.15',
  'k-f': '°F = ((K - 273.15) × 9 ÷ 5) + 32',
}

const ABSOLUTE_ZERO_CELSIUS = -273.15

function formatNumber(value) {
  const normalizedValue = Object.is(value, -0) ? 0 : value
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 12 }).format(normalizedValue)
}

function toCelsius(value, unitId) {
  if (unitId === 'f') return (value - 32) * (5 / 9)
  if (unitId === 'k') return value - 273.15
  return value
}

function fromCelsius(value, unitId) {
  if (unitId === 'f') return (value * (9 / 5)) + 32
  if (unitId === 'k') return value + 273.15
  return value
}

function getTemperatureSteps(value, fromUnit, toUnit, celsiusValue, result) {
  if (fromUnit.id === toUnit.id) {
    return [`The input is already in ${fromUnit.label}: ${formatNumber(value)} ${fromUnit.symbol}.`]
  }

  const sourceStep = fromUnit.id === 'c'
    ? `Input is already Celsius: ${formatNumber(value)} °C.`
    : fromUnit.id === 'f'
      ? `Convert to Celsius: (${formatNumber(value)} - 32) × 5 ÷ 9 = ${formatNumber(celsiusValue)} °C.`
      : `Convert to Celsius: ${formatNumber(value)} - 273.15 = ${formatNumber(celsiusValue)} °C.`
  const targetStep = toUnit.id === 'c'
    ? `Use the Celsius value: ${formatNumber(celsiusValue)} °C.`
    : toUnit.id === 'f'
      ? `Convert to Fahrenheit: (${formatNumber(celsiusValue)} × 9 ÷ 5) + 32 = ${formatNumber(result)} °F.`
      : `Convert to Kelvin: ${formatNumber(celsiusValue)} + 273.15 = ${formatNumber(result)} K.`

  return [sourceStep, targetStep]
}

function getConversion(value, category, fromUnit, toUnit) {
  if (category.id === 'temperature') {
    let celsiusValue = toCelsius(value, fromUnit.id)
    if (celsiusValue < ABSOLUTE_ZERO_CELSIUS - 1e-10) {
      return { error: 'Temperatures below absolute zero (-273.15 °C) cannot be converted.' }
    }
    if (Math.abs(celsiusValue - ABSOLUTE_ZERO_CELSIUS) <= 1e-10) {
      celsiusValue = ABSOLUTE_ZERO_CELSIUS
    }

    const result = fromCelsius(celsiusValue, toUnit.id)
    if (!Number.isFinite(result)) {
      return { error: 'This value is outside the range the browser can convert.' }
    }

    return {
      result,
      formula: temperatureFormulas[`${fromUnit.id}-${toUnit.id}`] || 'Same unit: output = input',
      steps: getTemperatureSteps(value, fromUnit, toUnit, celsiusValue, result),
      explanation: 'Temperature is converted through Celsius. Negative Celsius and Fahrenheit values are valid.',
    }
  }

  const conversionFactor = fromUnit.factor / toUnit.factor
  const result = value * conversionFactor
  if (!Number.isFinite(result)) {
    return { error: 'This value is outside the range the browser can convert.' }
  }

  return {
    result,
    formula: fromUnit.id === toUnit.id
      ? 'Same unit: output = input'
      : `1 ${fromUnit.symbol} = ${formatNumber(conversionFactor)} ${toUnit.symbol}`,
    steps: [
      fromUnit.id === toUnit.id
        ? `The units match, so ${formatNumber(value)} ${fromUnit.symbol} stays unchanged.`
        : `${formatNumber(value)} × ${formatNumber(conversionFactor)} = ${formatNumber(result)} ${toUnit.symbol}.`,
    ],
    explanation: `Conversion uses ${category.baseLabel} as the common base unit.`,
  }
}

function FeedbackMessage({ feedback }) {
  if (!feedback) return null

  const isError = feedback.type === 'error'
  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
      }`}
    >
      {feedback.message}
    </p>
  )
}

export default function UnitConverter() {
  const [categoryId, setCategoryId] = useState('length')
  const [fromUnitId, setFromUnitId] = useState('m')
  const [toUnitId, setToUnitId] = useState('ft')
  const [inputValue, setInputValue] = useState('1')
  const [hasInteracted, setHasInteracted] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const category = categories.find(({ id }) => id === categoryId) || categories[0]
  const fromUnit = category.units.find(({ id }) => id === fromUnitId) || category.units[0]
  const toUnit = category.units.find(({ id }) => id === toUnitId) || category.units[1]
  const hasEmptyInput = inputValue.trim() === ''
  const numericValue = hasEmptyInput ? Number.NaN : Number(inputValue)
  const conversion = !Number.isFinite(numericValue)
    ? { error: hasInteracted ? 'Enter a valid number to convert.' : '' }
    : getConversion(numericValue, category, fromUnit, toUnit)
  const hasError = Boolean(conversion.error)
  const hasResult = !hasError && Number.isFinite(conversion.result)
  const resultText = hasResult
    ? `${formatNumber(conversion.result)} ${toUnit.symbol}`
    : ''

  const changeCategory = (nextCategory) => {
    setCategoryId(nextCategory.id)
    setFromUnitId(nextCategory.defaultFrom)
    setToUnitId(nextCategory.defaultTo)
    setFeedback(null)
  }

  const updateInput = (value) => {
    setInputValue(value)
    setHasInteracted(true)
    setFeedback(null)
  }

  const swapUnits = () => {
    setFromUnitId(toUnitId)
    setToUnitId(fromUnitId)
    setFeedback(null)
  }

  const clearValue = () => {
    setInputValue('')
    setHasInteracted(true)
    setFeedback(null)
  }

  const resetConverter = () => {
    setInputValue('1')
    setFromUnitId(category.defaultFrom)
    setToUnitId(category.defaultTo)
    setHasInteracted(false)
    setFeedback(null)
  }

  const copyResult = async () => {
    if (!hasResult) return
    if (!navigator.clipboard?.writeText) {
      setFeedback({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(resultText)
      setFeedback({ type: 'success', message: `Copied ${resultText} to the clipboard.` })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error
          ? `Could not copy the result: ${error.message}`
          : 'Could not access the clipboard. Check browser permissions and try again.',
      })
    }
  }

  const formula = conversion.formula
    || (category.id === 'temperature'
      ? temperatureFormulas[`${fromUnit.id}-${toUnit.id}`] || 'Same unit: output = input'
      : fromUnit.id === toUnit.id
        ? 'Same unit: output = input'
        : `1 ${fromUnit.symbol} = ${formatNumber(fromUnit.factor / toUnit.factor)} ${toUnit.symbol}`)
  const explanation = category.id === 'data'
    ? 'Decimal storage units are used: 1 KB = 1,000 bytes, 1 MB = 1,000 KB. Binary units such as KiB are not included.'
    : category.id === 'temperature'
      ? 'Temperature is converted through Celsius. Values below absolute zero (-273.15 °C) are invalid.'
      : `${conversion.explanation || `Conversion uses ${category.baseLabel} as the common base unit.`} Signed values are preserved.`

  return (
    <>
      <PageMetadata
        title="Unit Converter - Convert Length, Weight, Temperature & More"
        description="Use this free unit converter for length, weight, temperature, area, volume, time, speed, and decimal data storage. Convert instantly in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Unit Converter</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Convert common measurements instantly. Choose a category, set your units, and enter a value.
          </p>
        </header>

        <section aria-label="Unit converter" className="mx-auto max-w-5xl space-y-4">
          <nav aria-label="Conversion categories">
            <p className="mb-2 text-sm font-semibold text-slate-700">Choose a category</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.map((item) => {
                const isSelected = item.id === category.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeCategory(item)}
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                    }`}
                  >
                    {item.label}
                    <span className="text-xs font-medium opacity-70">{item.units.length}</span>
                  </button>
                )
              })}
            </div>
          </nav>

          <section aria-labelledby="converter-panel-heading" className="tool-surface-raised p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
                <ArrowLeftRight aria-hidden="true" size={21} />
              </span>
              <div>
                <h2 id="converter-panel-heading" className="font-semibold text-slate-950">
                  Convert {category.label.toLowerCase()}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  The result updates as you change the value or units.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label htmlFor="unit-value" className="block text-sm font-medium text-slate-700">
                  Value to convert
                </label>
                <input
                  id="unit-value"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={(event) => updateInput(event.target.value)}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? 'unit-converter-error' : 'unit-value-help'}
                  className="tool-field mt-2 text-lg font-semibold tabular-nums"
                />
                <p id="unit-value-help" className="mt-2 text-xs text-slate-500">
                  Decimal values are supported.
                </p>
                <label htmlFor="unit-from" className="mt-4 block text-sm font-medium text-slate-700">
                  From unit
                </label>
                <select
                  id="unit-from"
                  value={fromUnit.id}
                  onChange={(event) => {
                    setFromUnitId(event.target.value)
                    setFeedback(null)
                  }}
                  className="tool-field mt-2"
                >
                  {category.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={swapUnits}
                aria-label="Swap from and to units"
                title="Swap from and to units"
                className="inline-flex size-11 items-center justify-center justify-self-center rounded-xl border border-indigo-200 bg-white text-indigo-700 shadow-sm transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <ArrowLeftRight aria-hidden="true" size={19} className="rotate-90 md:rotate-0" />
              </button>

              <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                <label htmlFor="unit-to" className="block text-sm font-medium text-slate-700">
                  To unit
                </label>
                <select
                  id="unit-to"
                  value={toUnit.id}
                  onChange={(event) => {
                    setToUnitId(event.target.value)
                    setFeedback(null)
                  }}
                  className="tool-field mt-2"
                >
                  {category.units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label} ({unit.symbol})
                    </option>
                  ))}
                </select>

                <div className="mt-4 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    Converted result
                  </p>
                  <output
                    aria-label="Converted result"
                    aria-live="polite"
                    className="mt-1 block min-h-10 break-words text-3xl font-bold tabular-nums tracking-tight text-slate-950 sm:text-4xl"
                  >
                    {hasResult ? resultText : '—'}
                  </output>
                  {hasError && (
                    <p id="unit-converter-error" role="alert" className="mt-2 text-sm leading-5 text-red-700">
                      {conversion.error}
                    </p>
                  )}
                  {!hasResult && !hasError && (
                    <p className="mt-2 text-sm text-slate-500">Enter a value to convert.</p>
                  )}
                  <button
                    type="button"
                    onClick={copyResult}
                    disabled={!hasResult}
                    className="tool-secondary-button mt-3 min-h-9 px-3 py-1.5 text-xs"
                  >
                    {feedback?.type === 'success'
                      ? <Check aria-hidden="true" size={15} />
                      : <Copy aria-hidden="true" size={15} />}
                    {feedback?.type === 'success' ? 'Copied' : 'Copy result'}
                  </button>
                </div>
              </div>
            </div>

            <FeedbackMessage feedback={feedback} />

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={clearValue}
                disabled={!inputValue}
                className="tool-secondary-button"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={resetConverter}
                className="tool-secondary-button"
              >
                <RotateCcw aria-hidden="true" size={16} />
                Reset
              </button>
            </div>

            <section aria-label="Conversion formula" className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4">
              <h3 className="text-sm font-semibold text-slate-800">Formula and explanation</h3>
              <p className="mt-2 break-words font-mono text-sm text-indigo-900">{formula}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{explanation}</p>
              {hasResult && conversion.steps?.length > 0 && (
                <ol className="mt-3 list-inside list-decimal space-y-1 text-sm leading-6 text-slate-600">
                  {conversion.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              )}
            </section>
          </section>
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="unit-converter-explanation">
            <h2 id="unit-converter-explanation" className="text-2xl font-bold tracking-tight text-slate-950">
              Convert units in your browser
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Choose a measurement category, select the source and destination units, and enter a value to convert
              length, weight, temperature, area, volume, time, speed, or data storage. Results and conversion
              explanations update locally as you work. Standard definitions are used for customary units, including
              the international foot and pound and the US gallon. Data storage uses decimal SI units: KB, MB, GB, and
              TB are based on powers of 1,000 bytes; binary units such as KiB are not included.
            </p>
          </section>

          <section aria-labelledby="unit-converter-faq">
            <h2 id="unit-converter-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I convert between units?', 'Choose a category, select the From and To units, then enter a value. The converter applies the appropriate factor or temperature formula and updates the result instantly.'],
                ['How are temperature units converted?', 'Celsius, Fahrenheit, and Kelvin use their standard formulas. Negative Celsius and Fahrenheit temperatures are allowed, but temperatures below absolute zero (-273.15 °C) are rejected.'],
                ['Are KB and KiB the same?', 'No. This converter uses decimal storage units: 1 KB is 1,000 bytes and 1 MB is 1,000,000 bytes. Binary units such as KiB and MiB are not included.'],
                ['Can I convert decimal or negative values?', 'Yes. Decimal and signed values are supported for linear unit conversions. Temperature values are also checked against absolute zero.'],
                ['Are my values sent to a server?', 'No. Conversions run in your browser. The values you enter are not sent to a processing server.'],
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
