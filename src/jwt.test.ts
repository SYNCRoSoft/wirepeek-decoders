import { describe, expect, it } from 'vitest'
import { decodeJwt, isJwt } from './jwt'

// A real-shape JWT: {"alg":"HS256","typ":"JWT"} . {"sub":"123","name":"Ada","admin":true} . sig
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiQWRhIiwiYWRtaW4iOnRydWV9.q3v-abc_SIG'

describe('isJwt', () => {
  it('accepts a JWT with a JOSE header', () => {
    expect(isJwt(JWT)).toBe(true)
  })

  it('rejects non-JWTs', () => {
    expect(isJwt('a.b.c')).toBe(false) // segments not JSON
    expect(isJwt('eyJhbGciOiJIUzI1NiJ9.eyJ4IjoxfQ')).toBe(false) // only 2 segments
    expect(isJwt('hello world')).toBe(false)
  })
})

describe('decodeJwt', () => {
  it('decodes header + payload, keeps the signature as text', () => {
    expect(decodeJwt(JWT)).toEqual({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: '123', name: 'Ada', admin: true },
      signature: 'q3v-abc_SIG',
    })
  })

  it('returns undefined on a malformed token', () => {
    expect(decodeJwt('only.two')).toBeUndefined()
  })
})
