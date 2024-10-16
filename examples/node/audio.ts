import 'dotenv/config'

import fs from 'node:fs/promises'

import decodeAudio from 'audio-decode'
import { arrayBufferToBase64, RealtimeClient } from 'openai-realtime-api'

/**
 * Simple Node.js demo using the `RealtimeClient` which sends a short audio
 * message and waits for a complete response.
 */
async function main() {
  const audioFile = await fs.readFile('./fixtures/toronto.mp3')
  const audioBuffer = await decodeAudio(audioFile)
  const channelData = audioBuffer.getChannelData(0) // only accepts mono
  const audio = arrayBufferToBase64(channelData)

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

  console.log('Sending toronto.mp3 audio message...')
  client.sendUserMessageContent([{ type: 'input_audio', audio }])

  const event = await client.realtime.waitForNext('response.done')
  console.log(JSON.stringify(event, null, 2))

  client.disconnect()
}

await main()
