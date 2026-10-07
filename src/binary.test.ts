import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64, decodeBinary, hexDump, isPrintable } from './binary'

const enc = (s: string): Uint8Array => new TextEncoder().encode(s)

describe('decodeBinary', () => {
  it('decodes printable UTF-8 as text (binary: false)', () => {
    const r = decodeBinary(enc('{"type":"ping"}'))
    expect(r).toEqual({ data: '{"type":"ping"}', binary: false })
  })

  it('keeps multibyte UTF-8 text as text', () => {
    const r = decodeBinary(enc('héllo — wörld ✓'))
    expect(r.binary).toBe(false)
    expect(r.data).toBe('héllo — wörld ✓')
  })

  it('allows tab/newline/CR but treats other control chars as binary', () => {
    expect(decodeBinary(enc('a\tb\nc\r')).binary).toBe(false)
    expect(decodeBinary(new Uint8Array([0x61, 0x00, 0x62])).binary).toBe(true)
  })

  it('keeps real binary as RAW base64 (round-trips exactly)', () => {
    // gzip magic + a stray 0xff (not valid UTF-8 alone)
    const raw = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0xff, 0x00])
    const r = decodeBinary(raw)
    expect(r.binary).toBe(true)
    expect(base64ToBytes(r.data)).toEqual(raw) // "copy" reproduces exact wire bytes
  })
})

describe('base64 round-trip', () => {
  it('bytesToBase64 → base64ToBytes is identity', () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 0x7f, 0x80])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})

describe('isPrintable', () => {
  it('true for plain text bytes', () => {
    expect(isPrintable(enc('hello world 123'))).toBe(true)
  })
  it('false when a control byte is present', () => {
    expect(isPrintable(new Uint8Array([0x68, 0x01, 0x69]))).toBe(false)
  })
})

describe('hexDump', () => {
  it('formats offset, hex, and ascii', () => {
    const dump = hexDump(enc('ABC'))
    expect(dump).toBe('00000000  41 42 43'.padEnd('00000000  '.length + 47) + '  ABC')
  })
})
