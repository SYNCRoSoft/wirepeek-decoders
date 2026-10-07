// LZ4 Frame decoder (#52.a). Unlike gzip (#13, which uses the browser's native
// DecompressionStream), LZ4 has no native API — but the format is small enough to
// decode in pure TS here, so this whole module is pure + vitest-testable (lib/).
//
// Seen on SignalR feeds (e.g. betting live-diffs): the Invocation argument is a
// base64 string whose bytes are an LZ4 frame wrapping JSON. Detection is by the
// frame magic; the decode is lazy (only on user click, in jsontree.ts).
//
// Supports the LZ4 Frame format (magic 0x184D2204) with linked blocks (B.Indep=0,
// so a match can reach into earlier blocks — we keep one continuous output).
// Block/content checksums are skipped, not verified. Legacy/skippable frames: N/A.

const MAGIC = 0x184d2204

/** True if `s` looks like a base64-encoded LZ4 frame. */
export function isLz4Base64(s: string): boolean {
  // Magic bytes 04 22 4D 18 base64-encode to a deterministic "BCJNG" prefix.
  return s.length >= 24 && s.startsWith('BCJNG') && /^[A-Za-z0-9+/]+={0,2}$/.test(s)
}

/** Decompress an LZ4 frame. Throws on a malformed frame/block. */
export function decompressLz4Frame(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let p = 0
  if (view.getUint32(p, true) !== MAGIC) throw new Error('not an LZ4 frame')
  p += 4

  const flg = data[p++]
  p++ // BD (block max size) — not needed for decode
  if ((flg >> 6) !== 1) throw new Error('unsupported LZ4 frame version')
  const contentSizeFlag = (flg >> 3) & 1
  const contentChecksumFlag = (flg >> 2) & 1
  const dictIdFlag = flg & 1
  const blockChecksumFlag = (flg >> 4) & 1
  if (contentSizeFlag) p += 8
  if (dictIdFlag) p += 4
  p++ // header checksum (not verified)

  const out: number[] = []
  while (p + 4 <= data.length) {
    const bsize = view.getUint32(p, true)
    p += 4
    if (bsize === 0) break // EndMark
    const size = bsize & 0x7fffffff
    if (bsize & 0x80000000) {
      for (let k = 0; k < size; k++) out.push(data[p + k]) // uncompressed block
    } else {
      decodeBlock(data, p, p + size, out)
    }
    p += size
    if (blockChecksumFlag) p += 4
  }
  void contentChecksumFlag // trailing content checksum (if any) ignored
  return Uint8Array.from(out)
}

/** Decode one LZ4 block (LZ4 block format) into `out` (may back-reference earlier). */
function decodeBlock(src: Uint8Array, start: number, end: number, out: number[]): void {
  let i = start
  while (i < end) {
    const token = src[i++]
    // Literals.
    let litLen = token >> 4
    if (litLen === 15) {
      let b: number
      do {
        b = src[i++]
        litLen += b
      } while (b === 255)
    }
    for (let k = 0; k < litLen; k++) out.push(src[i++])
    if (i >= end) break // a block ends on a literal run (no trailing match)
    // Match: 2-byte little-endian offset back into the output, length = nibble + 4.
    const offset = src[i] | (src[i + 1] << 8)
    i += 2
    let matchLen = token & 0xf
    if (matchLen === 15) {
      let b: number
      do {
        b = src[i++]
        matchLen += b
      } while (b === 255)
    }
    matchLen += 4
    let m = out.length - offset
    if (offset === 0 || m < 0) throw new Error('bad LZ4 match offset')
    for (let k = 0; k < matchLen; k++) out.push(out[m++]) // byte-wise → overlap is intended
  }
}
