import { ArrowRight, CalendarDays, RotateCcw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'
import { calculateAgeDetails, getTodayDateString } from '../utils/ageCalculator.js'

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function ResultTile({ label, value, accent }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${accent}`}>
      <dt className="text-sm font-medium opacity-80">{label}</dt>
      <dd className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
        {value.toLocaleString()}
      </dd>
    </div>
  )
}

export default function AgeCalculator() {
  const [birthDate, setBirthDate] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const today = getTodayDateString()

  const calculate = (event) => {
    event.preventDefault()
    setError('')

    try {
      setResult(calculateAgeDetails(birthDate, getTodayDateString()))
    } catch (calculationError) {
      if (!(calculationError instanceof RangeError)) throw calculationError
      setResult(null)
      setError(calculationError.message)
    }
  }

  const reset = () => {
    setBirthDate('')
    setResult(null)
    setError('')
  }

  return (
    <>
      <PageMetadata
        title="Age Calculator - Calculate Your Exact Age"
        description="Calculate your exact age in years, months, and days, see total days and weeks, and find your next birthday. Free, private age calculator that runs in your browser."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Age Calculator</h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Find your exact age and see how long until your next birthday.
          </p>
        </header>

        <section aria-label="Age calculator" className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <form noValidate onSubmit={calculate} className="tool-surface-raised h-fit p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200">
                <CalendarDays aria-hidden="true" size={21} />
              </span>
              <div>
                <h2 className="font-semibold text-slate-950">Enter your date of birth</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Your date is used only to calculate results in this browser.
                </p>
              </div>
            </div>

            <label htmlFor="age-birth-date" className="mt-5 block text-sm font-medium text-slate-700">
              Date of birth
            </label>
            <input
              id="age-birth-date"
              type="date"
              value={birthDate}
              max={today}
              onChange={(event) => {
                setBirthDate(event.target.value)
                setResult(null)
                setError('')
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'age-calculator-error' : 'age-calculator-date-help'}
              className="tool-field mt-2"
            />
            <p id="age-calculator-date-help" className="mt-2 text-xs leading-5 text-slate-500">
              Choose a date on or before today.
            </p>

            {error && (
              <p id="age-calculator-error" role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="submit" className="tool-primary-button">
                Calculate age
                <ArrowRight aria-hidden="true" size={16} />
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={!birthDate && !result && !error}
                className="tool-secondary-button"
              >
                <RotateCcw aria-hidden="true" size={16} />
                Reset
              </button>
            </div>

            <div className="mt-5 flex items-start gap-2 rounded-xl border border-indigo-100 bg-white/80 px-3 py-2.5 text-xs leading-5 text-slate-600">
              <Sparkles aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-indigo-600" />
              Leap-day birthdays use February 28 in non-leap years.
            </div>
          </form>

          <div className="min-w-0">
            {result ? (
              <section key={result.birthDate} aria-label="Age calculation results" className="age-result-enter space-y-4">
                <div className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-5 text-white shadow-xl shadow-indigo-200/70 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
                    Your exact age
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    {result.years} {result.years === 1 ? 'year' : 'years'},{' '}
                    {result.months} {result.months === 1 ? 'month' : 'months'},{' '}
                    {result.days} {result.days === 1 ? 'day' : 'days'}
                  </h2>
                  <p className="mt-2 text-sm text-indigo-100/80">
                    Calculated on {formatDate(result.calculatedOn)}
                  </p>
                </div>

                <dl className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <ResultTile
                    label="Years"
                    value={result.years}
                    accent="border-indigo-100 bg-gradient-to-br from-white to-indigo-50 text-indigo-950"
                  />
                  <ResultTile
                    label="Months"
                    value={result.months}
                    accent="border-violet-100 bg-gradient-to-br from-white to-violet-50 text-violet-950"
                  />
                  <ResultTile
                    label="Days"
                    value={result.days}
                    accent="border-sky-100 bg-gradient-to-br from-white to-sky-50 text-sky-950"
                  />
                </dl>

                <section aria-labelledby="age-total-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 id="age-total-heading" className="font-semibold text-slate-950">Your age in totals</h3>
                    <p className="text-xs text-slate-500">Completed calendar months and elapsed days</p>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
                    {[
                      ['Total months', result.totalMonths],
                      ['Total weeks', result.totalWeeks],
                      ['Total days', result.totalDays],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                        <dt className="text-xs leading-5 text-slate-500">{label}</dt>
                        <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
                          {value.toLocaleString()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <div className="grid gap-3 sm:grid-cols-2">
                  <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/80 p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">Next birthday</p>
                    <p className="mt-2 text-lg font-bold text-slate-950">{formatDate(result.nextBirthdayDate)}</p>
                    <p className="mt-1 text-sm font-semibold text-indigo-700">
                      {result.daysUntilNextBirthday === 0
                        ? 'Happy birthday!'
                        : `${result.daysUntilNextBirthday.toLocaleString()} days to go`}
                    </p>
                  </section>
                  <section className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white to-sky-50/80 p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600">You were born on</p>
                    <p className="mt-2 text-lg font-bold text-slate-950">{result.weekday}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDate(result.birthDate)}</p>
                  </section>
                </div>
              </section>
            ) : (
              <div className="flex min-h-[19rem] flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50/60 px-6 py-10 text-center shadow-sm sm:min-h-[22rem]">
                <span className="flex size-16 items-center justify-center rounded-3xl bg-white text-indigo-600 shadow-md shadow-indigo-100 ring-1 ring-indigo-100">
                  <CalendarDays aria-hidden="true" size={28} />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-slate-950">Your age, at a glance</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                  Enter your date of birth to see your exact age, total days lived, and your next birthday countdown.
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto mt-10 max-w-3xl space-y-8">
          <section aria-labelledby="about-age-calculator">
            <h2 id="about-age-calculator" className="text-2xl font-bold tracking-tight text-slate-950">
              Calculate your exact age
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              This age calculator compares calendar dates to show your completed years and months, plus the remaining days. It also reports total elapsed days and weeks, the weekday you were born, and the date of your next birthday. Date-only values are handled as calendar dates, avoiding timezone shifts.
            </p>
          </section>

          <section aria-labelledby="age-calculator-faq">
            <h2 id="age-calculator-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How is my exact age calculated?', 'The calculator counts completed calendar months from your birth date, then counts the remaining calendar days. Total days and weeks are calculated from UTC-normalized calendar dates, not by estimating years from milliseconds.'],
                ['How are total months, weeks, and days counted?', 'Total months are completed calendar months. Total days are the number of dates elapsed since your birth date, and total weeks are complete seven-day periods within those elapsed days.'],
                ['What happens if I was born on February 29?', 'In non-leap years, February 28 is used as the birthday for age and birthday-countdown calculations. In leap years, the date remains February 29.'],
                ['Can I enter a future date?', 'No. The date picker is limited to today, and the calculator also checks the date before calculating.'],
                ['Is my date of birth uploaded or saved?', 'No. The calculation runs in your browser. The date is not sent to a QuickTools processing server or stored by this tool.'],
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
