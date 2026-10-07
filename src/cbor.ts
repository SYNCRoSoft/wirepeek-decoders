// CBOR decoder (RFC 8949) for #16. STRICT: throws unless the whole buffer decodes to
// one value (so we can tell real CBOR from random bytes when wired). Byte strings →
// base64; tags are transparent (decode the tagged item); indefinite-length supported.
// Big ints collapse to Number when exact, else String. PURE → unit-tested.

import { bytesToBase64 } from './binary'

interface Cur {
  p: number
}
const BREAK = Symbol('cbor-break')

/** Decode a CBOR buffer to a JS value; throws on malformed / trailing bytes. */
export function decodeCbor(bytes: Uint8Array): unknown {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const c: Cur = { p: 0 }
  const v = readItem(bytes, dv, c)
  if (v === BREAK) throw new Error('cbor: unexpected break')
  if (c.p !== bytes.length) throw new Error('cbor: trailing bytes')
  return v
}

function readItem(b: Uint8Array, dv: DataView, c: Cur): unknown {
  const ib = b[c.p++]
  const mt = ib >> 5
  const ai = ib & 0x1f

  if (mt === 7) return readSimple(dv, c, ai)
  if (ai === 31) return readIndefinite(b, dv, c, mt)

  const arg = readArg(b, dv, c, ai)
  switch (mt) {
    case 0:
      return num(arg)
    case 1:
      return typeof arg === 'bigint' ? big(-1n - arg) : -1 - arg
    case 2:
      return readBytes(b, c, Number(arg))
    case 3:
      return readText(b, c, Number(arg))
    case 4:
      return readArray(b, dv, c, Number(arg))
    case 5:
      return readMap(b, dv, c, Number(arg))
    case 6:
      return readItem(b, dv, c) // tag → transparent (decode the tagged item)
    default:
      throw new Error('cbor: bad major type')
  }
}

function readArg(b: Uint8Array, dv: DataView, c: Cur, ai: number): number | bigint {
  if (ai < 24) return ai
  if (ai === 24) return b[c.p++]
  if (ai === 25) {
    const v = dv.getUint16(c.p, false)
    c.p += 2
    return v
  }
  if (ai === 26) {
    const v = dv.getUint32(c.p, false)
    c.p += 4
    return v
  }
  if (ai === 27) {
    const v = dv.getBigUint64(c.p, false)
    c.p += 8
    return v
  }
  throw new Error('cbor: bad additional info')
}

function readSimple(dv: DataView, c: Cur, ai: number): unknown {
  switch (ai) {
    case 20:
      return false
    case 21:
      return true
    case 22:
      return null
    case 23:
      return undefined
    case 24:
      return dv.getUint8(c.p++) // simple value
    case 25: {
      const v = half(dv.getUint16(c.p, false))
      c.p += 2
      return v
    }
    case 26: {
      const v = dv.getFloat32(c.p, false)
      c.p += 4
      return v
    }
    case 27: {
      const v = dv.getFloat64(c.p, false)
      c.p += 8
      return v
    }
    case 31:
      return BREAK
    default:
      return ai // simple value < 24
  }
}

function readIndefinite(b: Uint8Array, dv: DataView, c: Cur, mt: number): unknown {
  if (mt === 4) {
    const out: unknown[] = []
    for (;;) {
      const v = readItem(b, dv, c)
      if (v === BREAK) return out
      out.push(v)
    }
  }
  if (mt === 5) {
    const out: Record<string, unknown> = {}
    for (;;) {
      const k = readItem(b, dv, c)
      if (k === BREAK) return out
      out[String(k)] = readItem(b, dv, c)
    }
  }
  if (mt === 3) {
    let s = ''
    for (;;) {
      const v = readItem(b, dv, c)
      if (v === BREAK) return s
      s += String(v)
    }
  }
  if (mt === 2) {
    const parts: string[] = []
    for (;;) {
      const v = readItem(b, dv, c)
      if (v === BREAK) return parts.join('')
      parts.push(String(v))
    }
  }
  throw new Error('cbor: bad indefinite item')
}

function readBytes(b: Uint8Array, c: Cur, n: number): string {
  const s = bytesToBase64(b.subarray(c.p, c.p + n))
  c.p += n
  return s
}
function readText(b: Uint8Array, c: Cur, n: number): string {
  const s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(c.p, c.p + n))
  c.p += n
  return s
}
function readArray(b: Uint8Array, dv: DataView, c: Cur, n: number): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < n; i++) out.push(readItem(b, dv, c))
  return out
}
function readMap(b: Uint8Array, dv: DataView, c: Cur, n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < n; i++) {
    const k = readItem(b, dv, c)
    out[String(k)] = readItem(b, dv, c)
  }
  return out
}

function num(arg: number | bigint): number | string {
  return typeof arg === 'bigint' ? big(arg) : arg
}
function big(v: bigint): number | string {
  return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()
}
function half(u: number): number {
  const sign = u & 0x8000 ? -1 : 1
  const exp = (u >> 10) & 0x1f
  const frac = u & 0x3ff
  if (exp === 0) return sign * frac * 2 ** -24
  if (exp === 31) return frac ? NaN : sign * Infinity
  return sign * (1 + frac / 1024) * 2 ** (exp - 15)
}
