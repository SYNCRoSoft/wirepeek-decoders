import { describe, expect, it } from 'vitest'
import { decompressLz4Frame, isLz4Base64 } from './lz4'

// Build a minimal LZ4 frame: magic + FLG/BD (no flags) + HC + one block + EndMark.
function frame(block: number[], uncompressed = false): Uint8Array {
  const size = block.length | (uncompressed ? 0x80000000 : 0)
  const head = [0x04, 0x22, 0x4d, 0x18, 0x40, 0x40, 0x00] // magic, FLG=0x40, BD=0x40, HC
  const bsize = [size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff]
  const end = [0, 0, 0, 0]
  return Uint8Array.from([...head, ...bsize, ...block, ...end])
}

const text = (u: Uint8Array): string => new TextDecoder().decode(u)

describe('isLz4Base64', () => {
  it('accepts a real LZ4-frame base64 (SignalR betting feed magic)', () => {
    expect(isLz4Base64('BCJNGEBAwIAPAADxGVt7InZlcnNpb24iOjI4MCw')).toBe(true)
  })

  it('rejects plain JSON, gzip-base64, and short strings', () => {
    expect(isLz4Base64('{"a":1}')).toBe(false)
    expect(isLz4Base64('H4sIAAAAAAAAAytLzClNBQAA')).toBe(false) // gzip prefix
    expect(isLz4Base64('BCJNG')).toBe(false) // too short
  })
})

describe('decompressLz4Frame', () => {
  it('reads an uncompressed block verbatim', () => {
    const body = Array.from(new TextEncoder().encode('[1,2,3]'))
    expect(text(decompressLz4Frame(frame(body, true)))).toBe('[1,2,3]')
  })

  it('expands a compressed match with overlap (RLE-style)', () => {
    // token 0x10 = 1 literal, match len 4; literal "A"; offset 1 → copies "AAAA".
    const block = [0x10, 0x41, 0x01, 0x00]
    expect(text(decompressLz4Frame(frame(block)))).toBe('AAAAA')
  })

  it('throws on a non-LZ4 buffer', () => {
    expect(() => decompressLz4Frame(Uint8Array.from([1, 2, 3, 4]))).toThrow()
  })
})
