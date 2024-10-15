import 'dotenv/config'

import { Readable } from 'node:stream'

import microphone from 'mic'
import Speaker from 'speaker'

import { type FormattedItem, getEnv, RealtimeClient } from '../src'

async function main() {
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

  let mic: microphone.Mic | undefined
  let speaker: Speaker | undefined
  startAudioStream()

  client.on(
    'conversation.item.completed',
    ({ item }: { item: FormattedItem }) => {
      const { formatted: _, ...rest } = item
      console.log('Conversation item completed:', rest)

      if (
        item.type === 'message' &&
        item.role === 'assistant' &&
        item.formatted &&
        item.formatted.audio
      ) {
        console.log(`Playing audio response... "${item.formatted.transcript}"`)
        playAudio(item.formatted.audio)
      }
    }
  )

  function startAudioStream() {
    try {
      mic = microphone({
        rate: '24000',
        channels: '1',
        debug: false,
        exitOnSilence: 6,
        fileType: 'raw',
        encoding: 'signed-integer'
      })

      const micInputStream = mic!.getAudioStream()

      micInputStream.on('error', (error: any) => {
        console.error('Microphone error:', error)
      })

      mic!.start()
      console.log('Microphone started streaming.')

      let audioBuffer = Buffer.alloc(0)
      const chunkSize = 4800 // 0.2 seconds of audio at 24kHz

      micInputStream.on('data', (data: Buffer) => {
        audioBuffer = Buffer.concat([audioBuffer, data])

        while (audioBuffer.length >= chunkSize) {
          const chunk = audioBuffer.subarray(0, chunkSize)
          audioBuffer = audioBuffer.subarray(chunkSize)

          const int16Array = new Int16Array(
            chunk.buffer,
            chunk.byteOffset,
            chunk.length / 2
          )

          try {
            client.appendInputAudio(int16Array)
          } catch (err) {
            console.error('Error sending audio data:', err)
          }
        }
      })

      micInputStream.on('silence', () => {
        console.log('Silence detected, creating response...')
        try {
          client.createResponse()
        } catch (err) {
          console.error('Error creating response:', err)
        }
      })
    } catch (err) {
      console.error('Error starting audio stream:', err)
    }
  }

  function playAudio(audioData: Int16Array) {
    try {
      if (!speaker) {
        speaker = new Speaker({
          channels: 1,
          bitDepth: 16,
          sampleRate: client.conversation.frequency
        })
      }

      const origSpeaker = speaker

      const buffer = Buffer.from(audioData.buffer)
      const readableStream = new Readable({
        read() {
          if (speaker !== origSpeaker) return
          this.push(buffer)
          this.push(null)
        }
      })

      // Pipe the audio stream to the speaker
      readableStream.pipe(speaker)
      console.log(
        'Audio sent to speaker for playback. Buffer length:',
        buffer.length
      )

      speaker.on('close', () => {
        speaker = undefined
      })
    } catch (err) {
      console.error('Error playing audio:', err)
    }
  }
}

await main()
