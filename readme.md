# openai-realtime-api <!-- omit from toc -->

> TypeScript client for OpenAI's beta realtime voice API.

<p>
  <a href="https://github.com/transitive-bullshit/openai-realtime-api/actions/workflows/main.yml"><img alt="Build Status" src="https://github.com/transitive-bullshit/openai-realtime-api/actions/workflows/main.yml/badge.svg" /></a>
  <a href="https://www.npmjs.com/package/openai-realtime-api"><img alt="NPM" src="https://img.shields.io/npm/v/openai-realtime-api.svg" /></a>
  <a href="https://github.com/transitive-bullshit/openai-realtime-api/blob/main/license"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="https://prettier.io"><img alt="Prettier Code Formatting" src="https://img.shields.io/badge/code_style-prettier-brightgreen.svg" /></a>
</p>

- [Features](#features)
- [Install](#install)
- [Usage](#usage)
  - [Server Usage](#server-usage)
  - [Browser Usage](#browser-usage)
  - [Relay Server](#relay-server)
  - [Examples](#examples)
- [TODO](#todo)
- [License](#license)

## Features

- **Strongly typed** TS fork of [openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta)
- [All events](./src/events.ts) and handlers are 100% typed
- 100% drop-in replacement for OpenAI's JS version (same events and classes)
- Fixes dozens of small bugs and inconsistencies
  - https://github.com/openai/openai-realtime-api-beta/pull/11, https://github.com/openai/openai-realtime-api-beta/pull/34, https://github.com/openai/openai-realtime-api-beta/pull/29, https://github.com/openai/openai-realtime-api-beta/pull/17, https://github.com/openai/openai-realtime-api-beta/pull/37, https://github.com/openai/openai-realtime-api-beta/pull/44, https://github.com/openai/openai-realtime-api-beta/pull/43, https://github.com/openai/openai-realtime-api-beta/pull/35, https://github.com/openai/openai-realtime-api-beta/issues/3, https://github.com/openai/openai-realtime-api-beta/issues/14, and probably others.
- Published to NPM
- Includes CLI examples for easy local testing
- Includes a simple relay server (via a separate export)

## Install

```sh
npm install openai-realtime-api
```

This package is [ESM-only](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c). It requires `Node.js >= 18` or a browser-like environment (any modern browser, Deno, Bun, CF workers, etc).

## Usage

```ts
import { RealtimeClient } from 'openai-realtime-api'

// Create a new client; all params are optional, and the apiKey defaults to the
// `OPENAI_API_KEY` environment variable (when on Node.js).
const client = new RealtimeClient({
  sessionConfig: {
    instructions: 'You are a great, upbeat friend.',
    voice: 'alloy'
  }
})

// Can set parameters ahead of connecting, either separately or all at once.
client.updateSession({
  turn_detection: null,
  input_audio_transcription: { model: 'whisper-1' }
})

// Set up event handling
client.on('conversation.updated', (event) => {
  // All events are fully-typed based on the event name.
  // In this case, `event` will have the type `RealtimeCustomEvents.ConversationUpdatedEvent`
  // `item` is the current item being updated.
  // `delta` is optional for this event.
  const { item, delta } = event

  // Access the full list of conversation items.
  const items = client.conversation.getItems()
})

// Connect to the Realtime API.
await client.connect()

// Send a text message and trigger a response generation.
client.sendUserMessageContent([{ type: 'input_text', text: 'How are you?' }])

// Wait for a completed response from the model.
// (`event` will be of type `RealtimeServerEvents.ResponseDoneEvent`)
const event = await client.realtime.waitForNext('response.done')
```

> [!IMPORTANT]
> All events are 100% compatible with [OpenAI JS version](https://github.com/openai/openai-realtime-api-beta). The only difference is that they are fully-typed. So check out their [readme](https://github.com/openai/openai-realtime-api-beta) for more detailed docs.

See [examples](#examples) for more complete demos.

### Server Usage

`RealtimeClient` takes in an optional `apiKey` which defaults to `process.env.OPENAI_API_KEY`.

### Browser Usage

`RealtimeClient` takes in an optional `url` which can be pointed at a relay server. You can use `apiKey` with `RealtimeClient` in the browser, but you also have to pass `dangerouslyAllowAPIKeyInBrowser: true`.

### Relay Server

```ts
import { RealtimeClient } from 'openai-realtime-api'
import { RealtimeRelay } from 'openai-realtime-api/node'

// Setting `relay: true` disables tool calls, since that will be the
// responsibility of the upstream client.
const client = new RealtimeClient({ relay: true })
const relay = new RealtimeRelay({ client })

relay.listen(8081)
```

Note that the `RealtimeRelay` uses a different import path because it contains Node.js-specific code.

A full example is included in `examples/node-relay-server.ts`.

### Examples

To run the included examples (requires `Node.js >= 18`):

1. Clone this repo
2. Run `pnpm install`
3. Setup `.env` with your `OPENAI_API_KEY`

- [Node.js basic](./examples/node-basic.ts)
  - Simple Node.js demo using the `RealtimeClient` which sends a text message and waits for a complete response.
  - `npx tsx examples/node-basic.ts`
- [Node.js audio](./examples/node-audio.ts)
  - Simple Node.js demo using the `RealtimeClient` which sends a short audio message and waits for a complete response.
  - `npx tsx examples/node-audio.ts`
- [Node.js conversation](./examples/node-convo.ts)
  - Simple Node.js demo using the `RealtimeClient` with a microphone and speaker to simulate a full, back & forth conversation from the terminal.
  - This demo uses the [mic](https://github.com/ashishbajaj99/mic) and [speaker](https://github.com/TooTallNate/node-speaker) npm packages.
  - `mic` requires [sox](https://sourceforge.net/projects/sox/); on macOS, you can run `brew install sox`
  - `npx tsx examples/node-convo.ts`

You can set `debug: true` in any of these to print out the full event log.

## TODO

- add [openai-realtime-console](https://github.com/openai/openai-realtime-console) as an example showing drop-in replacement
- add an example using tools
- add an example next.js app
- improve readme docs

## License

MIT © [Travis Fischer](https://x.com/transitive_bs)

If you found this project interesting, [consider following me on Twitter](https://x.com/transitive_bs).
