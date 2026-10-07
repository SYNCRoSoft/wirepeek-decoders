// Detect gzip-in-base64 strings (#13). Real gzip starts with the magic bytes
// 1f 8b 08, which base64-encode to a string beginning "H4sI". Detection only
// (pure, testable); the actual gunzip uses DecompressionStream in the panel
// (a browser API), kept out of lib/.

/** True if `s` looks like a base64-encoded gzip payload (e.g. SignalR `R`/`A[i]`). */
export function isGzipBase64(s: string): boolean {
  // "H4sI" = base64 of 0x1f 0x8b 0x08 (gzip magic + deflate). Require some length
  // and a base64 alphabet to avoid matching short coincidences.
  return s.length >= 24 && s.startsWith('H4sI') && /^[A-Za-z0-9+/]+={0,2}$/.test(s)
}

/** True if `s` looks like base64 of a zlib-wrapped deflate stream (#16 deflate method).
 *  zlib header CMF=0x78 → base64 starts "eJ"/"eN"/"eA"/"eF"/"eL" (0x78 0x9c/0xda/…). */
export function isZlibBase64(s: string): boolean {
  return s.length >= 24 && /^e[JNAFL]/.test(s) && /^[A-Za-z0-9+/]+={0,2}$/.test(s)
}
