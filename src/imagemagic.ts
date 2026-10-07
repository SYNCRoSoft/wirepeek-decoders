// Image detection by magic bytes (#59). Reliable (unlike the fuzzy opaque/encrypted
// heuristic): a fixed signature at the start identifies the format. Used to preview a
// base64 image field or an image binary frame as a thumbnail (data: URI — 100% local,
// no network). PURE (no chrome.*/DOM) → unit-tested.

import { base64ToBytes } from './binary'

export type ImageType = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'avif' | 'heic' | 'tiff' | 'ico'

const MIME: Record<ImageType, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  heic: 'image/heic',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
}

export function imageMime(t: ImageType): string {
  return MIME[t]
}

/** Identify an image by its leading magic bytes, or undefined. Needs ~12 bytes. */
export function detectImage(b: Uint8Array): ImageType | undefined {
  if (starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (starts(b, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (starts(b, [0x47, 0x49, 0x46, 0x38])) return 'gif' // GIF8(7a|9a)
  if (starts(b, [0x42, 0x4d]) && b.length >= 26) return 'bmp' // weak magic → require some size
  if (starts(b, [0x00, 0x00, 0x01, 0x00]) && b.length >= 6) return 'ico'
  if (starts(b, [0x49, 0x49, 0x2a, 0x00]) || starts(b, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff'
  if (starts(b, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x45, 0x42, 0x50])) return 'webp' // RIFF….WEBP
  // ISO-BMFF: an `ftyp` box at offset 4, brand at offset 8 (AVIF / HEIF family).
  if (at(b, 4, [0x66, 0x74, 0x79, 0x70])) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11])
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return 'heic'
  }
  return undefined
}

export interface ImageInfo {
  type: ImageType
  mime: string
  /** Ready-to-use `data:` URI for an <img> src (100% local — no network). */
  dataUri: string
}

/** Detect a base64 string as an image and build a preview data URI, or undefined. */
export function detectImageBase64(s: string): ImageInfo | undefined {
  if (s.length < 24 || !/^[A-Za-z0-9_\-+/]+={0,2}$/.test(s)) return undefined
  const std = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '')
  let head: Uint8Array
  try {
    head = base64ToBytes(std.slice(0, 24)) // 18 bytes — enough for every magic
  } catch {
    return undefined
  }
  const type = detectImage(head)
  if (!type) return undefined
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4)
  return { type, mime: MIME[type], dataUri: `data:${MIME[type]};base64,${padded}` }
}

/** Find an embedded base64 image inside a TEXT frame — e.g. a `data:` URI that a
 *  protocol prefixes with a custom op-code (`nksdata:image/jpeg;base64,…`). We take
 *  the base64 run after `base64,` and validate it via magic bytes (NOT the declared
 *  MIME), so a literal `data:image/png;base64,<garbage>` can't false-positive.
 *  Returns a ready `<img>` data URI, or undefined. */
export function extractImageDataUri(text: string): string | undefined {
  const m = /base64,([A-Za-z0-9+/]+={0,2})/.exec(text)
  if (!m) return undefined
  return detectImageBase64(m[1])?.dataUri
}

function starts(b: Uint8Array, sig: number[]): boolean {
  return at(b, 0, sig)
}
function at(b: Uint8Array, off: number, sig: number[]): boolean {
  if (b.length < off + sig.length) return false
  for (let i = 0; i < sig.length; i++) if (b[off + i] !== sig[i]) return false
  return true
}
