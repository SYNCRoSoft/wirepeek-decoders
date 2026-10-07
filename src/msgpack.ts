// MessagePack decoder (#16). STRICT: throws unless the whole buffer decodes to a
// single value (used to tell "this really is msgpack" from random bytes when wired).
// Binary (bin/ext) is surfaced as base64 so it stays inspectable. Big ints collapse
// to Number when exact, else String (JSON-serializable for the tree / Copy formatted).
// PURE (no chrome.*/DOM) → unit-tested.

import { bytesToBase64 } from './binary'

interface Cur {
  p: number
}

/** Decode a MessagePack buffer to a JS value; throws on malformed / trailing bytes. */
export function decodeMsgpack(bytes: Uint8Array): unknown {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const c: Cur = { p: 0 }
  const value = readValue(bytes, dv, c)
  if (c.p !== bytes.length) throw new Error('msgpack: trailing bytes')
  return value
}

function readValue(b: Uint8Array, dv: DataView, c: Cur): unknown {
  const t = b[c.p++]
  if (t <= 0x7f) return t // positive fixint
  if (t >= 0xe0) return t - 256 // negative fixint
  if (t >= 0x80 && t <= 0x8f) return readMap(b, dv, c, t & 0x0f)
  if (t >= 0x90 && t <= 0x9f) return readArray(b, dv, c, t & 0x0f)
  if (t >= 0xa0 && t <= 0xbf) return readStr(b, c, t & 0x1f)

  switch (t) {
    case 0xc0:
      return null
    case 0xc2:
      return false
    case 0xc3:
      return true
    case 0xcc:
      return b[c.p++]
    case 0xcd:
      return u16(dv, c)
    case 0xce:
      return u32(dv, c)
    case 0xcf:
      return big(read(c, 8, (o) => dv.getBigUint64(o, false)))
    case 0xd0:
      return dv.getInt8(c.p++)
    case 0xd1:
      return read(c, 2, (o) => dv.getInt16(o, false))
    case 0xd2:
      return read(c, 4, (o) => dv.getInt32(o, false))
    case 0xd3:
      return big(read(c, 8, (o) => dv.getBigInt64(o, false)))
    case 0xca:
      return read(c, 4, (o) => dv.getFloat32(o, false))
    case 0xcb:
      return read(c, 8, (o) => dv.getFloat64(o, false))
    case 0xd9:
      return readStr(b, c, b[c.p++])
    case 0xda:
      return readStr(b, c, u16(dv, c))
    case 0xdb:
      return readStr(b, c, u32(dv, c))
    case 0xc4:
      return readBin(b, c, b[c.p++])
    case 0xc5:
      return readBin(b, c, u16(dv, c))
    case 0xc6:
      return readBin(b, c, u32(dv, c))
    case 0xdc:
      return readArray(b, dv, c, u16(dv, c))
    case 0xdd:
      return readArray(b, dv, c, u32(dv, c))
    case 0xde:
      return readMap(b, dv, c, u16(dv, c))
    case 0xdf:
      return readMap(b, dv, c, u32(dv, c))
    case 0xd4:
      return readExt(b, c, 1)
    case 0xd5:
      return readExt(b, c, 2)
    case 0xd6:
      return readExt(b, c, 4)
    case 0xd7:
      return readExt(b, c, 8)
    case 0xd8:
      return readExt(b, c, 16)
    case 0xc7:
      return readExt(b, c, b[c.p++])
    case 0xc8:
      return readExt(b, c, u16(dv, c))
    case 0xc9:
      return readExt(b, c, u32(dv, c))
    default:
      throw new Error(`msgpack: bad byte 0x${t.toString(16)}`)
  }
}

/** Read a fixed-width field at the cursor and advance it by `n`. */
function read<T>(c: Cur, n: number, get: (offset: number) => T): T {
  const v = get(c.p)
  c.p += n
  return v
}
function u16(dv: DataView, c: Cur): number {
  return read(c, 2, (o) => dv.getUint16(o, false))
}
function u32(dv: DataView, c: Cur): number {
  return read(c, 4, (o) => dv.getUint32(o, false))
}
function big(v: bigint): number | string {
  return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()
}

function readStr(b: Uint8Array, c: Cur, n: number): string {
  const s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(c.p, c.p + n))
  c.p += n
  return s
}
function readBin(b: Uint8Array, c: Cur, n: number): string {
  const s = bytesToBase64(b.subarray(c.p, c.p + n))
  c.p += n
  return s
}
function readExt(b: Uint8Array, c: Cur, n: number): unknown {
  const extType = b[c.p++]
  return { $ext: extType, data: readBin(b, c, n) }
}
function readArray(b: Uint8Array, dv: DataView, c: Cur, n: number): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < n; i++) out.push(readValue(b, dv, c))
  return out
}
function readMap(b: Uint8Array, dv: DataView, c: Cur, n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const k = readValue(b, dv, c)
    out[String(k)] = readValue(b, dv, c)
  }
  return out
}
