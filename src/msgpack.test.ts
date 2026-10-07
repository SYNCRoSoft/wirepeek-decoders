import { describe, expect, it } from 'vitest'
import { decodeMsgpack } from './msgpack'

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b)

describe('decodeMsgpack', () => {
  it('decodes a fixmap with nested fixarray + fixstr keys', () => {
    // {"a":1,"b":[2,3]}
    const buf = bytes(0x82, 0xa1, 0x61, 0x01, 0xa1, 0x62, 0x92, 0x02, 0x03)
    expect(decodeMsgpack(buf)).toEqual({ a: 1, b: [2, 3] })
  })

  it('decodes nil / bool / negative fixint', () => {
    expect(decodeMsgpack(bytes(0x93, 0xc0, 0xc3, 0xff))).toEqual([null, true, -1])
  })

  it('decodes uint16 + str8', () => {
    // [ 0x0102, "hi" ]  → 92 cd 01 02 d9 02 68 69
    expect(decodeMsgpack(bytes(0x92, 0xcd, 0x01, 0x02, 0xd9, 0x02, 0x68, 0x69))).toEqual([0x0102, 'hi'])
  })

  it('throws on trailing bytes (strictness → not-msgpack rejection)', () => {
    expect(() => decodeMsgpack(bytes(0x01, 0x02))).toThrow()
  })
})
