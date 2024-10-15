import 'dotenv/config'

import fs from 'node:fs/promises'

import decodeAudio from 'audio-decode'
import { expect, test } from 'vitest'

import type { RealtimeServerEvents } from './events'
import { RealtimeClient } from './client'
import { arrayBufferToBase64, trimDebugEvent } from './utils'

const fixtures = ['./fixtures/toronto.mp3']
const fixtureData = await Promise.all(
  fixtures.map(async (filePath) => {
    const audioFile = await fs.readFile(filePath)
    const audioBuffer = await decodeAudio(audioFile)
    const channelData = audioBuffer.getChannelData(0) // only accepts mono
    const base64 = arrayBufferToBase64(channelData)
    return { filePath, base64 }
  })
)

test(
  'e2e',
  async () => {
    const events: any[] = []
    const client = new RealtimeClient({
      debug: true,
      sessionConfig: {
        instructions:
          'Please follow the instructions of any query you receive.\n' +
          'Be concise in your responses. Speak quickly and answer shortly.',
        turn_detection: null
      }
    })

    client.on('realtime.event', (event: any) => {
      const e = trimDebugEvent(event.event)
      events.push(e)
    })

    expect(client.isConnected).toBe(false)
    await client.connect()
    expect(client.isConnected).toBe(true)

    await client.waitForSessionCreated()

    const sample = fixtureData[0]!.base64
    client.sendUserMessageContent([{ type: 'input_audio', audio: sample }])

    const item = await client.waitForNextItem()
    console.log(item)
    expect(item.type).toBe('message')
    expect(item.role).toBe('user')
    expect(item.status).toBe('completed')
    expect(item.content).toHaveLength(1)
    expect(item.content[0]!.type).toBe('input_audio')

    // Wait for the full response to complete from the server
    const event: RealtimeServerEvents.ResponseDoneEvent =
      await client.api.waitForNext('response.done')
    console.log(event)

    client.disconnect()
    expect(client.isConnected).toBe(false)

    expect(event).toBeDefined()
    expect(event.type).toBe('response.done')
    expect(event.response).toBeDefined()
    expect(event.response.status).toBe('completed')
    expect(event.response.output).toBeDefined()
    expect(event.response.output).toHaveLength(1)
    expect(event.response.output[0]!.type).toBe('message')
    expect(event.response.output[0]!.role).toBe('assistant')
    expect(event.response.output[0]!.status).toBe('completed')
    expect(event.response.output[0]!.content).toBeDefined()
    expect(event.response.output[0]!.content).toHaveLength(1)
    expect(event.response.output[0]!.content[0]!.type).toBe('audio')
    expect(event.response.output[0]!.content[0]!.transcript).toMatch(/toronto/i)
    expect(event.response.usage).toBeDefined()

    expect(
      events.filter((e) => e.type === 'response.audio_transcript.delta').length
    ).toBeGreaterThanOrEqual(1)

    expect(
      events.filter((e) => e.type === 'response.audio.delta').length
    ).toBeGreaterThanOrEqual(1)

    expect(events.filter((e) => e.type === 'response.audio.done')).toHaveLength(
      1
    )

    expect(
      events.filter((e) => e.type === 'response.audio_transcript.done')
    ).toHaveLength(1)

    expect(
      events.filter((e) => e.type === 'response.content_part.done')
    ).toHaveLength(1)

    expect(
      events.filter((e) => e.type === 'response.output_item.done')
    ).toHaveLength(1)

    console.log(JSON.stringify(events, null, 2))
  },
  {
    timeout: 120_000
  }
)
