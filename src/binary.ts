// Pure binary-frame decode (#12/#51). Try UTF-8 text first (many "binary" frames
// are actually text/JSON); otherwise keep the RAW bytes as base64 so "copy"
// reproduces the exact wire bytes. The panel renders base64 → a hex+ASCII dump for
// display and "Copy formatted". Kept in lib/ (no chrome.*/DOM) so it's unit-tested.

export interface DecodedBinary {
  /** Decoded UTF-8 text, or (for real binary) the raw bytes as base64. */
  data: string
  /** True when the bytes were NOT decodable as printable text (→ raw base64). */
  binary: boolean
}

/** Decode raw bytes: printable UTF-8 → text; else the raw bytes as base64. */
export function decodeBinary(bytes: Uint8Array): DecodedBinary {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Accept as text only if the raw bytes are printable — a real binary blob can
    // still decode as UTF-8 but be full of control chars.
    if (isPrintable(bytes)) return { data: text, binary: false }
  } catch {
    /* not valid UTF-8 → keep the raw bytes */
  }
  return { data: bytesToBase64(bytes), binary: true }
}

/** True if no control bytes except tab (9), LF (10), CR (13) — "is this text?". */
export function isPrintable(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b < 9 || (b > 13 && b < 32)) return false
  }
  return true
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/** Classic hex+ASCII dump: `offset  hex bytes  ascii`. */
export function hexDump(bytes: Uint8Array): string {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16)
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
    lines.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  ${ascii}`)
  }
  return lines.join('\n')
}
