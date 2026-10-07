// Extract JSON embedded in an otherwise-binary frame (#57). Many binary protocols
// wrap JSON after a small binary header (e.g. Facebook's gateway framing
// `[type][len][header]{json}`), and often PACK SEVERAL messages per frame (a tiny
// control `{}` then the real payload). So we scan for ALL balanced {...}/[...] runs,
// not just the first — otherwise a leading `{}` masks the real message. PURE (no
// chrome.*/DOM) → lives in lib/ and is unit-tested.
//
// Aggressive by nature (random bytes can look like JSON) → the panel gates it behind
// an OFF-by-default method toggle (#16). Bounded: caps attempts + results so a large
// non-JSON binary frame can't drive O(n^2) scanning.

const MAX_RESULTS = 128
const MAX_ATTEMPTS = 8192

/** Parse every balanced JSON object/array embedded in `text` (in order). */
export function extractEmbeddedJson(text: string): unknown[] {
  const out: unknown[] = []
  let attempts = 0
  let i = 0
  while (i < text.length && out.length < MAX_RESULTS) {
    const c = text[i]
    if (c === '{' || c === '[') {
      if (attempts++ > MAX_ATTEMPTS) break
      const end = matchClose(text, i)
      if (end > i) {
        try {
          out.push(JSON.parse(text.slice(i, end + 1)))
          i = end + 1 // skip past this message; don't re-scan its interior
          continue
        } catch {
          /* not valid JSON here — keep scanning from the next byte */
        }
      }
    }
    i++
  }
  return out
}

/** Index of the brace/bracket that closes the container opened at `start`, or -1.
 *  String-aware (ignores braces inside "..." and handles \" escapes). */
export function matchClose(s: string, start: number): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}
