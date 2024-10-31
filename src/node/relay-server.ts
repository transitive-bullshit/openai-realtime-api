import type { IncomingMessage } from 'node:http'

import { type WebSocket, WebSocketServer } from 'ws'

import type { RealtimeClient } from '../client'
import type { RealtimeClientEvents } from '../events'
import { assert, getEnv } from '../utils'

/**
 * Simple Node.js relay server for the OpenAI Realtime API.
 *
 * @example
 *
 * ```ts
 * import { RealtimeClient } from 'openai-realtime-api'
 * import { RealtimeRelay } from 'openai-realtime-api/node'
 *
 * const client = new RealtimeClient({ relay: true })
 * const relay = new RealtimeRelay({ client })
 * relay.listen(8081)
 * ```
 */
export class RealtimeRelay {
  readonly client: RealtimeClient
  wss?: WebSocketServer

  constructor({ client }: { client: RealtimeClient }) {
    assert(
      client.relay,
      'RealtimeRelay client must have the "relay" option set'
    )
    assert(
      client.realtime.apiKey,
      'RealtimeRelay client must have an API key set'
    )

    this.client = client
  }

  /**
   * Creates a `WebSocketServer` and begins listening for connections.
   *
   * @param port Port to listen on; defaults to the PORT environment variable or 8081.
   */
  listen(port?: number) {
    assert(!this.wss, 'RealtimeRelay is already listening')

    if (!port) {
      port = Number.parseInt(getEnv('PORT') ?? '8081')
      assert(!Number.isNaN(port), `Invalid port: ${port}`)
    }

    this.wss = new WebSocketServer({ port })
    this.wss.on('connection', this._connectionHandler.bind(this))

    this._info(`Listening on ws://localhost:${port}`)
  }

  /**
   * Closes the WebSocket server.
   */
  close() {
    this.wss?.close()
    this.wss = undefined
  }

  protected async _connectionHandler(ws: WebSocket, req: IncomingMessage) {
    if (!req.url) {
      this._error('No URL provided, closing connection.')
      ws.close()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const pathname = url.pathname

    if (pathname !== '/') {
      this._error(`Invalid pathname: "${pathname}"`)
      ws.close()
      return
    }

    // Relay: OpenAI server events -> browser
    this.client.realtime.on('server.*', (event) => {
      this._debug(`Relaying "${event.type}" to client`)
      ws.send(JSON.stringify(event))
    })
    this.client.realtime.on('close', () => ws.close())

    // Relay: browser events -> OpenAI server
    // We need to queue data waiting for the OpenAI connection
    const messageQueue: string[] = []
    const messageHandler = (data: string) => {
      try {
        const event = JSON.parse(data) as RealtimeClientEvents.ClientEvent
        this._debug(`Relaying "${event.type}" to server`)
        this.client.realtime.send(event.type, event)
      } catch (err: any) {
        this._error(`Error parsing event from client: ${data}`, err.message)
      }
    }

    ws.on('message', (data) => {
      if (!this.client.isConnected) {
        messageQueue.push(data.toString())
      } else {
        messageHandler(data.toString())
      }
    })
    ws.on('close', () => this.client.disconnect())

    // Connect to OpenAI Realtime API
    try {
      this._info('Connecting to server...', this.client.realtime.url)
      await this.client.connect()
    } catch (err: any) {
      this._error('Error connecting to server', err.message)
      ws.close()
      return
    }

    this._info('Connected to server successfully', this.client.realtime.url)
    while (messageQueue.length) {
      messageHandler(messageQueue.shift()!)
    }
  }

  protected _info(...args: any[]) {
    console.log('[RealtimeRelay]', ...args)
  }

  protected _debug(...args: any[]) {
    if (this.client.realtime.debug) {
      console.log('[RealtimeRelay]', ...args)
    }
  }

  protected _error(...args: any[]) {
    console.error('[RealtimeRelay]', ...args)
  }
}
