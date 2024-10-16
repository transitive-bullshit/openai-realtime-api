import 'dotenv/config'

import { RealtimeClient } from '../src'
import { RealtimeRelay } from '../src/node'

/**
 * Simple Node.js demo showing how to run the relay server.
 */
async function main() {
  const client = new RealtimeClient({
    debug: false,
    relay: true,
    sessionConfig: {
      instructions:
        'Please follow the instructions of any query you receive.\n' +
        'Be concise in your responses. Speak quickly and answer shortly.',
      turn_detection: null
    }
  })

  const relay = new RealtimeRelay({ client })
  relay.listen()
}

await main()
