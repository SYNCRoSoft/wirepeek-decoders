import { describe, expect, it } from 'vitest'
import { decodeBase64Value, isBase64Value } from './base64json'

const b64 = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64')

describe('base64 value', () => {
  it('decodes base64-of-JSON (object + array)', () => {
    expect(decodeBase64Value(b64({ user: 'ada', roles: ['admin'] }))).toEqual({ user: 'ada', roles: ['admin'] })
    expect(decodeBase64Value(b64([1, 2, 3]))).toEqual([1, 2, 3])
    expect(isBase64Value(b64({ a: 1 }))).toBe(true)
  })

  it('decodes base64-of-text (#55) as a string', () => {
    expect(decodeBase64Value(Buffer.from('the quick brown fox jumps').toString('base64'))).toBe('the quick brown fox jumps')
  })

  it('handles base64url without padding', () => {
    const url = b64({ x: 1 }).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeBase64Value(url)).toEqual({ x: 1 })
  })

  it('does NOT match non-base64 or gzip/lz4 prefixes', () => {
    expect(isBase64Value('hello world')).toBe(false) // has a space → not base64 alphabet
    expect(decodeBase64Value('H4sIAAAAAAAAAytLzClNBQAA')).toBeUndefined()
  })
})
