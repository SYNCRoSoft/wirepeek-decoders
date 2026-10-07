import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { isGzipBase64 } from './gzip'

describe('isGzipBase64', () => {
  it('detects a real gzip+base64 payload', () => {
    const b64 = gzipSync(Buffer.from('{"hello":"world"}')).toString('base64')
    expect(b64.startsWith('H4sI')).toBe(true)
    expect(isGzipBase64(b64)).toBe(true)
  })

  it('rejects plain text and JSON', () => {
    expect(isGzipBase64('hello world')).toBe(false)
    expect(isGzipBase64('{"a":1}')).toBe(false)
  })

  it('rejects strings too short to be a real payload', () => {
    expect(isGzipBase64('H4sI')).toBe(false)
  })

  it('rejects non-base64 (spaces/newlines)', () => {
    expect(isGzipBase64('H4sI this is not base64 at all really')).toBe(false)
  })
})
