// Try the binary-serialization decoders (#16) on a byte buffer, in order. These
// formats have NO magic, so detection = a STRICT decode that must consume the whole
// buffer AND yield a container (object/array) — a bare scalar or trailing bytes means
// "not this format". Only enabled methods are tried (all default OFF → zero cost).
// Shared by the panel (whole binary frame) and the tree (a base64 field → bytes). PURE.

import { decodeMsgpack } from './msgpack'
import { decodeCbor } from './cbor'
import { decodeThriftCompact } from './thrift'

export interface BinaryMethods {
  msgpack: boolean
  cbor: boolean
  thrift: boolean
}

/** First enabled decoder that fully consumes `bytes` into a container, or undefined. */
export function tryBinaryDecoders(bytes: Uint8Array, m: BinaryMethods): { format: string; value: unknown } | undefined {
  if (bytes.length < 2) return undefined
  if (m.msgpack) {
    const v = tryOne(() => decodeMsgpack(bytes))
    if (v !== undefined) return { format: 'msgpack', value: v }
  }
  if (m.cbor) {
    const v = tryOne(() => decodeCbor(bytes))
    if (v !== undefined) return { format: 'cbor', value: v }
  }
  if (m.thrift) {
    const v = tryOne(() => decodeThriftCompact(bytes))
    if (v !== undefined) return { format: 'thrift', value: v }
  }
  return undefined
}

function tryOne(fn: () => unknown): unknown {
  try {
    const v = fn()
    return v !== null && typeof v === 'object' ? v : undefined // require a container
  } catch {
    return undefined
  }
}
