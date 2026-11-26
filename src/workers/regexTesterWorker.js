const MAX_MATCHES = 5000

function getLineStarts(text) {
  const starts = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\r') {
      if (text[index + 1] === '\n') index += 1
      starts.push(index + 1)
    } else if (text[index] === '\n') {
      starts.push(index + 1)
    }
  }
  return starts
}

function getPosition(index, lineStarts) {
  let low = 0
  let high = lineStarts.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle] <= index) low = middle + 1
    else high = middle
  }
  const lineIndex = Math.max(0, low - 1)
  return {
    line: lineIndex + 1,
    column: index - lineStarts[lineIndex] + 1,
  }
}

function advanceAfterEmptyMatch(regex, text) {
  const index = regex.lastIndex
  if (index >= text.length) {
    regex.lastIndex = index + 1
    return
  }
  if (!regex.unicode) {
    regex.lastIndex = index + 1
    return
  }

  const codePoint = text.codePointAt(index)
  regex.lastIndex = index + (codePoint > 0xffff ? 2 : 1)
}

self.addEventListener('message', (event) => {
  const { id, pattern, flags, text } = event.data

  try {
    const expression = new RegExp(pattern, flags)
    const lineStarts = getLineStarts(text)
    const matches = []
    let match
    let truncated = false

    do {
      match = expression.exec(text)
      if (!match) break

      const index = match.index
      const endIndex = index + match[0].length
      matches.push({
        index,
        endIndex,
        value: match[0],
        position: getPosition(index, lineStarts),
        captures: Array.from(match.slice(1), (value, captureIndex) => ({
          number: captureIndex + 1,
          value: value ?? null,
        })),
        namedCaptures: Object.entries(match.groups ?? {}).map(([name, value]) => ({
          name,
          value: value ?? null,
        })),
      })

      if (!expression.global) break
      if (match[0] === '') advanceAfterEmptyMatch(expression, text)
      if (matches.length >= MAX_MATCHES) {
        truncated = true
        break
      }
    } while (true)

    self.postMessage({ id, matches, truncated })
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : 'The regular expression could not be evaluated.',
      matches: [],
      truncated: false,
    })
  }
})
