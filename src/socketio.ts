// Pure socket.io / engine.io frame decoder. ZERO chrome.*/DOM — fully testable.
// v0 scaffold scope: cover the common engine.io message + socket.io packet shape
// (e.g. `42["event",{...}]`, `42/admin,["evt",{...}]`, `40`, `2`). Binary
// attachments and the placeholder protocol are out of scope for now (CF-104 will
// extend this; §Parked covers other protocols).

export type EngineType = 'open' | 'close' | 'ping' | 'pong' | 'message' | 'upgrade' | 'noop'
export type SocketType =
  | 'connect'
  | 'disconnect'
  | 'event'
  | 'ack'
  | 'connect_error'
  | 'binary_event'
  | 'binary_ack'

export interface DecodedFrame {
  protocol: 'socket.io' | 'engine.io' | 'unknown'
  engineType?: EngineType
  socketType?: SocketType
  /** socket.io namespace (defaults to '/'). */
  namespace?: string
  /** Event name for EVENT / BINARY_EVENT packets. */
  event?: string
  /** Parsed JSON payload (array for events) or raw string on parse failure. */
  payload?: unknown
  /** Acknowledgement id, when present. */
  ackId?: number
}

const ENGINE: Record<string, EngineType | undefined> = {
  '0': 'open',
  '1': 'close',
  '2': 'ping',
  '3': 'pong',
  '4': 'message',
  '5': 'upgrade',
  '6': 'noop',
}

const SOCKET: Record<string, SocketType | undefined> = {
  '0': 'connect',
  '1': 'disconnect',
  '2': 'event',
  '3': 'ack',
  '4': 'connect_error',
  '5': 'binary_event',
  '6': 'binary_ack',
}

export function decodeSocketIO(raw: string): DecodedFrame {
  if (raw.length === 0) return { protocol: 'unknown' }

  const engineType = ENGINE[raw[0]]
  if (engineType === undefined) return { protocol: 'unknown' }

  // Anything that is not an engine.io "message" carries no socket.io packet.
  if (engineType !== 'message') return { protocol: 'engine.io', engineType }

  let rest = raw.slice(1)
  if (rest.length === 0) return { protocol: 'engine.io', engineType }

  const socketType = SOCKET[rest[0]]
  if (socketType === undefined) return { protocol: 'engine.io', engineType }
  rest = rest.slice(1)

  // Optional namespace: "/foo," prefix. Default namespace is "/".
  let namespace = '/'
  if (rest.startsWith('/')) {
    const comma = rest.indexOf(',')
    if (comma === -1) {
      namespace = rest
      rest = ''
    } else {
      namespace = rest.slice(0, comma)
      rest = rest.slice(comma + 1)
    }
  }

  // Optional ack id: leading digits before the JSON payload.
  let ackId: number | undefined
  const ackMatch = /^\d+/.exec(rest)
  if (ackMatch) {
    ackId = Number(ackMatch[0])
    rest = rest.slice(ackMatch[0].length)
  }

  let payload: unknown
  let event: string | undefined
  if (rest.length > 0) {
    try {
      payload = JSON.parse(rest)
      if (Array.isArray(payload) && (socketType === 'event' || socketType === 'binary_event')) {
        event = typeof payload[0] === 'string' ? payload[0] : undefined
      }
    } catch {
      // Graceful degradation (CNF-204): keep the raw text instead of throwing.
      payload = rest
    }
  }

  return { protocol: 'socket.io', engineType, socketType, namespace, event, payload, ackId }
}
