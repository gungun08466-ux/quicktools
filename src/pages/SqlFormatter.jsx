import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const SAMPLE_SQL = `-- Find active customers and their recent orders
SELECT c.customer_id, c.customer_name, COUNT(o.order_id) AS order_count,
       (SELECT MAX(paid_at) FROM payments p WHERE p.customer_id = c.customer_id) AS last_payment
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id AND o.status = 'paid'
WHERE c.status = 'active' AND c.customer_name <> 'O''Reilly, Inc.'
GROUP BY c.customer_id, c.customer_name
HAVING COUNT(o.order_id) > 0
ORDER BY order_count DESC;

INSERT INTO audit_log (action, note) VALUES ('view', 'Customer list; refreshed');
`

const KEYWORDS = new Set(
  `ADD ALL ALTER AND AS ASC AVG BEGIN BETWEEN BIGINT BINARY BLOB BOOLEAN BY CASE CAST CHAR CHECK CLOB COLLATE COLUMN COMMIT CONSTRAINT COALESCE COUNT CREATE CROSS CURRENT_DATE CURRENT_TIMESTAMP DATABASE DATE DECIMAL DEFAULT DELETE DESC DISTINCT DOUBLE DROP ELSE END ESCAPE EXCEPT EXISTS FALSE FETCH FIRST FLOAT FOREIGN FROM FULL FULLTEXT GROUP HAVING IN INDEX INNER INSERT INT INTEGER INTERSECT INTO IS JOIN KEY LEFT LIKE LIMIT MAX MIN NCHAR NOT NULL NUMERIC NVARCHAR OFFSET ON OR ORDER OUTER PRIMARY REAL REFERENCES RETURNING RIGHT ROLLBACK ROUND ROW ROWS SELECT SET SMALLINT SUM TABLE TEXT THEN TIME TIMESTAMP TOP TRUE UNION UNIQUE UPDATE UPPER LOWER USING VALUES VARBINARY VARCHAR WHEN WHERE WITH`.split(' '),
)

const MULTIWORD_CLAUSES = [
  ['LEFT', 'OUTER', 'JOIN'],
  ['RIGHT', 'OUTER', 'JOIN'],
  ['FULL', 'OUTER', 'JOIN'],
  ['LEFT', 'JOIN'],
  ['RIGHT', 'JOIN'],
  ['FULL', 'JOIN'],
  ['INNER', 'JOIN'],
  ['CROSS', 'JOIN'],
  ['GROUP', 'BY'],
  ['ORDER', 'BY'],
  ['UNION', 'ALL'],
  ['UNION', 'DISTINCT'],
  ['EXCEPT', 'ALL'],
  ['INTERSECT', 'ALL'],
]

const CALL_LIKE_WORDS = new Set(
  `AVG BINARY CAST CHAR COALESCE COUNT DECIMAL DOUBLE FLOAT LOWER MAX MIN NCHAR NUMERIC NVARCHAR REAL ROUND SMALLINT SUM TIME TIMESTAMP UPPER VARBINARY VARCHAR`.split(' '),
)

const OPERATORS = [
  '!~~*', '<=>', '->>', '#>>', '!~~', '~~*', '#>', '->', '=>', '::', ':=', '<=', '>=',
  '<>', '!=', '||', '&&', '<<', '>>', '!~*', '!~', '~*', '+=', '-=', '*=',
  '/=', '%=', '&=', '|=', '^=', '=', '<', '>', '+', '-', '*', '/', '%',
  '~', '^', '|', '&', '!', '?',
]

function isIdentifierStart(character) {
  return Boolean(character && /[A-Za-z_@$#\u0080-\uFFFF]/.test(character))
}

function isIdentifierPart(character) {
  return Boolean(character && /[A-Za-z0-9_$@#\u0080-\uFFFF]/.test(character))
}

function readQuoted(source, start, quote, bracket = false, backslashEscapes = true) {
  let index = start + 1
  while (index < source.length) {
    if (backslashEscapes && source[index] === '\\' && index + 1 < source.length) {
      index += 2
      continue
    }
    if (bracket && source[index] === ']' && source[index + 1] === ']') {
      index += 2
      continue
    }
    if (source[index] === quote) {
      if (source[index + 1] === quote) {
        index += 2
        continue
      }
      return index + 1
    }
    index += 1
  }
  return source.length
}

function tokenizeSql(source) {
  const tokens = []
  let index = 0
  let hadWhitespace = false

  const add = (type, end) => {
    tokens.push({
      type,
      value: source.slice(index, end),
      hadWhitespace,
    })
    index = end
    hadWhitespace = false
  }

  while (index < source.length) {
    const character = source[index]

    if (/\s/.test(character)) {
      hadWhitespace = true
      index += 1
      continue
    }

    if (source.startsWith('--', index)) {
      let end = index + 2
      while (end < source.length && source[end] !== '\n' && source[end] !== '\r') end += 1
      add('lineComment', end)
      continue
    }

    if (source.startsWith('/*', index)) {
      let end = index + 2
      let depth = 1
      while (end < source.length && depth > 0) {
        if (source.startsWith('/*', end)) {
          depth += 1
          end += 2
        } else if (source.startsWith('*/', end)) {
          depth -= 1
          end += 2
        } else {
          end += 1
        }
      }
      add('blockComment', end)
      continue
    }

    const dollarQuote = source.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)
    if (dollarQuote) {
      const delimiter = dollarQuote[0]
      const close = source.indexOf(delimiter, index + delimiter.length)
      add('string', close === -1 ? source.length : close + delimiter.length)
      continue
    }

    const prefixedString = /^[eEnNxXbB]'/.test(source.slice(index))
    if (prefixedString) {
      const end = readQuoted(source, index + 1, "'", false, true)
      add('string', end)
      continue
    }

    if (character === "'") {
      add('string', readQuoted(source, index, "'", false, true))
      continue
    }

    if (character === '"' || character === '`') {
      add('quotedIdentifier', readQuoted(source, index, character, false, true))
      continue
    }

    if (character === '[') {
      const end = readQuoted(source, index, ']', true, false)
      if (end > index + 1 && source[end - 1] === ']') {
        add('quotedIdentifier', end)
        continue
      }
      add('symbol', index + 1)
      continue
    }

    if (/\d/.test(character) || (character === '.' && /\d/.test(source[index + 1] || ''))) {
      const startsWithDecimalPoint = character === '.'
      let end = index + 1
      while (/\d/.test(source[end] || '')) end += 1
      if (!startsWithDecimalPoint && source[end] === '.' && /\d/.test(source[end + 1] || '')) {
        end += 1
        while (/\d/.test(source[end] || '')) end += 1
      }
      if (/[eE]/.test(source[end] || '')) {
        let exponentEnd = end + 1
        if (/[+-]/.test(source[exponentEnd] || '')) exponentEnd += 1
        const digitStart = exponentEnd
        while (/\d/.test(source[exponentEnd] || '')) exponentEnd += 1
        if (exponentEnd > digitStart) end = exponentEnd
      }
      add('number', end)
      continue
    }

    if (isIdentifierStart(character)) {
      let end = index + 1
      while (isIdentifierPart(source[end])) end += 1
      add('word', end)
      continue
    }

    if (character === ':' && isIdentifierStart(source[index + 1])) {
      let end = index + 2
      while (isIdentifierPart(source[end])) end += 1
      add('word', end)
      continue
    }

    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index))
    if (operator) {
      add('operator', index + operator.length)
      continue
    }

    add('symbol', index + 1)
  }

  return tokens
}

function keywordValue(token, keywordCase) {
  if (token.type !== 'word' || !KEYWORDS.has(token.value.toUpperCase())) return token.value
  return keywordCase === 'lowercase'
    ? token.value.toLowerCase()
    : token.value.toUpperCase()
}

function tokenWord(token) {
  return token?.type === 'word' ? token.value.toUpperCase() : ''
}

function matchClause(tokens, index) {
  for (const words of MULTIWORD_CLAUSES) {
    if (words.every((word, offset) => tokenWord(tokens[index + offset]) === word)) {
      return { length: words.length, words }
    }
  }
  return null
}

function isCreateTableList(tokens, openIndex) {
  for (let index = openIndex - 1; index >= 0; index -= 1) {
    const word = tokenWord(tokens[index])
    if (tokens[index].value === ';') return false
    if (tokens[index].value === '(') return false
    if (word === 'TABLE') {
      for (let prior = index - 1; prior >= 0; prior -= 1) {
        if (tokens[prior].value === ';') return false
        if (tokenWord(tokens[prior]) === 'CREATE') return true
      }
    }
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(word)) return false
  }
  return false
}

function formatSql(tokens, indentationSize, keywordCase) {
  let output = ''
  let depth = 0
  let atLineStart = true
  let lineIndent = 0
  const parenStack = []
  const selectLists = new Set()
  const updateLists = new Set()
  const valuesLists = new Set()
  const queryIndents = new Map()

  const indent = (level) => ' '.repeat(Math.max(0, level) * indentationSize)
  const indentLevel = (extra = 0) => depth + extra
  const write = (value, spaceBefore = false, level = lineIndent) => {
    if (!value) return
    if (atLineStart) {
      output += indent(level)
      lineIndent = level
      atLineStart = false
    } else if (spaceBefore && !/[ \t\n\r]$/.test(output)) {
      output += ' '
    }
    output += value
    if (value.endsWith('\n') || value.endsWith('\r')) atLineStart = true
  }
  const newline = (level = depth) => {
    if (output && !/[\r\n]$/.test(output)) output += '\n'
    atLineStart = true
    lineIndent = level
  }
  const clearStatementLists = () => {
    selectLists.delete(depth)
    updateLists.delete(depth)
    valuesLists.delete(depth)
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const previous = tokens[index - 1]
    const word = tokenWord(token)
    const previousWord = tokenWord(previous)

    if (token.type === 'lineComment') {
      write(token.value, Boolean(previous && previous.type !== 'lineComment'))
      if (index + 1 < tokens.length) newline(indentLevel())
      continue
    }

    if (token.type === 'blockComment') {
      write(token.value, Boolean(previous))
      continue
    }

    if (token.value === ';') {
      write(';')
      clearStatementLists()
      queryIndents.delete(depth)
      if (index + 1 < tokens.length) newline(indentLevel())
      continue
    }

    if (token.value === ')') {
      const context = parenStack.pop()
      if (context?.type === 'subquery' || context?.type === 'list') {
        if (previous?.value !== '(') newline(context.openIndent)
      }
      if (context?.type === 'subquery') queryIndents.delete(depth)
      depth = Math.max(0, depth - 1)
      write(')')
      continue
    }

    if (token.value === '(') {
      const next = tokens[index + 1]
      const subquery = ['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE'].includes(tokenWord(next))
      const createList = isCreateTableList(tokens, index)
      const insertList = (() => {
        if (!previous || previous.type !== 'word' || previousWord === 'VALUES') return false
        for (let prior = index - 1; prior >= 0; prior -= 1) {
          if (tokens[prior].value === ';') return false
          const priorWord = tokenWord(tokens[prior])
          if (priorWord === 'INTO') return tokenWord(tokens[prior - 1]) === 'INSERT'
          if (['SELECT', 'UPDATE', 'DELETE'].includes(priorWord)) return false
        }
        return false
      })()
      const isFunction = previous?.type === 'word'
        && (!KEYWORDS.has(previousWord) || CALL_LIKE_WORDS.has(previousWord))
        && !createList
        && !insertList
      const context = subquery
        ? 'subquery'
        : createList || insertList || (['IN', 'NOT'].includes(previousWord) && next?.value !== ')')
          ? 'list'
          : isFunction || previousWord === 'VALUES'
            ? 'inline'
            : 'inline'

      write('(', Boolean(previous) && !isFunction)
      const openIndent = lineIndent
      depth += 1
      parenStack.push({ type: context, openIndent })
      if (context === 'subquery' || context === 'list') newline(openIndent + 1)
      continue
    }

    if (token.value === ',') {
      write(',')
      const currentList = parenStack[parenStack.length - 1]
      const selectOrUpdateList = selectLists.has(depth) || updateLists.has(depth)
      const listActive = selectOrUpdateList || valuesLists.has(depth) || currentList?.type === 'list'
      if (listActive && tokens[index + 1]?.value !== ')') {
        const nextIndent = selectOrUpdateList
          ? (queryIndents.get(depth) ?? depth) + 1
          : currentList?.type === 'list'
            ? currentList.openIndent + 1
            : indentLevel(1)
        newline(nextIndent)
      } else {
        write(' ', false)
      }
      continue
    }

    if (word === 'SELECT') {
      if (!atLineStart && output) newline(indentLevel())
      write(keywordValue(token, keywordCase))
      queryIndents.set(depth, lineIndent)
      selectLists.add(depth)
      newline(lineIndent + 1)
      continue
    }

    const compound = matchClause(tokens, index)
    if (compound) {
      const clauseText = compound.words
        .map((part, offset) => keywordValue(tokens[index + offset], keywordCase))
        .join(' ')
      if (!atLineStart) newline(queryIndents.get(depth) ?? indentLevel())
      clearStatementLists()
      write(clauseText)
      index += compound.length - 1
      continue
    }

    if (['FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'RETURNING', 'UNION', 'EXCEPT', 'INTERSECT', 'JOIN', 'ON', 'SET', 'VALUES'].includes(word)) {
      const deleteFrom = word === 'FROM' && previousWord === 'DELETE'
      if (!atLineStart && !deleteFrom) newline(queryIndents.get(depth) ?? indentLevel())
      if (word === 'FROM' || word === 'WHERE' || word === 'HAVING' || word === 'UNION' || word === 'EXCEPT' || word === 'INTERSECT') {
        selectLists.delete(depth)
      }
      if (word === 'SET') updateLists.add(depth)
      if (word === 'VALUES') valuesLists.add(depth)
      write(keywordValue(token, keywordCase), deleteFrom && Boolean(previous))
      if (word === 'VALUES') newline(indentLevel(1))
      continue
    }

    if (word === 'AND' || word === 'OR') {
      if (!atLineStart) newline((queryIndents.get(depth) ?? indentLevel()) + 1)
      write(keywordValue(token, keywordCase))
      continue
    }

    if (token.value === '.') {
      const hasNumericNeighbor = previous?.type === 'number' || tokens[index + 1]?.type === 'number'
      write('.', hasNumericNeighbor && token.hadWhitespace)
      continue
    }

    if (token.type === 'operator') {
      write(token.value, Boolean(previous))
      continue
    }

    const isWordLike = ['word', 'number', 'string', 'quotedIdentifier'].includes(token.type)
    const previousWordLike = previous && ['word', 'number', 'string', 'quotedIdentifier'].includes(previous.type)
    const separated = token.value === ':' || token.value === '?'
      ? Boolean(previousWordLike)
      : Boolean(previous?.type === 'operator' && isWordLike)
    const followsClosingParen = previous?.value === ')' && isWordLike
    const spacedNumericDot = token.type === 'number' && previous?.value === '.' && token.hadWhitespace
    write(keywordValue(token, keywordCase), separated || followsClosingParen || spacedNumericDot || (isWordLike && previousWordLike))
  }

  return output
}

function needsMinifySeparator(previous, current) {
  if (!previous) return false
  if (previous.type === 'lineComment') return false
  if (current.type === 'lineComment' || current.type === 'blockComment' || previous.type === 'blockComment') return true
  if (previous.type === 'operator' && current.type === 'operator') return true
  if (previous.type === 'number' && current.value === '.') return current.hadWhitespace
  if (previous.value === '.' && current.type === 'number') return current.hadWhitespace

  const wordLike = (token) => ['word', 'number'].includes(token.type)
  if (wordLike(previous) && wordLike(current)) return true
  if (
    ['string', 'quotedIdentifier'].includes(previous.type)
    && ['word', 'number', 'string', 'quotedIdentifier'].includes(current.type)
  ) return true
  if (
    ['word', 'number'].includes(previous.type)
    && ['string', 'quotedIdentifier'].includes(current.type)
  ) return true

  return false
}

function minifySql(tokens, keywordCase) {
  let output = ''
  let previous = null
  tokens.forEach((token, index) => {
    if (needsMinifySeparator(previous, token)) {
      output += previous.type === 'lineComment' ? '\n' : ' '
    }
    output += keywordValue(token, keywordCase)
    if (token.type === 'lineComment' && index + 1 < tokens.length) output += '\n'
    previous = token
  })
  return output
}

function countLines(value) {
  return value ? value.split(/\r\n|\r|\n/).length : 0
}

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'
  const Icon = isError ? AlertCircle : Check

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
      <Icon aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
      <p>{status.message}</p>
    </div>
  )
}

export default function SqlFormatter() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indentationSize, setIndentationSize] = useState(2)
  const [keywordCase, setKeywordCase] = useState('uppercase')
  const [status, setStatus] = useState(null)
  const stats = useMemo(() => ({
    inputCharacters: input.length,
    inputLines: countLines(input),
    outputCharacters: output.length,
    outputLines: countLines(output),
  }), [input, output])

  const updateInput = (value) => {
    setInput(value)
    setOutput('')
    setStatus(null)
  }

  const updateIndentation = (value) => {
    setIndentationSize(Number(value))
    setOutput('')
    setStatus(null)
  }

  const updateKeywordCase = (value) => {
    setKeywordCase(value)
    setOutput('')
    setStatus(null)
  }

  const runAction = (action) => {
    if (!input.trim()) {
      setOutput('')
      setStatus({ type: 'error', message: 'Enter SQL before formatting or minifying.' })
      return
    }

    try {
      const tokens = tokenizeSql(input)
      const result = action === 'format'
        ? formatSql(tokens, indentationSize, keywordCase)
        : minifySql(tokens, keywordCase)
      setOutput(result)
      setStatus({
        type: 'success',
        message: action === 'format'
          ? 'SQL formatted. Formatting does not validate or execute the query.'
          : 'SQL minified. Formatting does not validate or execute the query.',
      })
    } catch (error) {
      setOutput('')
      setStatus({
        type: 'error',
        message: error instanceof Error ? `Could not process this SQL: ${error.message}` : 'Could not process this SQL.',
      })
    }
  }

  const copyOutput = async () => {
    if (!output) return
    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      setStatus({ type: 'success', message: 'SQL output copied to the clipboard.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the SQL. Check clipboard permissions and try again.' })
    }
  }

  const downloadOutput = () => {
    if (!output) return

    try {
      const blob = new Blob([output], { type: 'text/sql;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'formatted.sql'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'SQL download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? `Could not create the SQL download: ${error.message}` : 'Could not create the SQL download.',
      })
    }
  }

  const loadSample = () => {
    setInput(SAMPLE_SQL)
    setOutput('')
    setStatus({ type: 'success', message: 'Sample SQL loaded. Choose Format or Minify.' })
  }

  const clearAll = () => {
    setInput('')
    setOutput('')
    setIndentationSize(2)
    setKeywordCase('uppercase')
    setStatus(null)
  }

  return (
    <>
      <PageMetadata
        title="SQL Formatter - Format and Minify SQL Online"
        description="Format or minify SQL in your browser with configurable indentation and keyword case. Strings, quoted identifiers, comments, and operators are preserved; queries are not validated or executed."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">SQL Formatter</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Format or minify SQL locally in your browser. Adjust indentation
            and keyword case while keeping query text, quoted names, comments,
            and operators intact.
          </p>
        </header>

        <section aria-label="SQL formatter" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-950">SQL input</h2>
              <p className="mt-1 text-sm text-slate-500">
                Paste SQL or use the sample to explore the formatter.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="sql-indentation" className="mb-1 block text-xs font-medium text-slate-600">
                  Indentation
                </label>
                <select
                  id="sql-indentation"
                  value={indentationSize}
                  onChange={(event) => updateIndentation(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </div>
              <div>
                <label htmlFor="sql-keyword-case" className="mb-1 block text-xs font-medium text-slate-600">
                  Keyword case
                </label>
                <select
                  id="sql-keyword-case"
                  value={keywordCase}
                  onChange={(event) => updateKeywordCase(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="uppercase">UPPERCASE</option>
                  <option value="lowercase">lowercase</option>
                </select>
              </div>
              <button type="button" onClick={loadSample} className="tool-secondary-button px-3">
                <Sparkles aria-hidden="true" size={16} />
                Insert sample
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!input && !output && !status && indentationSize === 2 && keywordCase === 'uppercase'}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="sql-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="sql-input-heading" className="font-semibold text-slate-950">SQL editor</h3>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {stats.inputCharacters} characters · {stats.inputLines} lines
                </span>
              </div>
              <textarea
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder="Paste SQL here, or insert the sample query..."
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="SQL input editor"
                className="tool-editor mt-2 min-h-72 w-full resize-y p-4 sm:min-h-[26rem]"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => runAction('format')} className="tool-primary-button">
                  <Sparkles aria-hidden="true" size={16} />
                  Format SQL
                </button>
                <button type="button" onClick={() => runAction('minify')} className="tool-secondary-button">
                  <Minimize2 aria-hidden="true" size={16} />
                  Minify SQL
                </button>
              </div>
            </section>

            <section aria-labelledby="sql-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="sql-output-heading" className="font-semibold text-slate-950">SQL output</h3>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {stats.outputCharacters} characters · {stats.outputLines} lines
                </span>
              </div>
              <textarea
                value={output}
                readOnly
                placeholder="Formatted or minified SQL will appear here..."
                spellCheck="false"
                aria-label="SQL output"
                className="tool-editor mt-2 min-h-72 w-full resize-y p-4 sm:min-h-[26rem]"
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={copyOutput} disabled={!output} className="tool-secondary-button">
                  <ClipboardCopy aria-hidden="true" size={16} />
                  Copy output
                </button>
                <button type="button" onClick={downloadOutput} disabled={!output} className="tool-secondary-button">
                  <Download aria-hidden="true" size={16} />
                  Download .sql
                </button>
              </div>
            </section>
          </div>

          {status && <div className="mt-4"><StatusMessage status={status} /></div>}

          <div aria-label="SQL character and line counts" className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['Input characters', stats.inputCharacters],
              ['Input lines', stats.inputLines],
              ['Output characters', stats.outputCharacters],
              ['Output lines', stats.outputLines],
            ].map(([label, count]) => (
              <div key={label} className="tool-stat-tile">
                <p className="text-slate-500">{label}</p>
                <p className="mt-1 font-semibold tabular-nums text-slate-900">{count}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mx-auto mt-4 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          This formatter changes SQL layout and optionally keyword capitalization. It does not validate or execute SQL;
          review the output in your database environment before using it.
        </p>

        <div className="mx-auto mt-16 max-w-4xl space-y-12 sm:mt-20">
          <section aria-labelledby="what-is-sql-formatting">
            <h2 id="what-is-sql-formatting" className="text-2xl font-bold tracking-tight text-slate-950">
              What Is SQL Formatting?
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              SQL formatting arranges query clauses, expressions, and comments
              with consistent spacing and indentation. It can make statements
              such as SELECT queries, data changes, and table definitions easier
              to review. This tool uses a lightweight tokenizer and is intended
              for readability, not SQL parsing, validation, or execution.
            </p>
          </section>

          <section aria-labelledby="how-to-format-sql">
            <h2 id="how-to-format-sql" className="text-2xl font-bold tracking-tight text-slate-950">
              How to Format SQL
            </h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Add your query', 'Paste SQL in the input editor or select Insert sample to try a representative query.'],
                ['Choose options', 'Select two- or four-space indentation and uppercase or lowercase SQL keywords.'],
                ['Format or minify', 'Choose Format SQL for readable clauses and indentation, or Minify SQL to remove unnecessary spacing.'],
                ['Copy or save', 'Copy the output or download it as a .sql file. The query stays in your browser.'],
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

          <section aria-labelledby="sql-faq">
            <h2 id="sql-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['Does this SQL formatter validate or run queries?', 'No. It only rearranges SQL text for readability or compactness. It does not connect to a database, validate syntax, or execute queries.'],
                ['Which SQL statements are supported?', 'The formatter handles common SQL clauses and statements, including SELECT, joins, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, grouping, ordering, and nested queries. It is not a full SQL parser and dialect-specific constructs may need manual review.'],
                ['Are strings, identifiers, and comments changed?', 'Quoted strings, quoted identifiers, comments, and operators are treated as separate tokens and retained. SQL keywords outside quoted values and comments can be uppercased or lowercased.'],
                ['Does minifying SQL change query meaning?', 'Minification removes only spacing that the tokenizer considers unnecessary and keeps separators where adjacent tokens could merge. As with any lightweight formatter, review dialect-specific SQL before using it.'],
                ['Is my query uploaded?', 'No. Formatting happens locally in your browser; the query is not sent to a QuickTools processing server.'],
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
