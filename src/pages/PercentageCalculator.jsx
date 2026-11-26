import { Calculator, Percent, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

function formatNumber(value) {
  const normalizedValue = Object.is(value, -0) ? 0 : value
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(normalizedValue)
}

function formatSignedPercent(value) {
  return `${value > 0 ? '+' : ''}${formatNumber(value)}%`
}

const calculators = [
  {
    id: 'percent-of',
    title: 'What is X% of Y?',
    description: 'Find a percentage of a number.',
    formula: '(X ÷ 100) × Y',
    resultLabel: 'Percentage of Y',
    example: '15% of 200 = 30',
    fields: [
      { key: 'percentage', label: 'Percentage (X)', placeholder: 'e.g. 15' },
      { key: 'number', label: 'Number (Y)', placeholder: 'e.g. 200' },
    ],
    calculate: ({ percentage, number }) => (percentage / 100) * number,
    formatResult: formatNumber,
    getSteps: ({ percentage, number }, result) => {
      const decimal = percentage / 100
      return [
        `Convert the percentage to a decimal: ${formatNumber(percentage)} ÷ 100 = ${formatNumber(decimal)}.`,
        `Multiply by Y: ${formatNumber(decimal)} × ${formatNumber(number)} = ${formatNumber(result)}.`,
      ]
    },
  },
  {
    id: 'what-percent',
    title: 'X is what percent of Y?',
    description: 'Find what percentage one number is of another.',
    formula: '(X ÷ Y) × 100',
    resultLabel: 'Percentage',
    example: '30 is 15% of 200',
    denominatorKey: 'whole',
    zeroDenominatorMessage: 'Y cannot be zero because it is the denominator.',
    fields: [
      { key: 'part', label: 'Part (X)', placeholder: 'e.g. 30' },
      { key: 'whole', label: 'Whole (Y)', placeholder: 'e.g. 200' },
    ],
    calculate: ({ part, whole }) => (part / whole) * 100,
    formatResult: (value) => `${formatNumber(value)}%`,
    getSteps: ({ part, whole }, result) => {
      const ratio = part / whole
      return [
        `Divide X by Y: ${formatNumber(part)} ÷ ${formatNumber(whole)} = ${formatNumber(ratio)}.`,
        `Convert the ratio to a percentage: ${formatNumber(ratio)} × 100 = ${formatNumber(result)}%.`,
      ]
    },
  },
  {
    id: 'percentage-increase',
    title: 'Percentage increase',
    description: 'Compare an original value with a new value.',
    formula: '((New value - Original value) ÷ |Original value|) × 100',
    resultLabel: 'Percentage increase',
    example: 'From 80 to 100 = +25%',
    denominatorKey: 'original',
    zeroDenominatorMessage: 'The original value cannot be zero for a percentage increase.',
    fields: [
      { key: 'original', label: 'Original value', placeholder: 'e.g. 80' },
      { key: 'newValue', label: 'New value', placeholder: 'e.g. 100' },
    ],
    calculate: ({ original, newValue }) => ((newValue - original) / Math.abs(original)) * 100,
    formatResult: formatSignedPercent,
    getSteps: ({ original, newValue }, result) => {
      const difference = newValue - original
      return [
        `Find the difference: ${formatNumber(newValue)} - (${formatNumber(original)}) = ${formatNumber(difference)}.`,
        `Divide by the absolute original value and multiply by 100: ${formatNumber(difference)} ÷ |${formatNumber(original)}| × 100 = ${formatSignedPercent(result)}.`,
      ]
    },
    getNote: (value) => value < 0
      ? 'The negative result means the new value is lower than the original.'
      : '',
  },
  {
    id: 'percentage-decrease',
    title: 'Percentage decrease',
    description: 'Calculate how much a value has decreased.',
    formula: '((Original value - New value) ÷ |Original value|) × 100',
    resultLabel: 'Percentage decrease',
    example: 'From 100 to 80 = +20%',
    denominatorKey: 'original',
    zeroDenominatorMessage: 'The original value cannot be zero for a percentage decrease.',
    fields: [
      { key: 'original', label: 'Original value', placeholder: 'e.g. 100' },
      { key: 'newValue', label: 'New value', placeholder: 'e.g. 80' },
    ],
    calculate: ({ original, newValue }) => ((original - newValue) / Math.abs(original)) * 100,
    formatResult: formatSignedPercent,
    getSteps: ({ original, newValue }, result) => {
      const difference = original - newValue
      return [
        `Find the difference: ${formatNumber(original)} - (${formatNumber(newValue)}) = ${formatNumber(difference)}.`,
        `Divide by the absolute original value and multiply by 100: ${formatNumber(difference)} ÷ |${formatNumber(original)}| × 100 = ${formatSignedPercent(result)}.`,
      ]
    },
    getNote: (value) => value < 0
      ? 'The negative result means the new value is higher than the original.'
      : '',
  },
  {
    id: 'percentage-change',
    title: 'Percentage change',
    description: 'Show the signed change from a starting value to an ending value.',
    formula: '((Ending value - Starting value) ÷ |Starting value|) × 100',
    resultLabel: 'Percentage change',
    example: 'From 80 to 100 = +25%; from 100 to 80 = -20%',
    denominatorKey: 'starting',
    zeroDenominatorMessage: 'The starting value cannot be zero for percentage change.',
    fields: [
      { key: 'starting', label: 'Starting value', placeholder: 'e.g. 80' },
      { key: 'ending', label: 'Ending value', placeholder: 'e.g. 100' },
    ],
    calculate: ({ starting, ending }) => ((ending - starting) / Math.abs(starting)) * 100,
    formatResult: formatSignedPercent,
    getSteps: ({ starting, ending }, result) => {
      const difference = ending - starting
      return [
        `Find the signed difference: ${formatNumber(ending)} - (${formatNumber(starting)}) = ${formatNumber(difference)}.`,
        `Divide by the absolute starting value and multiply by 100: ${formatNumber(difference)} ÷ |${formatNumber(starting)}| × 100 = ${formatSignedPercent(result)}.`,
      ]
    },
    getNote: (value) => value > 0
      ? 'A positive result means the value increased.'
      : value < 0
        ? 'A negative result means the value decreased.'
        : 'A zero result means there was no change.',
  },
  {
    id: 'add-percentage',
    title: 'Add percentage',
    description: 'Add a percentage amount to a number.',
    formula: 'Y + (Y × X ÷ 100)',
    resultLabel: 'Number after adding percentage',
    example: 'Add 15% to 200 = 230',
    fields: [
      { key: 'percentage', label: 'Percentage (X)', placeholder: 'e.g. 15' },
      { key: 'number', label: 'Number (Y)', placeholder: 'e.g. 200' },
    ],
    calculate: ({ percentage, number }) => number + ((number * percentage) / 100),
    formatResult: formatNumber,
    getSteps: ({ percentage, number }, result) => {
      const amount = (number * percentage) / 100
      return [
        `Calculate the percentage amount: ${formatNumber(number)} × ${formatNumber(percentage)} ÷ 100 = ${formatNumber(amount)}.`,
        `Add it to Y: ${formatNumber(number)} + (${formatNumber(amount)}) = ${formatNumber(result)}.`,
      ]
    },
  },
  {
    id: 'subtract-percentage',
    title: 'Subtract percentage',
    description: 'Subtract a percentage amount from a number.',
    formula: 'Y - (Y × X ÷ 100)',
    resultLabel: 'Number after subtracting percentage',
    example: 'Subtract 15% from 200 = 170',
    fields: [
      { key: 'percentage', label: 'Percentage (X)', placeholder: 'e.g. 15' },
      { key: 'number', label: 'Number (Y)', placeholder: 'e.g. 200' },
    ],
    calculate: ({ percentage, number }) => number - ((number * percentage) / 100),
    formatResult: formatNumber,
    getSteps: ({ percentage, number }, result) => {
      const amount = (number * percentage) / 100
      return [
        `Calculate the percentage amount: ${formatNumber(number)} × ${formatNumber(percentage)} ÷ 100 = ${formatNumber(amount)}.`,
        `Subtract it from Y: ${formatNumber(number)} - (${formatNumber(amount)}) = ${formatNumber(result)}.`,
      ]
    },
  },
]

function getCalculation(calculator, inputs, hasInteracted) {
  if (!hasInteracted) return { status: 'idle' }

  for (const field of calculator.fields) {
    if (!inputs[field.key].trim()) {
      return {
        status: 'error',
        fieldKey: field.key,
        message: `Enter a value for ${field.label.toLowerCase()}.`,
      }
    }
  }

  const values = Object.fromEntries(
    calculator.fields.map(({ key }) => [key, Number(inputs[key])]),
  )

  for (const field of calculator.fields) {
    if (!Number.isFinite(values[field.key])) {
      return {
        status: 'error',
        fieldKey: field.key,
        message: `Enter a valid number for ${field.label.toLowerCase()}.`,
      }
    }
  }

  if (calculator.denominatorKey && values[calculator.denominatorKey] === 0) {
    return {
      status: 'error',
      fieldKey: calculator.denominatorKey,
      message: calculator.zeroDenominatorMessage,
    }
  }

  const value = calculator.calculate(values)
  if (!Number.isFinite(value)) {
    return {
      status: 'error',
      message: 'The result is too large to calculate. Try smaller values.',
    }
  }

  return {
    status: 'success',
    value,
    displayValue: calculator.formatResult(value),
    steps: calculator.getSteps(values, value),
    note: calculator.getNote ? calculator.getNote(value) : '',
  }
}

function PercentageCalculatorCard({ calculator }) {
  const [inputs, setInputs] = useState(() => Object.fromEntries(
    calculator.fields.map(({ key }) => [key, '']),
  ))
  const [hasInteracted, setHasInteracted] = useState(false)
  const calculation = getCalculation(calculator, inputs, hasInteracted)
  const isSuccessful = calculation.status === 'success'
  const isError = calculation.status === 'error'

  const updateInput = (key, value) => {
    setInputs((current) => ({ ...current, [key]: value }))
    setHasInteracted(true)
  }

  const reset = () => {
    setInputs(Object.fromEntries(calculator.fields.map(({ key }) => [key, ''])))
    setHasInteracted(false)
  }

  return (
    <section
      aria-labelledby={`${calculator.id}-heading`}
      className="tool-surface flex h-full flex-col p-4 sm:p-5"
    >
      <header className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
          <Percent aria-hidden="true" size={20} />
        </span>
        <div className="min-w-0">
          <h2 id={`${calculator.id}-heading`} className="font-semibold text-slate-950">
            {calculator.title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">{calculator.description}</p>
        </div>
      </header>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          setHasInteracted(true)
        }}
        className="mt-4 flex flex-1 flex-col"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {calculator.fields.map((field) => {
            const inputId = `${calculator.id}-${field.key}`
            const helpId = `${inputId}-help`
            const errorId = `${calculator.id}-error`
            const fieldHasError = isError && calculation.fieldKey === field.key

            return (
              <div key={field.key}>
                <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
                  {field.label}
                </label>
                <input
                  id={inputId}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={inputs[field.key]}
                  onChange={(event) => updateInput(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  aria-invalid={Boolean(fieldHasError)}
                  aria-describedby={fieldHasError ? `${helpId} ${errorId}` : helpId}
                  className="tool-field mt-1.5"
                />
                <p id={helpId} className="mt-1 text-xs text-slate-500">
                  Decimals and negative values are supported.
                </p>
              </div>
            )
          })}
        </div>

        {isError && (
          <p id={`${calculator.id}-error`} role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {calculation.message}
          </p>
        )}

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formula</p>
          <p className="mt-1 break-words font-mono text-sm text-slate-800">{calculator.formula}</p>
        </div>

        <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
            {calculator.resultLabel}
          </p>
          <output
            aria-label={`Result for ${calculator.title}`}
            aria-live="polite"
            className="mt-1 block break-words text-3xl font-bold tabular-nums tracking-tight text-slate-950"
          >
            {isSuccessful ? calculation.displayValue : '—'}
          </output>
          {!isSuccessful && !isError && (
            <p className="mt-1 text-xs text-slate-500">
              Enter values to see your result.
            </p>
          )}
          {isSuccessful && calculation.note && (
            <p className="mt-1 text-xs leading-5 text-slate-600">{calculation.note}</p>
          )}
        </div>

        {isSuccessful && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-semibold text-slate-800">Calculation steps</h3>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-xs leading-5 text-slate-600">
              {calculation.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button type="submit" className="tool-primary-button min-w-0 flex-1">
            <Calculator aria-hidden="true" size={16} />
            Calculate
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!hasInteracted}
            className="tool-secondary-button px-3"
            aria-label={`Reset ${calculator.title}`}
            title="Reset this calculator"
          >
            <RotateCcw aria-hidden="true" size={16} />
            <span className="sr-only sm:not-sr-only">Reset</span>
          </button>
        </div>
      </form>

      <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
        Example: {calculator.example}
      </p>
    </section>
  )
}

export default function PercentageCalculator() {
  return (
    <>
      <PageMetadata
        title="Percentage Calculator - Calculate Percentages Online"
        description="Use this free percentage calculator to find a percent of a number, compare values, calculate percentage change, or add and subtract a percentage."
      />
      <div className="mx-auto max-w-7xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Percentage Calculator</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Choose a calculation, enter your values, and see the formula and result update instantly.
            Each calculator works independently.
          </p>
        </header>

        <section aria-label="Percentage calculators">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {calculators.map((calculator) => (
              <PercentageCalculatorCard key={calculator.id} calculator={calculator} />
            ))}
          </div>
        </section>

        <div className="mx-auto mt-12 max-w-4xl space-y-10">
          <section aria-labelledby="percentage-calculator-explanation">
            <h2 id="percentage-calculator-explanation" className="text-2xl font-bold tracking-tight text-slate-950">
              How to use the percentage calculator
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use the matching card to find a percentage of a value, compare a part with a whole, measure an increase
              or decrease, calculate a signed percentage change, or add and subtract a percentage. Enter whole numbers,
              decimals, or negative values. Results update as you type, and each card shows its formula and calculation
              steps. For percentage change calculations, the absolute value of the starting value is used as the base
              so the sign reflects the direction of change even when the starting value is negative. A zero starting
              value cannot be used as a percentage denominator.
            </p>
          </section>

          <section aria-labelledby="percentage-calculator-faq">
            <h2 id="percentage-calculator-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I calculate a percentage of a number?', 'Convert the percentage to a decimal by dividing it by 100, then multiply by the number. For example, 15% of 200 is (15 ÷ 100) × 200 = 30.'],
                ['How is percentage increase or decrease calculated?', 'The calculator finds the difference between the new and original values, divides by the absolute original value, and multiplies by 100. A negative result indicates the opposite direction.'],
                ['What does percentage change show?', 'Percentage change compares a starting value with an ending value. Positive results indicate an increase, negative results indicate a decrease, and zero means no change.'],
                ['Can I use decimals and negative numbers?', 'Yes. All seven calculators accept decimal and negative values. For percentage proportions and value changes, the denominator must not be zero.'],
                ['Are my values sent to a server?', 'No. All percentage calculations run locally in your browser. The values you enter are not sent to a processing server.'],
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
