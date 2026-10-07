import { describe, expect, it } from 'vitest'
import { decodeCbor } from './cbor'

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b)

describe('decodeCbor', () => {
  it('decodes a map {"a":1,"b":[2,3]}', () => {
    // a2 61 61 01 61 62 82 02 03
    const buf = bytes(0xa2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x82, 0x02, 0x03)
    expect(decodeCbor(buf)).toEqual({ a: 1, b: [2, 3] })
  })

  it('decodes false/true/null + negative int', () => {
    // 84 f4 f5 f6 20  → [false, true, null, -1]
    expect(decodeCbor(bytes(0x84, 0xf4, 0xf5, 0xf6, 0x20))).toEqual([false, true, null, -1])
  })

  it('decodes uint16 + text', () => {
    // [ 0x0102, "hi" ] → 82 19 01 02 62 68 69
    expect(decodeCbor(bytes(0x82, 0x19, 0x01, 0x02, 0x62, 0x68, 0x69))).toEqual([0x0102, 'hi'])
  })

  it('decodes an indefinite-length array', () => {
    // 9f 01 02 ff → [1,2]
    expect(decodeCbor(bytes(0x9f, 0x01, 0x02, 0xff))).toEqual([1, 2])
  })

  it('throws on trailing bytes', () => {
    expect(() => decodeCbor(bytes(0x01, 0x02))).toThrow()
  })
})
