import { describe, expect, it } from 'vitest'
import { decodeSocketIO } from './socketio'

describe('decodeSocketIO', () => {
  it('decodes an engine.io ping (no socket.io packet)', () => {
    expect(decodeSocketIO('2')).toEqual({ protocol: 'engine.io', engineType: 'ping' })
  })

  it('decodes a socket.io CONNECT on the default namespace', () => {
    const f = decodeSocketIO('40')
    expect(f.protocol).toBe('socket.io')
    expect(f.socketType).toBe('connect')
    expect(f.namespace).toBe('/')
  })

  it('decodes a socket.io EVENT with name + payload', () => {
    const f = decodeSocketIO('42["chat message","hello"]')
    expect(f.protocol).toBe('socket.io')
    expect(f.socketType).toBe('event')
    expect(f.event).toBe('chat message')
    expect(f.payload).toEqual(['chat message', 'hello'])
  })

  it('decodes a namespaced EVENT', () => {
    const f = decodeSocketIO('42/admin,["evt",{"a":1}]')
    expect(f.namespace).toBe('/admin')
    expect(f.event).toBe('evt')
    expect(f.payload).toEqual(['evt', { a: 1 }])
  })

  it('decodes an ACK with id', () => {
    const f = decodeSocketIO('430["ok"]')
    expect(f.socketType).toBe('ack')
    expect(f.ackId).toBe(0)
    expect(f.payload).toEqual(['ok'])
  })

  it('returns unknown for empty input', () => {
    expect(decodeSocketIO('')).toEqual({ protocol: 'unknown' })
  })

  it('degrades gracefully on malformed JSON payload', () => {
    const f = decodeSocketIO('42{not json')
    expect(f.protocol).toBe('socket.io')
    expect(f.payload).toBe('{not json')
  })
})
