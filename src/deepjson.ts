// Deep/recursive JSON parse. Many real protocols nest JSON *inside string
// fields* — e.g. ActionCable frames carry `identifier` and `data` as serialized
// JSON strings. A single JSON.parse stops at the first level and leaves those
// inner strings escaped (\"...\"), which is unreadable. deepParseJson walks the
// structure and re-parses any string that is itself valid JSON, all the way down.
//
// PURE (no chrome.*/DOM) → lives in lib/ and is unit-tested. Used by the panel
// before pretty-printing (CF-105 finishing). ON by default.

/** Max nesting we descend, to bound work on pathological/adversarial payloads. */
const MAX_DEPTH = 12

function looksLikeJson(s: string): boolean {
  const t = s.trimStart()
  // Only attempt a parse when it plausibly starts a JSON object/array. Bare
  // strings/numbers that happen to be valid JSON (e.g. "true", "42") are left as
  // text on purpose — re-typing them would be surprising, not clarifying.
  return t.startsWith('{') || t.startsWith('[')
}

/**
 * Recursively parse JSON-in-string. Returns a new value where every string that
 * is itself a JSON object/array is replaced by its parsed form (deeply). Strings
 * that are not JSON, and all other values, are returned unchanged.
 */
export function deepParseJson(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH) return value

  if (typeof value === 'string') {
    if (!looksLikeJson(value)) return value
    try {
      return deepParseJson(JSON.parse(value), depth + 1)
    } catch {
      return value // not actually JSON — keep the raw string
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepParseJson(item, depth + 1))
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = deepParseJson(val, depth + 1)
    }
    return out
  }

  return value
}
