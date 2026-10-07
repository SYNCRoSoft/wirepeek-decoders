// base64 decode (#16 / #55 method). Decodes a base64/base64url field to its content:
// a JSON object/array, or printable text. Strict UTF-8 + all-printable filtering keeps
// false positives near zero (random base64-alphabet IDs almost never decode to fully
// printable text). base64→binary is left to the opaque (#55 red) / binary decoders.
// PURE (no chrome.*/DOM) → unit-tested. gzip/lz4 are handled by their own detectors.

import { base64ToBytes, isPrintable } from './binary'

/** True if `s` is base64/base64url that decodes to JSON or printable text. */
export function isBase64Value(s: string): boolean {
  return decodeBase64Value(s) !== undefined
}

/** Decode base64/base64url → JSON object/array, or a printable text string, else undefined. */
export function decodeBase64Value(s: string): unknown {
  if (s.length < 8) return undefined
  if (!/^[A-Za-z0-9_\-+/]+={0,2}$/.test(s)) return undefined
  if (s.startsWith('H4sI') || s.startsWith('BCJNG')) return undefined // gzip/lz4 → other methods
  let bytes: Uint8Array
  try {
    const std = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
    bytes = base64ToBytes(std + '='.repeat((4 - (std.length % 4)) % 4))
  } catch {
    return undefined
  }
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined // not text → binary (opaque / binary decoders handle it)
  }
  if (!isPrintable(bytes)) return undefined // control bytes → not readable text
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) // base64-of-JSON → structured
    } catch {
      /* looked like JSON but isn't — fall through to text */
    }
  }
  // base64-of-text (#55): require a bit of length so tiny coincidental decodes of IDs
  // don't get flagged (JSON above is already validated, so it keeps its low threshold).
  return text.length >= 12 ? text : undefined
}
