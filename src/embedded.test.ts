import { describe, expect, it } from 'vitest'
import { extractEmbeddedJson } from './embedded'

describe('extractEmbeddedJson', () => {
  it('pulls JSON that follows a binary header (Facebook gateway shape)', () => {
    expect(extractEmbeddedJson('\x0f\x00\x00\x0c\x00\x00{"code":200}')).toEqual([{ code: 200 }])
  })

  it('extracts ALL packed messages — a leading control {} must not mask the payload', () => {
    // Facebook gateway packs a tiny `{}` then the real message in one frame (the bug).
    const text = '\x0f\x00\x00\x02\x00\x00{}\x0d\x00\x00\xe4{"app_id":"x","type":3}'
    expect(extractEmbeddedJson(text)).toEqual([{}, { app_id: 'x', type: 3 }])
  })

  it('handles nested containers + braces inside strings', () => {
    const text = '\x01\x02{"a":{"b":[1,2]},"s":"}]not-a-close"}\x00trailing'
    expect(extractEmbeddedJson(text)).toEqual([{ a: { b: [1, 2] }, s: '}]not-a-close' }])
  })

  it('extracts a leading array', () => {
    expect(extractEmbeddedJson('\x00[{"id":1}]')).toEqual([[{ id: 1 }]])
  })

  it('returns [] when there is no JSON', () => {
    expect(extractEmbeddedJson('\x00\x01\x02 plain bytes')).toEqual([])
  })

  it('skips an invalid candidate and finds the valid one', () => {
    expect(extractEmbeddedJson('{not json} {"ok":1}')).toEqual([{ ok: 1 }])
  })
})
