// Thrift Compact Protocol decoder (#16). STRICT: throws unless the whole buffer is a
// single struct (so we can tell real Thrift from random bytes when wired). Thrift
// carries NO field names (needs a .thrift schema), so fields surface as f1/f2/… — the
// structure is readable even if the labels aren't. Confirmed live on Meta Messenger
// (sync cursors). PURE → unit-tested. Big ints collapse to Number when exact, else String.

import { bytesToBase64 } from './binary'

interface Cur {
  p: number
}

// Compact field/element types.
const T_BOOL_TRUE = 1
const T_BOOL_FALSE = 2
const T_BYTE = 3
const T_I16 = 4
const T_I32 = 5
const T_I64 = 6
const T_DOUBLE = 7
const T_BINARY = 8
const T_LIST = 9
const T_SET = 10
const T_MAP = 11
const T_STRUCT = 12

/** Decode a Thrift Compact struct to a JS object; throws on malformed / trailing bytes. */
export function decodeThriftCompact(bytes: Uint8Array): unknown {
  const c: Cur = { p: 0 }
  const v = readStruct(bytes, c)
  if (c.p !== bytes.length) throw new Error('thrift: trailing bytes')
  return v
}

function readStruct(b: Uint8Array, c: Cur): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let lastId = 0
  for (;;) {
    const h = b[c.p++]
    if (h === undefined) throw new Error('thrift: truncated')
    if (h === 0) break // STOP
    const delta = h >> 4
    const type = h & 0x0f
    const id = delta === 0 ? Number(zigzag(b, c)) : lastId + delta
    lastId = id
    out[`f${id}`] = readValue(b, c, type)
  }
  return out
}

function readValue(b: Uint8Array, c: Cur, type: number): unknown {
  switch (type) {
    case T_BOOL_TRUE:
      return true
    case T_BOOL_FALSE:
      return false
    case T_BYTE:
      return (b[c.p++] << 24) >> 24 // signed i8
    case T_I16:
    case T_I32:
      return Number(zigzag(b, c))
    case T_I64:
      return big(zigzag(b, c))
    case T_DOUBLE: {
      const dv = new DataView(b.buffer, b.byteOffset + c.p, 8)
      c.p += 8
      return dv.getFloat64(0, true) // compact doubles are little-endian
    }
    case T_BINARY:
      return readBinary(b, c)
    case T_LIST:
    case T_SET:
      return readList(b, c)
    case T_MAP:
      return readMap(b, c)
    case T_STRUCT:
      return readStruct(b, c)
    default:
      throw new Error(`thrift: bad type ${type}`)
  }
}

function readList(b: Uint8Array, c: Cur): unknown[] {
  const h = b[c.p++]
  let n = h >> 4
  const et = h & 0x0f
  if (n === 15) n = Number(uvarint(b, c))
  const out: unknown[] = []
  for (let i = 0; i < n; i++) out.push(readValue(b, c, et))
  return out
}

function readMap(b: Uint8Array, c: Cur): Record<string, unknown> {
  const n = Number(uvarint(b, c))
  if (n === 0) return {}
  const kv = b[c.p++]
  const kt = kv >> 4
  const vt = kv & 0x0f
  const out: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const k = readValue(b, c, kt)
    out[String(k)] = readValue(b, c, vt)
  }
  return out
}

function readBinary(b: Uint8Array, c: Cur): string {
  const n = Number(uvarint(b, c))
  const slice = b.subarray(c.p, c.p + n)
  c.p += n
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(slice)
  } catch {
    return bytesToBase64(slice) // real binary → keep it inspectable
  }
}

/** Unsigned LEB128 varint. */
function uvarint(b: Uint8Array, c: Cur): bigint {
  let shift = 0n
  let result = 0n
  for (;;) {
    const byte = b[c.p++]
    if (byte === undefined) throw new Error('thrift: truncated varint')
    result |= BigInt(byte & 0x7f) << shift
    if ((byte & 0x80) === 0) return result
    shift += 7n
  }
}

/** Zigzag-decoded signed varint. */
function zigzag(b: Uint8Array, c: Cur): bigint {
  const v = uvarint(b, c)
  return (v >> 1n) ^ -(v & 1n)
}

function big(v: bigint): number | string {
  return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()
}
