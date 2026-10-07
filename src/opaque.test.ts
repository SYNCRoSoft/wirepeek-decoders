import { describe, expect, it } from 'vitest'
import { looksOpaqueBlob } from './opaque'

const b64 = (s: string): string => Buffer.from(s).toString('base64')

describe('looksOpaqueBlob', () => {
  it('flags Meta encrypted tokens (prefix + high-entropy binary)', () => {
    expect(looksOpaqueBlob('fase.ARv5gMWkCK2dwS0QfpC7LVdLnKqvE1HpJD_fvmvDmi1XOWA9JjXtoOMKHCs4qxq_3OFrsH0')).toBe(true)
    expect(looksOpaqueBlob('fd.ARsTrCc3oTEbw4Aj0GRoJKLh1R2ljJKEhX_ej6Az-rs04IOya8eTtWklzHVVhdb2--EqpSHa9')).toBe(true)
  })

  it('does NOT flag base64-of-JSON or base64-of-text (decodable → printable bytes)', () => {
    expect(looksOpaqueBlob(b64(JSON.stringify({ user: 'alice', role: 'admin', items: [1, 2, 3] })))).toBe(false)
    expect(looksOpaqueBlob(b64('The quick brown fox jumps over the lazy dog repeatedly enough'))).toBe(false)
  })

  it('does NOT flag hex hashes, short strings, or plain values', () => {
    expect(looksOpaqueBlob('a591b3f4c2e1d0a9b8c7d6e5f40312233445566778899aabbccddeeff00112233')).toBe(false)
    expect(looksOpaqueBlob('hello world')).toBe(false)
    expect(looksOpaqueBlob('short')).toBe(false)
  })

  it('does NOT flag gzip/lz4 base64 (those are decodable, handled elsewhere)', () => {
    expect(looksOpaqueBlob('H4sIAAAAAAAAAytLzClNBQAA6AA6AAAAAAAAAAAAAAAAAAAA')).toBe(false)
  })
})
