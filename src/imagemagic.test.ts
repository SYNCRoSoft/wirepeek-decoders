import { describe, expect, it } from 'vitest'
import { detectImage, extractImageDataUri, imageMime } from './imagemagic'

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b)
const pad = (b: number[], n: number): Uint8Array => Uint8Array.from([...b, ...new Array(Math.max(0, n - b.length)).fill(0)])

describe('detectImage', () => {
  it('detects PNG / JPEG / GIF by magic', () => {
    expect(detectImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('png')
    expect(detectImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe('jpeg')
    expect(detectImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('gif')
  })

  it('detects WEBP (RIFF….WEBP) but not other RIFF (WAV)', () => {
    expect(detectImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('webp')
    expect(detectImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeUndefined()
  })

  it('detects AVIF/HEIC via the ftyp brand', () => {
    // …ftypavif
    expect(detectImage(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66))).toBe('avif')
    expect(detectImage(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBe('heic')
  })

  it('does not match plain bytes; maps mime', () => {
    expect(detectImage(pad([0x01, 0x02, 0x03], 16))).toBeUndefined()
    expect(imageMime('png')).toBe('image/png')
    expect(imageMime('webp')).toBe('image/webp')
  })
})

describe('extractImageDataUri', () => {
  it('extracts a JPEG data URI hidden behind a custom op-code prefix', () => {
    // FF D8 FF … = JPEG magic; the `nks` prefix is Flingster's op-code.
    const frame = 'nksdata:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'
    const uri = extractImageDataUri(frame)
    expect(uri).toBeDefined()
    expect(uri!.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('ignores base64 that is not actually an image (magic-byte validated, not MIME)', () => {
    // Declares image/png but the payload decodes to plain text → must be rejected.
    const notImg = 'xdata:image/png;base64,aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYW4gaW1hZ2U='
    expect(extractImageDataUri(notImg)).toBeUndefined()
  })

  it('returns undefined when there is no base64 payload', () => {
    expect(extractImageDataUri('t{"A":1,"C":"RO"}')).toBeUndefined()
  })
})
