import { describe, expect, it } from 'vitest'
import { decodeThriftCompact } from './thrift'

const bytes = (...b: number[]): Uint8Array => Uint8Array.from(b)

describe('decodeThriftCompact', () => {
  it('decodes a struct with i32 fields (field-id deltas)', () => {
    // {f1: zigzag(4)=2, f2: zigzag(8)=4} then STOP → 15 04 15 08 00
    expect(decodeThriftCompact(bytes(0x15, 0x04, 0x15, 0x08, 0x00))).toEqual({ f1: 2, f2: 4 })
  })

  it('decodes a nested struct field', () => {
    // f1 = struct{ f1: i32 2 } : 1c 15 04 00 00
    expect(decodeThriftCompact(bytes(0x1c, 0x15, 0x04, 0x00, 0x00))).toEqual({ f1: { f1: 2 } })
  })

  it('decodes a list<i32> field', () => {
    // f1 (delta1, type LIST=9) = 0x19 ; list header 0x25 = size2,type i32(5) ; 02 04 ; STOP
    expect(decodeThriftCompact(bytes(0x19, 0x25, 0x02, 0x04, 0x00))).toEqual({ f1: [1, 2] })
  })

  it('throws on trailing bytes', () => {
    expect(() => decodeThriftCompact(bytes(0x15, 0x04, 0x00, 0x99))).toThrow()
  })
})
