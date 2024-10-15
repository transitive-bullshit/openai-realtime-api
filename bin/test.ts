import 'dotenv/config'

// import fs from 'node:fs/promises'
// import decodeAudio from 'audio-decode'
import {
  // arrayBufferToBase64,
  getEnv,
  RealtimeClient,
  type RealtimeServerEvents
} from '../src'

async function main() {
  // const audioFile = await fs.readFile('./fixtures/toronto.mp3')
  // const audioBuffer = await decodeAudio(audioFile)
  // const channelData = audioBuffer.getChannelData(0) // only accepts mono
  // const audio = arrayBufferToBase64(channelData)

  const client = new RealtimeClient({
    debug: !!getEnv('REALTIME_DEBUG'),
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

  const event: RealtimeServerEvents.ResponseDoneEvent =
    await client.api.waitForNext('response.done')
  console.log(JSON.stringify(event, null, 2))

  client.disconnect()
}

await main()
