import {
  AlertCircle,
  Check,
  Clipboard,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const CHARACTER_SETS = [
  { id: 'uppercase', label: 'Uppercase letters', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: 'lowercase', label: 'Lowercase letters', characters: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'numbers', label: 'Numbers', characters: '0123456789' },
  { id: 'symbols', label: 'Symbols', characters: '!@#$%^&*()-_=+[]{};:,.?/~' },
]
const AMBIGUOUS_CHARACTERS = new Set(['I', 'l', '1', 'O', '0'])

function randomIndex(max) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random generation is not available in this browser context.')
  }

  const limit = Math.floor(256 / max) * max
  const byte = new Uint8Array(1)
  let value

  do {
    globalThis.crypto.getRandomValues(byte)
    value = byte[0]
  } while (value >= limit)

  return value % max
}

function generateSecurePassword(length, selectedSets, excludeAmbiguous) {
  const availableSets = CHARACTER_SETS
    .filter(({ id }) => selectedSets[id])
    .map(({ characters }) => excludeAmbiguous
      ? [...characters].filter((character) => !AMBIGUOUS_CHARACTERS.has(character)).join('')
      : characters)
    .filter(Boolean)

  if (availableSets.length === 0) {
    throw new Error('Select at least one character type to generate a password.')
  }

  const allCharacters = availableSets.join('')
  const passwordCharacters = availableSets.map((characters) => characters[randomIndex(characters.length)])

  while (passwordCharacters.length < length) {
    passwordCharacters.push(allCharacters[randomIndex(allCharacters.length)])
  }

  for (let index = passwordCharacters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1)
    const currentCharacter = passwordCharacters[index]
    passwordCharacters[index] = passwordCharacters[swapIndex]
    passwordCharacters[swapIndex] = currentCharacter
  }

  return passwordCharacters.join('')
}

function getStrength(length, characterSetCount) {
  if (length >= 24 && characterSetCount >= 3) return { label: 'Very strong', width: '100%', color: 'bg-emerald-500' }
  if (length >= 16 && characterSetCount >= 2) return { label: 'Strong', width: '75%', color: 'bg-emerald-500' }
  if (length >= 12) return { label: 'Fair', width: '50%', color: 'bg-amber-500' }
  return { label: 'Getting started', width: '25%', color: 'bg-orange-500' }
}

export default function PasswordGenerator() {
  const [length, setLength] = useState(16)
  const [selectedSets, setSelectedSets] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true)
  const [password, setPassword] = useState('')
  const [strength, setStrength] = useState(null)
  const [status, setStatus] = useState(null)
  const [copied, setCopied] = useState(false)

  const selectedSetCount = Object.values(selectedSets).filter(Boolean).length

  const generate = () => {
    try {
      setPassword(generateSecurePassword(length, selectedSets, excludeAmbiguous))
      setStrength(getStrength(length, selectedSetCount))
      setStatus(null)
      setCopied(false)
    } catch (error) {
      setPassword('')
      setStrength(null)
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not generate a secure password.',
      })
    }
  }

  const copyPassword = async () => {
    if (!password) return

    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }

    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setStatus({ type: 'success', message: 'Password copied to the clipboard.' })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the password. Check clipboard permissions and try again.' })
    }
  }

  return (
    <>
      <PageMetadata
        title="Password Generator"
        description="Generate a strong random password in your browser. Choose its length and character types, exclude ambiguous characters, and copy it securely."
      />
      <div className="mx-auto max-w-5xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">
            Password Generator
          </h1>
        </header>

        <section
          aria-labelledby="password-settings-heading"
          className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="tool-surface order-2 p-4 sm:p-6 lg:order-1">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <KeyRound aria-hidden="true" size={20} />
              </span>
              <div>
                <h2 id="password-settings-heading" className="font-semibold text-slate-950">
                  Password settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">Choose a length from 8 to 64 characters.</p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password-length" className="text-sm font-medium text-slate-800">
                  Password length
                </label>
                <output htmlFor="password-length" className="min-w-10 rounded-lg bg-slate-100 px-2.5 py-1 text-center text-sm font-semibold text-slate-800">
                  {length}
                </output>
              </div>
              <input
                id="password-length"
                type="range"
                min="8"
                max="64"
                step="1"
                value={length}
                onChange={(event) => setLength(Number(event.target.value))}
                className="mt-4 h-2 w-full cursor-pointer accent-indigo-600"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>8 characters</span>
                <span>64 characters</span>
              </div>
            </div>

            <fieldset className="mt-7">
              <legend className="text-sm font-medium text-slate-800">Include character types</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {CHARACTER_SETS.map(({ id, label }) => (
                  <label
                    key={id}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSets[id]}
                      onChange={(event) => setSelectedSets((current) => ({
                        ...current,
                        [id]: event.target.checked,
                      }))}
                      className="size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={excludeAmbiguous}
                onChange={(event) => setExcludeAmbiguous(event.target.checked)}
                className="size-4 rounded border-slate-300 accent-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              />
              Exclude ambiguous characters (I, l, 1, O, 0)
            </label>

            <button
              type="button"
              onClick={generate}
              className="tool-primary-button mt-6 w-full"
            >
              <KeyRound aria-hidden="true" size={17} />
              Generate password
            </button>
          </div>

          <div className="tool-surface-raised order-1 p-4 sm:p-6 lg:order-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">Your password</h2>
            <p className="mt-1 text-sm text-slate-500">It will appear here after you generate it.</p>
            <div className="mt-5 flex min-h-36 items-center rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-inner">
              {password ? (
                <output
                  aria-label="Generated password"
                  className="w-full break-all font-mono text-lg font-semibold leading-7 text-indigo-100 sm:text-2xl"
                >
                  {password}
                </output>
              ) : (
                <p className="w-full text-center text-sm text-slate-400">Your secure password will appear here</p>
              )}
            </div>

            {password && (
              <>
                <div className="mt-5" aria-label={`Password strength: ${strength.label}`}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">Estimated strength</span>
                    <span className="font-semibold text-slate-900">{strength.label}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full transition-all ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    This estimate considers length and selected character types. Use a unique password for each account.
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="tool-primary-button"
                  >
                    {copied ? <Check aria-hidden="true" size={17} /> : <Clipboard aria-hidden="true" size={17} />}
                    {copied ? 'Copied!' : 'Copy password'}
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    className="tool-secondary-button"
                  >
                    <RefreshCw aria-hidden="true" size={17} />
                    Regenerate
                  </button>
                </div>
              </>
            )}

            {status && (
              <div
                role={status.type === 'error' ? 'alert' : 'status'}
                aria-live={status.type === 'error' ? 'assertive' : 'polite'}
                className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  status.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {status.type === 'error'
                  ? <AlertCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
                  : <Check aria-hidden="true" size={17} className="mt-0.5 shrink-0" />}
                <p>{status.message}</p>
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto mt-8 max-w-4xl space-y-12">
          <section aria-labelledby="about-passwords">
            <h2 id="about-passwords" className="text-2xl font-bold tracking-tight text-slate-950">
              Create a strong, unique password
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Longer passwords with a mix of character types are generally harder to guess. Use the controls above to select
              the characters that work for your account, then copy the generated result into a trusted password manager.
              Avoid reusing passwords across accounts. The strength label is an estimate, not a guarantee of account security.
            </p>
          </section>

          <section aria-labelledby="password-faq">
            <h2 id="password-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200">
              {[
                ['How are passwords generated?', 'The generator uses the browser’s cryptographic getRandomValues() API with rejection sampling, so each character selection avoids modulo bias. It does not use Math.random().'],
                ['Are passwords uploaded or saved?', 'No. Password generation runs in your browser, and the generated result is kept only in the current page’s memory. It is not sent to a server or saved by this tool. Copy it to a password manager if you want to keep it.'],
                ['What does “exclude ambiguous characters” do?', 'It removes uppercase I, lowercase l, the number 1, uppercase O, and the number 0. This can make a password easier to read or type.'],
                ['How long should my password be?', 'A longer, unique password is generally preferable. This tool allows 8 to 64 characters; follow the requirements of the service where you plan to use it.'],
                ['What does the strength indicator mean?', 'It gives a simple estimate based on password length and the number of enabled character types. It is not a security guarantee and does not check against known or reused passwords.'],
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
