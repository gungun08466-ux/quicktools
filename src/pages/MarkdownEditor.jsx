import {
  ClipboardCopy,
  Download,
  Eraser,
  Sparkles,
} from 'lucide-react'
import { Fragment, useMemo, useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const SAMPLE_MARKDOWN = `# Markdown editor example

Write **bold text**, *italic text*, or ~~strikethrough~~. Links can point to [safe websites](https://example.com).

> Blockquotes make important notes stand out.

## A few useful lists

- A bulleted item
- [x] A completed task
- [ ] A task to do

1. First ordered item
2. Second ordered item

| Feature | Supported |
| --- | --- |
| Unicode | Yes — नमस्ते 🌟 |
| Preview | Live |

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`
}
\`\`\`
`

const graphemeSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : null

function countCharacters(value) {
  if (!value) return 0
  if (graphemeSegmenter) {
    let count = 0
    for (const _segment of graphemeSegmenter.segment(value)) count += 1
    return count
  }
  return Array.from(value).length
}

function unescapeMarkdown(value) {
  return value.replace(/\\([\\`*_{}[\]()#+.!|>~-])/g, '$1')
}

function safeHref(destination) {
  const cleaned = unescapeMarkdown(destination).trim()
  if (!cleaned) return null

  const protocolCheck = cleaned.replace(/[\u0000-\u0020\u007f]/g, '')
  try {
    const url = new URL(protocolCheck, 'https://quicktools.invalid/')
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null
    return cleaned.replace(/[\u0000-\u001f\u007f]/g, '')
  } catch {
    return null
  }
}

function findUnescaped(text, token, start) {
  let position = text.indexOf(token, start)
  while (position !== -1) {
    let backslashes = 0
    for (let index = position - 1; index >= 0 && text[index] === '\\'; index -= 1) {
      backslashes += 1
    }
    if (backslashes % 2 === 0) return position
    position = text.indexOf(token, position + token.length)
  }
  return -1
}

function findLink(text, start) {
  let bracketDepth = 1
  let labelEnd = -1

  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === '\\') {
      index += 1
      continue
    }
    if (text[index] === '[') bracketDepth += 1
    if (text[index] === ']') {
      bracketDepth -= 1
      if (!bracketDepth) {
        labelEnd = index
        break
      }
    }
  }

  if (labelEnd === -1 || text[labelEnd + 1] !== '(') return null

  let parentheses = 1
  let end = -1
  for (let index = labelEnd + 2; index < text.length; index += 1) {
    if (text[index] === '\\') {
      index += 1
      continue
    }
    if (text[index] === '(') parentheses += 1
    if (text[index] === ')') {
      parentheses -= 1
      if (!parentheses) {
        end = index
        break
      }
    }
  }
  if (end === -1) return null

  const destinationAndTitle = text.slice(labelEnd + 2, end).trim()
  let destination = ''
  if (destinationAndTitle.startsWith('<')) {
    const closingAngle = destinationAndTitle.indexOf('>')
    if (closingAngle === -1) return null
    destination = destinationAndTitle.slice(1, closingAngle)
  } else {
    let depth = 0
    for (let index = 0; index < destinationAndTitle.length; index += 1) {
      const character = destinationAndTitle[index]
      if (character === '\\') {
        index += 1
        continue
      }
      if (character === '(') depth += 1
      if (character === ')') depth -= 1
      if (/\s/.test(character) && depth === 0) break
      destination += character
    }
  }

  return {
    end: end + 1,
    label: text.slice(start + 1, labelEnd),
    href: destination,
  }
}

function renderInline(text, keyPrefix) {
  const nodes = []
  let plainText = ''
  let index = 0
  let partIndex = 0

  const flushText = () => {
    if (!plainText) return
    nodes.push(plainText)
    plainText = ''
  }
  const addElement = (element) => {
    flushText()
    nodes.push(<Fragment key={`${keyPrefix}-${partIndex}`}>{element}</Fragment>)
    partIndex += 1
  }

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length && /[\\`*_{}[\]()#+.!|>~-]/.test(text[index + 1])) {
      plainText += text[index + 1]
      index += 2
      continue
    }

    if (text[index] === '`') {
      let tickCount = 1
      while (text[index + tickCount] === '`') tickCount += 1
      const delimiter = '`'.repeat(tickCount)
      const closing = findUnescaped(text, delimiter, index + tickCount)
      if (closing !== -1) {
        let content = text.slice(index + tickCount, closing).replace(/\n/g, ' ')
        if (content.startsWith(' ') && content.endsWith(' ') && content.trim()) {
          content = content.slice(1, -1)
        }
        addElement(
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-fuchsia-800">
            {content}
          </code>,
        )
        index = closing + tickCount
        continue
      }
    }

    if (text[index] === '[') {
      const link = findLink(text, index)
      if (link) {
        const href = safeHref(link.href)
        if (href) {
          addElement(
            <a
              href={href}
              className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900"
            >
              {renderInline(link.label, `${keyPrefix}-link-${partIndex}`)}
            </a>,
          )
        } else {
          flushText()
          nodes.push(
            ...renderInline(link.label, `${keyPrefix}-unsafe-link-${partIndex}`),
          )
          partIndex += 1
        }
        index = link.end
        continue
      }
    }

    const delimiters = [
      { marker: '**', tag: 'strong' },
      { marker: '__', tag: 'strong' },
      { marker: '~~', tag: 'del' },
      { marker: '*', tag: 'em' },
      { marker: '_', tag: 'em' },
    ]
    const emphasis = delimiters.find(({ marker }) => text.startsWith(marker, index))
    if (emphasis) {
      const closing = findUnescaped(text, emphasis.marker, index + emphasis.marker.length)
      if (closing > index + emphasis.marker.length) {
        const content = text.slice(index + emphasis.marker.length, closing)
        const Tag = emphasis.tag
        addElement(
          <Tag className={emphasis.tag === 'strong' ? 'font-bold' : emphasis.tag === 'del' ? 'line-through' : 'italic'}>
            {renderInline(content, `${keyPrefix}-em-${partIndex}`)}
          </Tag>,
        )
        index = closing + emphasis.marker.length
        continue
      }
    }

    if (text[index] === '\n') {
      addElement(<br />)
      index += 1
      continue
    }

    plainText += text[index]
    index += 1
  }

  flushText()
  return nodes.map((node, nodeIndex) =>
    typeof node === 'string'
      ? <Fragment key={`${keyPrefix}-text-${nodeIndex}`}>{node}</Fragment>
      : node,
  )
}

function parseListMarker(line) {
  const match = line.match(/^([ \t]{0,3})([-+*]|\d+[.)])[ \t]+(.*)$/)
  if (!match) return null
  return {
    indent: match[1].length,
    ordered: /^\d/.test(match[2]),
    content: match[3],
  }
}

function splitTableRow(row) {
  let value = row.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1)

  const cells = []
  let cell = ''
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\\' && value[index + 1] === '|') {
      cell += '\\|'
      index += 1
    } else if (value[index] === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += value[index]
    }
  }
  cells.push(cell.trim())
  return cells
}

function isTableSeparator(line) {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isBlockStart(lines, index) {
  const line = lines[index]
  return /^ {0,3}(?:#{1,6}(?:[ \t]+|$)|>|`{3,}|~{3,})/.test(line)
    || /^ {0,3}(?:-{3,}|_{3,}|\*{3,})[ \t]*$/.test(line)
    || Boolean(parseListMarker(line))
}

function renderMarkdownBlocks(source, keyPrefix = 'md') {
  const lines = source.split(/\r\n|\r|\n/)
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }
    const key = `${keyPrefix}-block-${index}`

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      const marker = fence[1][0]
      const minimumLength = fence[1].length
      const language = fence[2].trim().split(/\s+/)[0]
      const codeLines = []
      index += 1
      while (index < lines.length) {
        const closing = lines[index].match(/^ {0,3}(`+|~+)[ \t]*$/)
        if (closing && closing[1][0] === marker && closing[1].length >= minimumLength) {
          index += 1
          break
        }
        codeLines.push(lines[index])
        index += 1
      }
      blocks.push(
        <div key={key} className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {language && (
            <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium text-slate-400">
              {language}
            </div>
          )}
          <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      )
      continue
    }

    const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/)
    if (heading) {
      const level = heading[1].length
      const Tag = `h${level}`
      const styles = [
        'mb-4 mt-6 text-3xl font-bold tracking-tight text-slate-950',
        'mb-3 mt-6 text-2xl font-bold tracking-tight text-slate-950',
        'mb-3 mt-5 text-xl font-bold text-slate-950',
        'mb-2 mt-4 text-lg font-bold text-slate-950',
        'mb-2 mt-4 text-base font-bold text-slate-950',
        'mb-2 mt-3 text-sm font-bold text-slate-950',
      ]
      blocks.push(
        <Tag key={key} className={styles[level - 1]}>
          {renderInline(heading[2], `${key}-inline`)}
        </Tag>,
      )
      index += 1
      continue
    }

    if (
      index + 1 < lines.length
      && line.trim()
      && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[index + 1])
    ) {
      const Tag = lines[index + 1].trim().startsWith('=') ? 'h1' : 'h2'
      blocks.push(
        <Tag key={key} className={Tag === 'h1' ? 'mb-4 mt-6 text-3xl font-bold tracking-tight text-slate-950' : 'mb-3 mt-6 text-2xl font-bold tracking-tight text-slate-950'}>
          {renderInline(line.trim(), `${key}-inline`)}
        </Tag>,
      )
      index += 2
      continue
    }

    if (
      index + 1 < lines.length
      && line.includes('|')
      && isTableSeparator(lines[index + 1])
    ) {
      const headers = splitTableRow(line)
      index += 2
      const rows = []
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      blocks.push(
        <div key={key} className="my-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={`${key}-head-${cellIndex}`} className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {renderInline(header, `${key}-header-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`} className="bg-white">
                  {headers.map((_, cellIndex) => (
                    <td key={`${key}-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-700">
                      {renderInline(row[cellIndex] ?? '', `${key}-cell-inline-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^ {0,3}(?:-{3,}|_{3,}|\*{3,})[ \t]*$/.test(line)) {
      blocks.push(<hr key={key} className="my-6 border-slate-200" />)
      index += 1
      continue
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines = []
      while (index < lines.length) {
        const quoteLine = lines[index].match(/^ {0,3}>[ \t]?(.*)$/)
        if (quoteLine) {
          quoteLines.push(quoteLine[1])
          index += 1
        } else if (
          !lines[index].trim()
          && index + 1 < lines.length
          && /^ {0,3}>/.test(lines[index + 1])
        ) {
          quoteLines.push('')
          index += 1
        } else {
          break
        }
      }
      blocks.push(
        <blockquote key={key} className="my-4 border-l-4 border-indigo-300 bg-indigo-50/60 py-2 pl-4 pr-3 text-slate-700">
          {renderMarkdownBlocks(quoteLines.join('\n'), `${key}-quote`)}
        </blockquote>,
      )
      continue
    }

    const firstMarker = parseListMarker(line)
    if (firstMarker) {
      const items = []
      while (index < lines.length) {
        const marker = parseListMarker(lines[index])
        if (!marker || marker.indent !== firstMarker.indent || marker.ordered !== firstMarker.ordered) break

        const itemLines = [marker.content]
        index += 1
        while (index < lines.length) {
          if (!lines[index].trim()) {
            const nextMarker = index + 1 < lines.length ? parseListMarker(lines[index + 1]) : null
            if (nextMarker && nextMarker.indent === firstMarker.indent && nextMarker.ordered === firstMarker.ordered) break
            if (index + 1 < lines.length && /^[ \t]+/.test(lines[index + 1])) {
              itemLines.push('')
              index += 1
              continue
            }
            break
          }

          const nextMarker = parseListMarker(lines[index])
          if (nextMarker && nextMarker.indent === firstMarker.indent) break
          const leadingIndent = lines[index].match(/^[ \t]*/)[0].length
          if (leadingIndent > firstMarker.indent) {
            itemLines.push(lines[index].slice(Math.min(firstMarker.indent + 2, leadingIndent)))
            index += 1
            continue
          }
          break
        }

        const task = itemLines[0].match(/^\[([ xX])\][ \t]+(.*)$/)
        if (task) itemLines[0] = task[2]
        items.push({ lines: itemLines, task: task ? task[1].toLowerCase() === 'x' : null })
      }

      const ListTag = firstMarker.ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag
          key={key}
          className={`my-4 space-y-2 pl-6 text-slate-700 ${
            firstMarker.ordered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`} className={item.task !== null ? 'list-none -ml-6' : ''}>
              <div className={item.task !== null ? 'flex items-start gap-2' : undefined}>
                {item.task !== null && (
                  <input
                    type="checkbox"
                    checked={item.task}
                    disabled
                    readOnly
                    aria-label={item.task ? 'Completed task' : 'Incomplete task'}
                    className="mt-1 accent-indigo-600"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {renderMarkdownBlocks(item.lines.join('\n'), `${key}-item-${itemIndex}`)}
                </div>
              </div>
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    const paragraphLines = [line]
    index += 1
    while (
      index < lines.length
      && lines[index].trim()
      && !isBlockStart(lines, index)
      && !(index + 1 < lines.length && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[index + 1]))
      && !(index + 1 < lines.length && lines[index].includes('|') && isTableSeparator(lines[index + 1]))
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }
    blocks.push(
      <p key={key} className="mb-4 whitespace-pre-wrap leading-7 text-slate-700 last:mb-0">
        {renderInline(paragraphLines.join('\n'), `${key}-inline`)}
      </p>,
    )
  }

  return blocks
}

function countWords(value) {
  const countable = value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}[ \t]+|>[ \t]?)/gm, '')
    .replace(/^\s{0,3}(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/gm, '')
    .replace(/^\s*(?:`{3,}|~{3,})[^\r\n]*$/gm, '')
    .replace(/^\s*\|?[ \t:|-]+\|?[ \t]*$/gm, '')
    .replace(/[|`*_~]/g, ' ')
  const matches = countable.match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['’][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu)
  return matches?.length ?? 0
}

const TOOLBAR_ACTIONS = [
  { label: 'Heading', display: 'H', type: 'prefix', prefix: '## ', placeholder: 'Heading' },
  { label: 'Bold', display: 'B', type: 'wrap', before: '**', after: '**', placeholder: 'bold text', className: 'font-bold' },
  { label: 'Italic', display: 'I', type: 'wrap', before: '*', after: '*', placeholder: 'italic text', className: 'italic' },
  { label: 'Strikethrough', display: 'S', type: 'wrap', before: '~~', after: '~~', placeholder: 'strikethrough', className: 'line-through' },
  { label: 'Link', display: 'Link', type: 'wrap', before: '[', after: '](https://example.com)', placeholder: 'link text' },
  { label: 'Blockquote', display: 'Quote', type: 'prefix', prefix: '> ', placeholder: 'quoted text' },
  { label: 'Bulleted list', display: '• List', type: 'prefix', prefix: '- ', placeholder: 'list item' },
  { label: 'Numbered list', display: '1. List', type: 'prefix', prefix: '1. ', placeholder: 'list item' },
  { label: 'Task list', display: 'Task', type: 'prefix', prefix: '- [ ] ', placeholder: 'task item' },
  { label: 'Code block', display: 'Code', type: 'wrap', before: '```\n', after: '\n```', placeholder: 'code' },
]

function StatusMessage({ status }) {
  if (!status) return null
  const isError = status.type === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      {status.message}
    </div>
  )
}

export default function MarkdownEditor() {
  const [markdown, setMarkdown] = useState('')
  const [view, setView] = useState('split')
  const [status, setStatus] = useState(null)
  const editorRef = useRef(null)
  const previewRef = useRef(null)

  const preview = useMemo(
    () => renderMarkdownBlocks(markdown),
    [markdown],
  )
  const words = countWords(markdown)
  const characters = countCharacters(markdown)
  const lines = markdown ? markdown.split(/\r\n|\r|\n/).length : 0

  const updateMarkdown = (value) => {
    setMarkdown(value)
    setStatus(null)
  }

  const replaceSelection = (before, after, placeholder) => {
    const editor = editorRef.current
    const start = editor?.selectionStart ?? markdown.length
    const end = editor?.selectionEnd ?? markdown.length
    const selected = markdown.slice(start, end)
    const content = selected || placeholder
    const replacement = `${before}${content}${after}`
    const nextValue = `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`

    setMarkdown(nextValue)
    setStatus(null)
    requestAnimationFrame(() => {
      if (!editor) return
      editor.focus()
      const selectionStart = start + before.length
      editor.setSelectionRange(selectionStart, selectionStart + content.length)
    })
  }

  const prefixSelectionLines = (prefix, placeholder) => {
    const editor = editorRef.current
    const start = editor?.selectionStart ?? markdown.length
    const end = editor?.selectionEnd ?? markdown.length
    const selected = markdown.slice(start, end)
    const content = selected || placeholder
    const replacement = content.split(/\r\n|\r|\n/).map((line) => `${prefix}${line}`).join('\n')
    const nextValue = `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`

    setMarkdown(nextValue)
    setStatus(null)
    requestAnimationFrame(() => {
      if (!editor) return
      editor.focus()
      editor.setSelectionRange(start, start + replacement.length)
    })
  }

  const applyToolbarAction = (action) => {
    if (action.type === 'prefix') {
      prefixSelectionLines(action.prefix, action.placeholder)
    } else {
      replaceSelection(action.before, action.after, action.placeholder)
    }
  }

  const insertTable = () => {
    const editor = editorRef.current
    const start = editor?.selectionStart ?? markdown.length
    const end = editor?.selectionEnd ?? markdown.length
    const table = '| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |'
    const nextValue = `${markdown.slice(0, start)}${table}${markdown.slice(end)}`

    setMarkdown(nextValue)
    setStatus(null)
    requestAnimationFrame(() => {
      if (!editor) return
      editor.focus()
      editor.setSelectionRange(start, start + table.length)
    })
  }

  const loadSample = () => {
    setMarkdown(SAMPLE_MARKDOWN)
    setView('split')
    setStatus(null)
  }

  const copyMarkdown = async () => {
    if (!markdown) return
    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }

    try {
      await navigator.clipboard.writeText(markdown)
      setStatus({ type: 'success', message: 'Markdown source copied to the clipboard.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the Markdown source. Check clipboard permissions and try again.' })
    }
  }

  const copyPreviewText = async () => {
    const previewText = previewRef.current?.innerText ?? ''
    if (!previewText) return
    if (!navigator.clipboard?.writeText) {
      setStatus({ type: 'error', message: 'Clipboard access is unavailable in this browser or page context.' })
      return
    }

    try {
      await navigator.clipboard.writeText(previewText)
      setStatus({ type: 'success', message: 'Preview text copied to the clipboard.' })
    } catch {
      setStatus({ type: 'error', message: 'Could not copy the preview text. Check clipboard permissions and try again.' })
    }
  }

  const downloadMarkdown = () => {
    if (!markdown) return

    try {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'document.md'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'Markdown download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not create the Markdown download: ${error.message}`
          : 'Could not create the Markdown download. Try copying the source instead.',
      })
    }
  }

  const clearAll = () => {
    setMarkdown('')
    setView('split')
    setStatus(null)
  }

  const changeView = (nextView) => {
    setView(nextView)
    setStatus(null)
  }

  const viewButtons = [
    { id: 'editor', label: 'Editor' },
    { id: 'split', label: 'Split view' },
    { id: 'preview', label: 'Preview' },
  ]

  return (
    <>
      <PageMetadata
        title="Markdown Editor and Preview - Write Markdown Online"
        description="Write Markdown with a live preview, formatting toolbar, task lists, tables, and code blocks. Copy or download your Markdown privately in your browser."
      />
      <div className="mx-auto max-w-7xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">Markdown Editor &amp; Preview</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Write Markdown with a live preview, useful formatting controls, and
            instant word and line counts. Your source stays in this browser.
          </p>
        </header>

        <section aria-label="Markdown editor and preview" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs tabular-nums text-slate-600" aria-live="polite">
              <span><strong className="text-slate-900">{words}</strong> words</span>
              <span><strong className="text-slate-900">{characters}</strong> characters</span>
              <span><strong className="text-slate-900">{lines}</strong> lines</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1">
                {viewButtons.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => changeView(id)}
                    className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:px-4 sm:text-sm ${
                      view === id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={loadSample} className="tool-secondary-button px-3">
                <Sparkles aria-hidden="true" size={16} />
                Insert sample
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!markdown && view === 'split' && !status}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
          </div>

          {view !== 'preview' && (
            <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2" role="toolbar" aria-label="Markdown formatting">
              {TOOLBAR_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  aria-label={action.label}
                  title={action.label}
                  onClick={() => applyToolbarAction(action)}
                  className={`min-h-9 rounded-lg border border-transparent px-2.5 text-sm text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${action.className ?? ''}`}
                >
                  {action.display}
                </button>
              ))}
              <button
                type="button"
                aria-label="Insert table"
                title="Insert table"
                onClick={insertTable}
                className="min-h-9 rounded-lg border border-transparent px-2.5 text-sm text-slate-700 transition hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Table
              </button>
            </div>
          )}

          <div className={`mt-4 grid gap-4 ${view === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
            {view !== 'preview' && (
              <section aria-labelledby="markdown-source-heading" className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 id="markdown-source-heading" className="font-semibold text-slate-950">Markdown source</h2>
                  <span className="text-xs text-slate-500">Plain text</span>
                </div>
                <label htmlFor="markdown-editor-source" className="sr-only">Markdown source editor</label>
                <textarea
                  ref={editorRef}
                  id="markdown-editor-source"
                  value={markdown}
                  onChange={(event) => updateMarkdown(event.target.value)}
                  placeholder={'# Start writing\n\nType Markdown here to see a live preview...'}
                  spellCheck="false"
                  autoCapitalize="off"
                  autoCorrect="off"
                  className="tool-editor min-h-[28rem] w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-[36rem]"
                />
              </section>
            )}

            <section
              aria-labelledby="markdown-preview-heading"
              aria-hidden={view === 'editor'}
              className={`min-w-0 ${view === 'editor' ? 'sr-only' : ''}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 id="markdown-preview-heading" className="font-semibold text-slate-950">Live preview</h2>
                <span className="text-xs text-slate-500">Rendered text</span>
              </div>
              <div
                ref={previewRef}
                className="tool-editor min-h-[28rem] overflow-auto p-4 sm:min-h-[36rem]"
              >
                {preview.length ? (
                  preview
                ) : (
                  <p className="text-sm leading-6 text-slate-400">
                    Your formatted preview will appear here. Insert the sample to explore supported Markdown.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button type="button" onClick={copyMarkdown} disabled={!markdown} className="tool-primary-button">
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy Markdown
            </button>
            <button type="button" onClick={copyPreviewText} disabled={!markdown.trim()} className="tool-secondary-button">
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy preview text
            </button>
            <button type="button" onClick={downloadMarkdown} disabled={!markdown} className="tool-secondary-button">
              <Download aria-hidden="true" size={16} />
              Download .md
            </button>
          </div>

          {status && (
            <div className="mt-4">
              <StatusMessage status={status} />
            </div>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-markdown-editor">
            <h2 id="about-markdown-editor" className="text-2xl font-bold tracking-tight text-slate-950">
              Write and preview Markdown
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              Use Markdown syntax for headings, emphasis, links, blockquotes, lists,
              task lists, tables, and fenced code blocks. The editor updates the
              preview as you type; switch between editor, preview, and split view
              without losing your source.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              The preview uses a limited browser-only renderer built from React
              text and elements. Raw HTML is displayed as text, and links use only
              safe web, mail, or relative protocols. Your Markdown is not sent to
              a server.
            </p>
          </section>

          <section aria-labelledby="markdown-editor-faq">
            <h2 id="markdown-editor-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['What Markdown syntax does the preview support?', 'It supports headings, paragraphs, bold, italic, strikethrough, links, blockquotes, ordered and unordered lists, task lists, tables, inline code, and fenced code blocks.'],
                ['Can I switch views without losing my Markdown?', 'Yes. Editor-only, preview-only, and split view all use the same source text. Switching views does not alter it.'],
                ['Is raw HTML rendered in the preview?', 'No. Raw HTML is displayed as plain text. The preview is built with React elements and does not inject user-provided HTML.'],
                ['Are unsafe links allowed?', 'No. The preview only activates HTTP, HTTPS, mail, and relative links. JavaScript and other unsafe protocols are shown as plain link text.'],
                ['Can I copy or download my Markdown?', 'Yes. Copy the original source or rendered preview text, or download the source as a .md file.'],
                ['Is my document uploaded?', 'No. Editing, preview rendering, copying, and downloading take place locally in your browser.'],
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
