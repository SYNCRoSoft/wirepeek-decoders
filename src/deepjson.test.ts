import { describe, expect, it } from 'vitest'
import { deepParseJson } from './deepjson'

describe('deepParseJson', () => {
  it('leaves plain values untouched', () => {
    expect(deepParseJson(42)).toBe(42)
    expect(deepParseJson(true)).toBe(true)
    expect(deepParseJson(null)).toBe(null)
    expect(deepParseJson('hello')).toBe('hello')
  })

  it('does not re-type bare JSON scalars in strings', () => {
    // "true"/"42" are valid JSON but re-typing them would surprise, not clarify.
    expect(deepParseJson('true')).toBe('true')
    expect(deepParseJson('42')).toBe('42')
  })

  it('parses a JSON object nested as a string field (ActionCable shape)', () => {
    const input = {
      command: 'message',
      identifier: '{"channel":"MatchChannel"}',
      data: '{"action":"match","queue":"video","id":null}',
    }
    expect(deepParseJson(input)).toEqual({
      command: 'message',
      identifier: { channel: 'MatchChannel' },
      data: { action: 'match', queue: 'video', id: null },
    })
  })

  it('descends through multiple levels of stringified JSON', () => {
    const input = '{"a":"{\\"b\\":\\"{\\\\\\"c\\\\\\":1}\\"}"}'
    expect(deepParseJson(input)).toEqual({ a: { b: { c: 1 } } })
  })

  it('recurses into arrays', () => {
    expect(deepParseJson(['{"x":1}', 'plain', '[2,3]'])).toEqual([{ x: 1 }, 'plain', [2, 3]])
  })

  it('keeps non-JSON strings as-is', () => {
    const input = { note: 'not json {oops', url: 'wss://example.com/socket' }
    expect(deepParseJson(input)).toEqual(input)
  })

  it('is bounded on deeply nested input (no throw, stops at MAX_DEPTH)', () => {
    // 20 levels of stringified-JSON exceeds MAX_DEPTH (12); deepParseJson must
    // stop descending and return without throwing. (Kept at 20 because each
    // JSON.stringify roughly doubles the length — 50 would overflow the string
    // length limit during test setup, not in the function under test.)
    let s = '1'
    for (let i = 0; i < 20; i++) s = JSON.stringify(s)
    expect(() => deepParseJson(s)).not.toThrow()
  })
})
