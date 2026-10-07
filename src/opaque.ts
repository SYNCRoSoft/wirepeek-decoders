// Detect opaque/encrypted string values (#55). Encryption looks like high-entropy
// encoding, so entropy alone can't separate an encrypted token from base64-of-JSON
// (measured: ~5.3 vs ~5.1 bits/char — overlapping). The RELIABLE signal: base64-decode
// it and look at the bytes — a decodable encoding (base64-of-JSON/text) yields mostly
// PRINTABLE bytes, while an encrypted/opaque blob yields mostly non-printable bytes.
//
// Used to paint such values red ("🔒 likely encrypted / opaque binary") so the user
// doesn't burn time trying to decode something that can't be decoded here. PURE.

import { base64ToBytes } from './binary'

/** True if `s` looks like an opaque/encrypted binary blob rather than a readable value. */
export function looksOpaqueBlob(s: string): boolean {
  // Meta-style tokens are prefixed ("fase.ARxxxx", "hmac_ttl.<ts>.ARxxxx") → test the
  // last dot-separated segment (the actual blob).
  const body = s.includes('.') ? s.slice(s.lastIndexOf('.') + 1) : s
  if (body.length < 32) return false
  if (/^[0-9a-fA-F]+$/.test(body)) return false // pure hex = hash/id, not a blob
  if (!/^[A-Za-z0-9_\-+/]+={0,2}$/.test(body)) return false
  if (body.startsWith('H4sI') || body.startsWith('BCJNG')) return false // gzip/lz4 = decodable

  // Decode a valid prefix: normalize base64url, drop any trailing partial group (so
  // atob never chokes on length/padding). The byte distribution of the prefix is
  // enough to tell text from an opaque blob.
  const clean = body.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const usable = clean.slice(0, clean.length - (clean.length % 4))
  if (usable.length < 32) return false
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(usable)
  } catch {
    return false
  }

  let printable = 0
  for (const b of bytes) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) printable++
  }
  return printable / bytes.length < 0.75 // mostly non-text bytes → opaque/encrypted
}
