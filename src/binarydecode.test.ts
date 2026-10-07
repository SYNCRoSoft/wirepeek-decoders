import { describe, expect, it } from 'vitest'
import { tryBinaryDecoders } from './binarydecode'

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b)
const ALL = { msgpack: true, cbor: true, thrift: true }

describe('tryBinaryDecoders', () => {
  it('picks msgpack for a msgpack buffer', () => {
    // {"a":1} → 81 a1 61 01
    expect(tryBinaryDecoders(bytes(0x81, 0xa1, 0x61, 0x01), ALL)).toEqual({ format: 'msgpack', value: { a: 1 } })
  })

  it('does not claim a bare scalar (must be a container)', () => {
    // 0x01 alone is a valid msgpack int → rejected (not a container)
    expect(tryBinaryDecoders(bytes(0x01), ALL)).toBeUndefined()
  })

  it('returns undefined when no method is enabled', () => {
    expect(tryBinaryDecoders(bytes(0x81, 0xa1, 0x61, 0x01), { msgpack: false, cbor: false, thrift: false })).toBeUndefined()
  })
})
