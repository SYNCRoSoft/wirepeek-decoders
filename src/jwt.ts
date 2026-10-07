// JWT decode (#16 method). A JWT is three base64url segments `header.payload.sig`;
// header + payload are JSON, the signature is opaque bytes. We surface header + payload
// as a readable object (signature left as text). PURE (no chrome.*/DOM) → unit-tested.

/** True if `s` is a JWT: 3 base64url segments whose header parses to JSON with `alg`. */
export function isJwt(s: string): boolean {
  const parts = s.split('.')
  if (parts.length !== 3) return false
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false
  const header = decodeSegment(parts[0])
  // Require a JOSE header (has `alg`) so we don't match arbitrary dotted strings.
  return typeof header === 'object' && header !== null && 'alg' in header
}

/** Decode a JWT to `{ header, payload, signature }`, or undefined if malformed. */
export function decodeJwt(s: string): { header: unknown; payload: unknown; signature: string } | undefined {
  const parts = s.split('.')
  if (parts.length !== 3) return undefined
  const header = decodeSegment(parts[0])
  const payload = decodeSegment(parts[1])
  if (header === undefined || payload === undefined) return undefined
  return { header, payload, signature: parts[2] }
}

function decodeSegment(seg: string): unknown {
  try {
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    // atob → binary string; re-interpret as UTF-8 so non-ASCII claims decode correctly.
    const bytes = Uint8Array.from(atob(pad), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}
