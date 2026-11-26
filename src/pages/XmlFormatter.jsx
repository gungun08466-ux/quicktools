import {
  AlertCircle,
  Check,
  ClipboardCopy,
  Download,
  Eraser,
  FileUp,
} from 'lucide-react'
import { useRef, useState } from 'react'
import PageMetadata from '../components/seo/PageMetadata.jsx'

const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace'
const PARSER_ERROR_NAMESPACE = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
const XML_DECLARATION_PATTERN = /^\uFEFF?(<\?xml\s+[^?]*\?>)/i

function containsDoctype(source) {
  let index = 0

  while (index < source.length) {
    if (source[index] !== '<') {
      index += 1
      continue
    }

    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4)
      index = end === -1 ? source.length : end + 3
      continue
    }
    if (source.startsWith('<![CDATA[', index)) {
      const end = source.indexOf(']]>', index + 9)
      index = end === -1 ? source.length : end + 3
      continue
    }
    if (source.startsWith('<?', index)) {
      const end = source.indexOf('?>', index + 2)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (/^<!DOCTYPE\b/i.test(source.slice(index, index + 10))) return true

    index += 1
  }

  return false
}

function getXmlDeclaration(source) {
  const match = source.match(XML_DECLARATION_PATTERN)
  if (!match) return ''

  return match[1].replace(
    /\bencoding\s*=\s*(['"])[^'"]*\1/i,
    'encoding="UTF-8"',
  )
}

function getParserError(document) {
  const namespacedError = document.getElementsByTagNameNS(
    PARSER_ERROR_NAMESPACE,
    'parsererror',
  )[0]
  if (namespacedError) return namespacedError.textContent.trim()

  const htmlParserError = document.getElementsByTagNameNS(
    HTML_NAMESPACE,
    'parsererror',
  )[0]
  if (htmlParserError && /this page contains the following errors|xml parsing error|error on line \d+ at column/i.test(htmlParserError.textContent)) {
    return htmlParserError.textContent.trim()
  }

  const root = document.documentElement
  if (root?.localName?.toLowerCase() !== 'parsererror') return null

  const message = root.textContent.trim()
  if (/this page contains the following errors|xml parsing error|error on line \d+ at column/i.test(message)) {
    return message
  }
  return null
}

function formatParserError(message) {
  const line = message.match(/\bline(?:\s+number)?\s*[:=]?\s*(\d+)\b/i)
  const column = message.match(/\bcolumn(?:\s+number)?\s*[:=]?\s*(\d+)\b/i)
  const location = [
    line ? `line ${line[1]}` : '',
    column ? `column ${column[1]}` : '',
  ].filter(Boolean).join(', ')

  return `XML parsing failed${location ? ` at ${location}` : ''}: ${message || 'The document is not well-formed.'}`
}

function parseXml(source) {
  if (!source.trim()) {
    return { document: null, error: 'Enter or upload XML before formatting or validating.' }
  }
  if (containsDoctype(source)) {
    return {
      document: null,
      error: 'DOCTYPE declarations are not supported. They can define entities or reference external resources.',
    }
  }

  try {
    const document = new DOMParser().parseFromString(source, 'application/xml')
    const parserError = getParserError(document)
    if (parserError) return { document: null, error: formatParserError(parserError) }
    if (!document.documentElement) {
      return { document: null, error: 'The XML document does not contain a root element.' }
    }
    return { document, error: null }
  } catch (error) {
    return {
      document: null,
      error: error instanceof Error
        ? `Could not parse this XML: ${error.message}`
        : 'Could not parse this XML. Check that the document is well-formed.',
    }
  }
}

function isPreservingSpace(element, inherited) {
  const value = element.getAttributeNS(XML_NAMESPACE, 'space')
  if (value === 'preserve') return true
  if (value === 'default') return false
  return inherited
}

function serializeDocumentChildren(document, serializer, formatElement) {
  return Array.from(document.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE && !node.data.trim()) return ''
      if (node.nodeType === Node.ELEMENT_NODE) return formatElement(node, 0, false)
      return serializer.serializeToString(node)
    })
    .filter(Boolean)
    .join('\n')
}

function serializeOpeningTag(element) {
  const attributes = Array.from(element.attributes)
    .map(({ name, value }) => {
      const escapedValue = value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/\t/g, '&#x9;')
        .replace(/\n/g, '&#xA;')
        .replace(/\r/g, '&#xD;')
      return ` ${name}="${escapedValue}"`
    })
    .join('')

  return `<${element.nodeName}${attributes}>`
}

function serializeElement(element, serializer) {
  const openingTag = serializeOpeningTag(element)
  const children = Array.from(element.childNodes)
  if (!children.length) return openingTag.replace(/>$/, '/>')

  const content = children.map((child) =>
    child.nodeType === Node.ELEMENT_NODE
      ? serializeElement(child, serializer)
      : serializer.serializeToString(child),
  ).join('')

  return `${openingTag}${content}</${element.nodeName}>`
}

function formatXml(document, indentationSize, declaration) {
  const serializer = new XMLSerializer()
  const indentation = ' '.repeat(indentationSize)

  const formatElement = (element, depth, inheritedPreserve) => {
    const children = Array.from(element.childNodes)
    const hasElementChildren = children.some((node) => node.nodeType === Node.ELEMENT_NODE)
    const hasTextContent = children.some((node) =>
      (node.nodeType === Node.TEXT_NODE && node.data.trim())
      || node.nodeType === Node.CDATA_SECTION_NODE,
    )
    const hasTextNode = children.some((node) =>
      node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE,
    )
    const preserveSpace = isPreservingSpace(element, inheritedPreserve)

    if (
      preserveSpace
      || hasTextContent
      || !children.length
      || (!hasElementChildren && hasTextNode)
    ) {
      return `${indentation.repeat(depth)}${serializeElement(element, serializer)}`
    }

    const hasInlineWhitespace = children.some((node) =>
      node.nodeType === Node.TEXT_NODE
      && !node.data.trim()
      && node.data.length > 0
      && !/[\r\n]/.test(node.data),
    )
    if (hasInlineWhitespace) {
      return `${indentation.repeat(depth)}${serializeElement(element, serializer)}`
    }

    const structuralChildren = children.filter((node) =>
      !(node.nodeType === Node.TEXT_NODE && !node.data.trim()),
    )
    if (!structuralChildren.length) {
      return `${indentation.repeat(depth)}${serializeElement(element, serializer)}`
    }

    const openingTag = serializeOpeningTag(element)
    const childOutput = structuralChildren.map((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return formatElement(node, depth + 1, preserveSpace)
      }
      return `${indentation.repeat(depth + 1)}${serializer.serializeToString(node)}`
    })

    return [
      `${indentation.repeat(depth)}${openingTag}`,
      ...childOutput,
      `${indentation.repeat(depth)}</${element.nodeName}>`,
    ].join('\n')
  }

  const formatted = serializeDocumentChildren(document, serializer, formatElement)
  return [declaration, formatted].filter(Boolean).join('\n')
}

function removeIndentationWhitespace(node, inheritedPreserve = false) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    Array.from(node.childNodes).forEach((child) =>
      removeIndentationWhitespace(child, inheritedPreserve),
    )
    return
  }

  const preserveSpace = isPreservingSpace(node, inheritedPreserve)
  const children = Array.from(node.childNodes)
  const hasTextContent = children.some((child) =>
    (child.nodeType === Node.TEXT_NODE && child.data.trim())
    || child.nodeType === Node.CDATA_SECTION_NODE,
  )
  const hasStructuralChildren = children.some((child) =>
    child.nodeType === Node.ELEMENT_NODE
    || child.nodeType === Node.COMMENT_NODE
    || child.nodeType === Node.PROCESSING_INSTRUCTION_NODE,
  )

  if (!preserveSpace && !hasTextContent && hasStructuralChildren) {
    children.forEach((child) => {
      if (
        child.nodeType === Node.TEXT_NODE
        && !child.data.trim()
        && /[\r\n]/.test(child.data)
      ) {
        node.removeChild(child)
      }
    })
  }

  Array.from(node.childNodes).forEach((child) =>
    removeIndentationWhitespace(child, preserveSpace),
  )
}

function minifyXml(document, declaration) {
  const minifiedDocument = document.cloneNode(true)
  Array.from(minifiedDocument.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && !node.data.trim()) {
      minifiedDocument.removeChild(node)
    }
  })
  removeIndentationWhitespace(minifiedDocument)

  const serialized = new XMLSerializer().serializeToString(minifiedDocument)
  return `${declaration}${serialized}`
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

export default function XmlFormatter() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indentationSize, setIndentationSize] = useState(2)
  const [status, setStatus] = useState(null)
  const [fileName, setFileName] = useState('')
  const [isReading, setIsReading] = useState(false)
  const fileInputRef = useRef(null)

  const updateInput = (value) => {
    setInput(value)
    setOutput('')
    setStatus(null)
    setFileName('')
  }

  const loadXmlFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setOutput('')
      setStatus({ type: 'error', message: 'Choose a file with the .xml extension.' })
      return
    }

    setIsReading(true)
    try {
      const contents = await file.text()
      setInput(contents)
      setOutput('')
      setFileName(file.name)
      setStatus({ type: 'success', message: `Loaded ${file.name}. Choose Format, Minify, or Validate.` })
    } catch (error) {
      setOutput('')
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not read the file: ${error.message}`
          : 'Could not read this XML file. Please try another file.',
      })
    } finally {
      setIsReading(false)
    }
  }

  const runAction = (action) => {
    const parsed = parseXml(input)
    if (parsed.error) {
      setOutput('')
      setStatus({ type: 'error', message: parsed.error })
      return
    }

    if (action === 'validate') {
      setOutput('')
      setStatus({ type: 'success', message: 'Valid XML. The document is well-formed.' })
      return
    }

    const declaration = getXmlDeclaration(input)
    const result = action === 'format'
      ? formatXml(parsed.document, indentationSize, declaration)
      : minifyXml(parsed.document, declaration)
    setOutput(result)
    setStatus({
      type: 'success',
      message: action === 'format' ? 'XML formatted successfully.' : 'XML minified successfully.',
    })
  }

  const changeIndentation = (value) => {
    setIndentationSize(Number(value))
    setOutput('')
    setStatus(null)
  }

  const copyOutput = async () => {
    if (!output) return
    if (!navigator.clipboard?.writeText) {
      setStatus({
        type: 'error',
        message: 'Clipboard access is unavailable in this browser or page context.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      setStatus({ type: 'success', message: 'XML copied to the clipboard.' })
    } catch {
      setStatus({
        type: 'error',
        message: 'Could not copy the XML. Check clipboard permissions and try again.',
      })
    }
  }

  const downloadOutput = () => {
    if (!output) return

    try {
      const blob = new Blob([output], { type: 'application/xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'formatted.xml'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus({ type: 'success', message: 'XML download started.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error
          ? `Could not create the XML download: ${error.message}`
          : 'Could not create the XML download. Try copying the output instead.',
      })
    }
  }

  const loadSample = () => {
    setInput('<?xml version="1.0" encoding="UTF-8"?>\n<catalog xmlns="urn:quicktools:catalog" updated="2026-11-26"><!-- Sample entry --><book id="1" lang="hi"><title>QuickTools नमस्ते</title><description>Unicode text and nested XML.</description></book></catalog>')
    setOutput('')
    setStatus({ type: 'success', message: 'Sample XML loaded. Choose Format, Minify, or Validate.' })
    setFileName('')
  }

  const clearAll = () => {
    setInput('')
    setOutput('')
    setIndentationSize(2)
    setStatus(null)
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <PageMetadata
        title="XML Formatter and Validator - Format XML Online"
        description="Format, minify, and validate XML in your browser. Choose indentation, inspect parsing errors, and work safely with namespaces, attributes, comments, and Unicode."
      />
      <div className="mx-auto max-w-6xl tool-page-shell">
        <header className="tool-page-heading">
          <h1 className="tool-page-title">XML Formatter &amp; Validator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Beautify, minify, or validate XML locally in your browser. Preserve
            namespaces, attributes, comments, and Unicode while checking for
            malformed markup.
          </p>
        </header>

        <section aria-label="XML formatter and validator" className="tool-surface-raised p-4 sm:p-6">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-950">XML input</h2>
              <p className="mt-1 break-words text-sm text-slate-500">
                Paste XML or upload a .xml file.
                {fileName ? ` Loaded: ${fileName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="xml-indentation" className="mb-1 block text-xs font-medium text-slate-600">
                  Indentation
                </label>
                <select
                  id="xml-indentation"
                  value={indentationSize}
                  onChange={(event) => changeIndentation(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value={2}>2 spaces</option>
                  <option value={4}>4 spaces</option>
                </select>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={loadXmlFile}
                className="sr-only"
                aria-label="Upload an XML file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isReading}
                className="tool-secondary-button px-3"
              >
                <FileUp aria-hidden="true" size={16} />
                {isReading ? 'Reading file...' : 'Upload XML'}
              </button>
              <button type="button" onClick={loadSample} className="tool-secondary-button px-3">
                Load sample
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={!input && !output && !status && !fileName && indentationSize === 2}
                className="tool-secondary-button px-3"
              >
                <Eraser aria-hidden="true" size={16} />
                Clear &amp; reset
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section aria-labelledby="xml-input-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="xml-input-heading" className="font-semibold text-slate-950">XML editor</h3>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {input.length} characters
                </span>
              </div>
              <label htmlFor="xml-formatter-input" className="sr-only">XML text editor</label>
              <textarea
                id="xml-formatter-input"
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                placeholder={'<root>\n  <item>Example</item>\n</root>'}
                spellCheck="false"
                autoCapitalize="off"
                autoCorrect="off"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 sm:min-h-80"
              />
            </section>

            <section aria-labelledby="xml-output-heading" className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h3 id="xml-output-heading" className="font-semibold text-slate-950">XML output</h3>
                <span className="text-xs tabular-nums text-slate-500" aria-live="polite">
                  {output.length} characters
                </span>
              </div>
              <label htmlFor="xml-formatter-output" className="sr-only">Formatted XML output</label>
              <textarea
                id="xml-formatter-output"
                value={output}
                readOnly
                placeholder="Formatted or minified XML will appear here..."
                spellCheck="false"
                className="tool-editor mt-3 min-h-72 w-full resize-y p-4 font-mono text-sm leading-6 read-only:cursor-text read-only:focus:border-indigo-500 sm:min-h-80"
              />
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-indigo-100 pt-5">
            <button type="button" onClick={() => runAction('format')} disabled={isReading} className="tool-primary-button">
              Format XML
            </button>
            <button type="button" onClick={() => runAction('minify')} disabled={isReading} className="tool-secondary-button">
              Minify XML
            </button>
            <button type="button" onClick={() => runAction('validate')} disabled={isReading} className="tool-secondary-button">
              Validate XML
            </button>
            <button type="button" onClick={copyOutput} disabled={!output} className="tool-secondary-button">
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy XML
            </button>
            <button type="button" onClick={downloadOutput} disabled={!output} className="tool-secondary-button">
              <Download aria-hidden="true" size={16} />
              Download XML
            </button>
          </div>

          {status && (
            <div className="mt-4">
              <StatusMessage status={status} />
            </div>
          )}
        </section>

        <div className="mx-auto mt-12 max-w-3xl space-y-10">
          <section aria-labelledby="about-xml-formatter">
            <h2 id="about-xml-formatter" className="text-2xl font-bold tracking-tight text-slate-950">
              Format and validate XML safely
            </h2>
            <p className="mt-3 leading-7 text-slate-600">
              The XML formatter uses the browser’s native DOMParser and XMLSerializer
              to validate and serialize well-formed documents. Choose two- or four-space
              indentation, minify structural whitespace, or validate without changing the
              input. XML text is shown as plain text and is never inserted as executable HTML.
            </p>
            <p className="mt-3 leading-7 text-slate-600">
              Elements with mixed text and nested markup are kept together to avoid changing
              their text content. Comments, attributes, namespaces, and Unicode are retained
              where possible. DOCTYPE declarations are rejected to prevent DTD and external
              entity resolution. All parsing, formatting, file reading, and downloads happen
              locally in your browser.
            </p>
          </section>

          <section aria-labelledby="xml-formatter-faq">
            <h2 id="xml-formatter-faq" className="text-2xl font-bold tracking-tight text-slate-950">
              Frequently Asked Questions
            </h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 shadow-sm sm:px-6">
              {[
                ['How do I format XML?', 'Paste XML or upload a .xml file, choose two- or four-space indentation, and select Format XML. The output is serialized as plain text.'],
                ['How do I validate XML?', 'Select Validate XML to check that the document is well-formed. When the browser reports a location, the error includes its line and column.'],
                ['What happens to malformed XML?', 'The parser error is shown and no formatted output is produced. The tool does not silently repair malformed documents.'],
                ['Does minifying XML remove comments?', 'No. Comments are preserved. Minify removes line-break indentation between structural nodes while preserving mixed text and xml:space=\"preserve\" content.'],
                ['Can XML reference external entities?', 'DOCTYPE declarations are rejected, so this tool does not process DTDs or external entity references.'],
                ['Is my XML uploaded?', 'No. File reading, parsing, formatting, validation, copying, and downloads stay in your browser.'],
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
