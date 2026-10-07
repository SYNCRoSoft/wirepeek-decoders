# wirepeek-decoders

Pure functions that turn real-time WebSocket payloads into something you can read.

No DOM, no browser-extension APIs, no network, no state. Every decoder takes bytes or a
string and returns a value — which is why they are easy to unit-test, and easy to lift
into something that is not a Chrome extension.

Extracted from [Wirepeek](https://chromewebstore.google.com/detail/wirepeek/ojoojkjcpibfddgcljlfbjobkcpcbejn),
a WebSocket inspector, so the decoding half can be read, reused, corrected, or ported.

## Why this exists

A WebSocket frame on the wire rarely looks like the thing your code sent. `42["chat",{…}]`
is an Engine.IO packet type 4 wrapping a Socket.IO packet type 2; a lone `2` is a heartbeat
that gets mistaken for application traffic; and a binary frame is usually a container with
real data a layer or two further down — base64 inside JSON inside a length-prefixed header.

Showing the bytes is the easy part. These modules do the other part.

## What is in here

| Module | What it handles |
|---|---|
| `socketio` | Engine.IO + Socket.IO framing → packet type, event name, payload |
| `binary` | bytes ↔ base64, hex dump, printable detection, binary→text |
| `binarydecode` | tries the binary serializers in order and returns the first that fully consumes the input |
| `msgpack` | MessagePack |
| `cbor` | CBOR |
| `thrift` | Thrift compact protocol (field ids, since there is no schema) |
| `jwt` | JWT header + payload (signature left as text) |
| `gzip` | gzip / deflate, via `DecompressionStream` |
| `lz4` | LZ4 frame format, including linked blocks — pure JS, no WASM |
| `base64json` | base64 that turns out to be JSON |
| `embedded` | JSON hiding behind a one- or two-character op-code, e.g. `t{…}`, `&d{…}` |
| `deepjson` | JSON nested inside JSON string fields, recursively |
| `imagemagic` | images sent inline, detected by magic bytes rather than a declared MIME type |
| `opaque` | tells "encrypted" from "merely encoded" |

### Two notes on the less obvious ones

**`binarydecode` fails on purpose.** A decoder that consumes part of its input and returns
plausible-looking garbage is worse than one that gives up, because you will believe it.
Each serializer must consume the whole buffer or it is rejected.

**`opaque` uses printable ratio, not entropy.** Entropy does not separate ciphertext from
base64 — in the samples this came from they sat at 5.3 and 5.1 bits per character, which is
far too close to threshold on. The share of printable bytes separates them cleanly.

## Use

```ts
import { decodeSocketIO, tryBinaryDecoders } from './src/index'

decodeSocketIO('42["chat message",{"text":"hi"}]')
// → { kind: 'event', event: 'chat message', ... }
```

Each module stands alone, so importing a single decoder pulls in almost nothing:

```ts
import { decodeThriftCompact } from './src/thrift'
```

## Tests

```
npm install
npm test
```

14 test files, 72 tests. They are the specification — if a decoder's behaviour surprises
you, the test file next to it says what was intended.

## Status

This is a snapshot taken from the extension, not a package that is published to a registry.
If it drifts from Wirepeek's own copy, this one is the one that is readable, and bug reports
against it are welcome.

## License

Apache-2.0. See [LICENSE](./LICENSE).
