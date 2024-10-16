import 'dotenv/config'

import { RealtimeClient } from 'openai-realtime-api'

/**
 * Simple Node.js demo using the `RealtimeClient` which sends a text message and
 * waits for a complete response.
 */
async function main() {
  const client = new RealtimeClient({
    debug: false,
    sessionConfig: {
      instructions:
        'Please follow the instructions of any query you receive.\n' +
        'Be concise in your responses. Speak quickly and answer shortly.',
      turn_detection: null
    }
  })

  await client.connect()
  await client.waitForSessionCreated()

  const text = 'How are you?'
  console.log(text)
  client.sendUserMessageContent([{ type: 'input_text', text }])

  const event = await client.realtime.waitForNext('response.done')
  console.log(JSON.stringify(event, null, 2))

  client.disconnect()
}

await main()
